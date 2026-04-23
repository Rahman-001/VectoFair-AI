// Treatment Recommendation Demo Data — 500 synthetic patients
// Injected biases per spec:
//   Black patients severity 7-8: conservative treatment 34% more often
//   Non-English primary: specialist referral 28% vs 51% (English)
//   Medicaid: 22% fewer specialist referrals same severity
//   Pain mgmt: Black pain 7+ → adequate 58% vs White 79%
//   Outcomes: Black 12% higher 30-day readmission after severity control

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRand(42);

const RACES = ['White', 'Black', 'Hispanic', 'Asian'];
const GENDERS = ['Male', 'Female'];
const LANGUAGES = ['English', 'Spanish', 'Mandarin', 'Vietnamese', 'Arabic'];
const INSURANCE = ['Private', 'Medicaid', 'Medicare', 'Uninsured'];
const DIAGNOSES = ['J18.9','I21.9','N18.3','E11.9','I10','K57.30','C18.9','F32.9'];
const DIAGNOSIS_LABELS = {
  'J18.9': 'Pneumonia', 'I21.9': 'MI', 'N18.3': 'CKD Stage 3',
  'E11.9': 'Type 2 Diabetes', 'I10': 'Hypertension',
  'K57.30': 'Diverticulitis', 'C18.9': 'Colorectal Cancer', 'F32.9': 'Depression'
};
const TREATMENTS = ['Conservative', 'Moderate', 'Aggressive'];
const HOSPITALS = ['Academic Center', 'Community Hospital', 'Safety Net Hospital'];

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

