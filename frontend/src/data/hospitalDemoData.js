// Hospital Resource Allocation Demo Data — 600 synthetic patients
// Injected biases per spec:
//   Black severity 8-9: ICU admission 62% vs White 81%
//   Non-English: specialist wait 4.2 days longer
//   Medicaid: 18% fewer surgical referrals same severity
//   Black: 30-day readmission 19% vs White 11%
//   Pain management adequacy: Black 58%, White 79% at severity 7+

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRand(99);

const RACES = ['White', 'Black', 'Hispanic', 'Asian'];
const GENDERS = ['Male', 'Female'];
const LANGUAGES = ['English', 'Spanish', 'Mandarin', 'Arabic', 'Vietnamese'];
const INSURANCE = ['Private', 'Medicaid', 'Medicare', 'Uninsured'];
const DIAGNOSES = [
  'Pneumonia', 'Sepsis', 'Heart Attack', 'Hip Fracture', 'Bowel Obstruction',
  'Stroke', 'COPD Exacerbation', 'Appendicitis', 'DVT/PE', 'Kidney Failure'
];
const HOSPITAL_TYPES = ['Academic Center', 'Community Hospital', 'Safety Net Hospital'];

function weightedChoice(options, weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let threshold = r * total;
  for (let i = 0; i < options.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return options[i];
  }
  return options[options.length - 1];
}

const patients = [];

for (let i = 0; i < 600; i++) {
  const r = () => rand();

  const race = weightedChoice(RACES, [0.52, 0.24, 0.17, 0.07], r());
  const gender = r() < 0.50 ? 'Male' : 'Female';
  const age = Math.floor(22 + r() * 72);

  const language = race === 'White' ? 'English'
    : race === 'Hispanic' ? (r() < 0.52 ? 'Spanish' : 'English')
    : race === 'Asian' ? (r() < 0.58 ? (r() < 0.5 ? 'Mandarin' : 'Vietnamese') : 'English')
    : 'English';
  const isNonEnglish = language !== 'English';

  const insuranceWeights = race === 'Black' ? [0.28, 0.44, 0.20, 0.08]
    : race === 'Hispanic' ? [0.30, 0.40, 0.18, 0.12]
    : [0.56, 0.16, 0.24, 0.04];
  const insuranceType = weightedChoice(INSURANCE, insuranceWeights, r());
  const isMedicaid = insuranceType === 'Medicaid' || insuranceType === 'Uninsured';

  const hospitalType = isMedicaid
    ? (r() < 0.55 ? 'Safety Net Hospital' : 'Community Hospital')
    : (r() < 0.60 ? 'Academic Center' : 'Community Hospital');

  const diagnosis = DIAGNOSES[Math.floor(r() * DIAGNOSES.length)];
  const diagSeverity = Math.floor(1 + r() * 10);
  const diagSeverityBand = diagSeverity <= 3 ? 'low' : diagSeverity <= 6 ? 'medium' : 'high';
  const comorbidities = Math.floor(r() * 5);

  // Admission date (within last 12 months)
  const daysAgo = Math.floor(r() * 365);
  const admDate = new Date(2025, 3, 12);
  admDate.setDate(admDate.getDate() - daysAgo);
  const admissionDate = admDate.toISOString().split('T')[0];

  // LOS
  const baseLOS = 2 + diagSeverity * 0.5 + comorbidities * 0.3;
  const losJitter = (r() - 0.5) * 2;
  const stayDays = Math.max(1, Math.round(baseLOS + losJitter));
  const dischargeDate = new Date(admDate);
  dischargeDate.setDate(dischargeDate.getDate() + stayDays);
  const dischargeDateStr = dischargeDate.toISOString().split('T')[0];

  // ICU admission — inject disparity for severity 8-9
  let icuProb;
  if (diagSeverity >= 8 && diagSeverity <= 9) {
    icuProb = race === 'Black' ? 0.62 : race === 'Hispanic' ? 0.70 : race === 'Asian' ? 0.76 : 0.81;
  } else if (diagSeverity >= 7) {
    icuProb = race === 'Black' ? 0.45 : 0.55;
  } else if (diagSeverity >= 10) {
    icuProb = 0.90;
  } else {
    icuProb = 0.10 + diagSeverity * 0.03;
  }
  const icuAdmitted = r() < icuProb ? 1 : 0;

  // Specialist referral
  let specialistProb = 0.58;
  if (diagSeverityBand === 'high') specialistProb = 0.80;
  if (race === 'Black') specialistProb *= 0.87;
  if (isNonEnglish) specialistProb *= 0.80;
  if (isMedicaid) specialistProb *= 0.82; // 18% fewer
  const specialistReferred = r() < Math.min(specialistProb, 0.92) ? 1 : 0;

  // Specialist wait time (days)
  const baseWait = 1.5 + r() * 3;
  const waitTimeBonus = isNonEnglish ? 4.2 : 0;
  const waitTimeDays = specialistReferred ? parseFloat((baseWait + waitTimeBonus + (isMedicaid ? 1.5 : 0)).toFixed(1)) : null;

  // Surgery performed
  const surgicalDiagnosis = ['Hip Fracture', 'Bowel Obstruction', 'Appendicitis'].includes(diagnosis);
  let surgeryProb = surgicalDiagnosis ? 0.85 : 0.15;
  if (isMedicaid) surgeryProb *= 0.82;
  if (race === 'Black') surgeryProb *= 0.88;
  const surgeryPerformed = r() < surgeryProb ? 1 : 0;

  // Wait time to surgery (hours)
  const waitTimeHours = surgeryPerformed
    ? parseFloat((2 + r() * 8 + (race === 'Black' ? 2.5 : 0) + (isMedicaid ? 3.0 : 0)).toFixed(1))
    : parseFloat((0.5 + r() * 4).toFixed(1));

  // Pain score
  const paintScore = Math.floor(1 + r() * 10);

  // Pain management adequacy
  let painMgmtAdequate = null;
  if (paintScore >= 7) {
    const adequacyProb = race === 'Black' ? 0.58 : race === 'Hispanic' ? 0.64 : 0.79;
    painMgmtAdequate = r() < adequacyProb ? 1 : 0;
  }

  // 30-day readmission
  let readmissionProb = 0.08 + (diagSeverity > 7 ? 0.05 : 0);
  if (race === 'Black') readmissionProb += 0.08; // 19% vs 11%
  if (isMedicaid) readmissionProb += 0.04;
  if (icuAdmitted === 0 && diagSeverity >= 8) readmissionProb += 0.10; // early discharge proxy
  const readmission30day = r() < Math.min(readmissionProb, 0.45) ? 1 : 0;

  const disabilityStatus = r() < 0.10 ? 1 : 0;

  patients.push({
    patient_id: `HP${String(i + 1).padStart(4, '0')}`,
    admission_date: admissionDate,
    discharge_date: dischargeDateStr,
    length_of_stay_days: stayDays,
    diagnosis,
    diagnosis_severity: diagSeverity,
    severity_band: diagSeverityBand,
    comorbidities,
    icu_admitted: icuAdmitted,
    specialist_referred: specialistReferred,
    specialist_wait_days: waitTimeDays,
    surgery_performed: surgeryPerformed,
    wait_time_hours: waitTimeHours,
    pain_score: paintScore,
    pain_management_adequate: painMgmtAdequate,
    readmission_30day: readmission30day,
    insurance_type: insuranceType,
    hospital_type: hospitalType,
    // Sensitive
    race,
    gender,
    age,
    primary_language: language,
    disability_status: disabilityStatus,
  });
}

export const HOSPITAL_DEMO = patients;