for (let i = 0; i < 500; i++) {
  const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
  const r6 = rand(), r7 = rand(), r8 = rand(), r9 = rand(), r10 = rand();
  const r11 = rand(), r12 = rand(), r13 = rand();

  // Demographics
  const race = weightedChoice(RACES, [0.55, 0.22, 0.16, 0.07], r1);
  const gender = r2 < 0.50 ? 'Male' : 'Female';
  const age = Math.floor(25 + r3 * 70);
  const language = race === 'White' ? 'English'
    : race === 'Hispanic' ? (r4 < 0.55 ? 'Spanish' : 'English')
    : race === 'Asian' ? (r4 < 0.60 ? (r5 < 0.5 ? 'Mandarin' : 'Vietnamese') : 'English')
    : 'English';
  const primaryLanguage = language;
  const isNonEnglish = primaryLanguage !== 'English';

  // Insurance — Medicaid skewed toward Black/Hispanic
  const insuranceWeights = race === 'Black' ? [0.30, 0.42, 0.20, 0.08]
    : race === 'Hispanic' ? [0.32, 0.38, 0.18, 0.12]
    : [0.55, 0.18, 0.22, 0.05];
  const insuranceType = weightedChoice(INSURANCE, insuranceWeights, r6);
  const isMedicaid = insuranceType === 'Medicaid';

  // Hospital type
  const hospitalType = insuranceType === 'Medicaid' || insuranceType === 'Uninsured'
    ? (r7 < 0.55 ? 'Safety Net Hospital' : 'Community Hospital')
    : (r7 < 0.60 ? 'Academic Center' : 'Community Hospital');

  // Clinical
  const diagCode = DIAGNOSES[Math.floor(r8 * DIAGNOSES.length)];
  const severityScore = Math.floor(1 + r9 * 10);
  const comorbidityCount = Math.floor(r10 * 5);
  const painScore = diagCode === 'I21.9' || diagCode === 'K57.30' || diagCode === 'C18.9'
    ? Math.floor(3 + r11 * 7) : Math.floor(r11 * 6);

  const severityBand = severityScore <= 3 ? 'low' : severityScore <= 6 ? 'medium' : 'high';

  // Treatment recommendation — inject racial bias for severity 7-8
  let treatmentWeights;
  const isHighSeverity = severityScore >= 7 && severityScore <= 8;

  if (race === 'Black' && isHighSeverity) {
    // 34% more conservative treatment
    treatmentWeights = [0.52, 0.30, 0.18]; // Conservative, Moderate, Aggressive
  } else if (race === 'Black' && severityScore >= 9) {
    treatmentWeights = [0.25, 0.35, 0.40];
  } else if (severityBand === 'high') {
    treatmentWeights = [0.18, 0.32, 0.50];
  } else if (severityBand === 'medium') {
    treatmentWeights = [0.35, 0.40, 0.25];
  } else {
    treatmentWeights = [0.55, 0.35, 0.10];
  }
  const recommendedTreatment = weightedChoice(TREATMENTS, treatmentWeights, r12);

  // Treatment actually received (access gap for non-English / Medicaid)
  let receivedCorrectly = true;
  if (isNonEnglish && rand() > 0.85) receivedCorrectly = false;
  if (isMedicaid && rand() > 0.88) receivedCorrectly = false;
  const treatmentReceived = receivedCorrectly ? recommendedTreatment
    : weightedChoice(TREATMENTS, [0.45, 0.35, 0.20], rand());

  // Specialist referral
  let referralProb = isNonEnglish ? 0.28 : 0.51;
  if (isMedicaid) referralProb *= 0.78; // 22% fewer
  if (severityBand === 'high') referralProb += 0.20;
  if (race === 'Black') referralProb *= 0.88;
  const specialistReferred = rand() < Math.min(referralProb, 0.85) ? 1 : 0;

  // Pain management adequacy (if pain score >= 7)
  let painMgmtAdequate = null;
  if (painScore >= 7) {
    const adequacyProb = race === 'Black' ? 0.58 : race === 'Hispanic' ? 0.64 : 0.79;
    painMgmtAdequate = rand() < adequacyProb ? 1 : 0;
  }

  // Outcome: treatment_outcome 1=improved 0=not
  let baseOutcomeProb = 0.72 - (comorbidityCount * 0.04) - ((10 - severityScore) * 0.02);
  if (race === 'Black') baseOutcomeProb -= 0.08; // worse outcomes
  if (isNonEnglish) baseOutcomeProb -= 0.04;
  if (recommendedTreatment === 'Aggressive' && treatmentReceived !== 'Aggressive') baseOutcomeProb -= 0.10;
  const treatmentOutcome = rand() < Math.max(0.10, Math.min(0.90, baseOutcomeProb)) ? 1 : 0;

  // 30-day readmission — proxy for under-treatment
  let readmissionProb = (1 - treatmentOutcome) * 0.35 + 0.08;
  if (race === 'Black') readmissionProb += 0.06; // 12% higher baseline
  if (isMedicaid) readmissionProb += 0.04;
  if (treatmentReceived === 'Conservative' && recommendedTreatment === 'Aggressive') readmissionProb += 0.12;
  const readmission30day = rand() < Math.min(readmissionProb, 0.45) ? 1 : 0;

  // Disability status
  const disabilityStatus = rand() < 0.12 ? 1 : 0;

  patients.push({
    patient_id: `PT${String(i + 1).padStart(4, '0')}`,
    diagnosis_code: diagCode,
    diagnosis_label: DIAGNOSIS_LABELS[diagCode],
    severity_score: severityScore,
    severity_band: severityBand,
    recommended_treatment: recommendedTreatment,
    treatment_received: treatmentReceived,
    treatment_outcome: treatmentOutcome,
    comorbidity_count: comorbidityCount,
    pain_score: painScore,
    pain_management_adequate: painMgmtAdequate,
    specialist_referred: specialistReferred,
    readmission_30day: readmission30day,
    insurance_type: insuranceType,
    hospital_type: hospitalType,
    // Sensitive
    race,
    gender,
    age,
    primary_language: primaryLanguage,
    disability_status: disabilityStatus,
  });
}

export const TREATMENT_DEMO = patients;
