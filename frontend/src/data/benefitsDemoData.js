// Government Benefits Demo Data — 500 applications
// Injected biases:
//   Non-English: 12 days longer processing, 22% more denials
//   Black applicants: approval 61% vs White 78% equal eligibility
//   Medicaid: approved amount 18% lower same need level
//   Appeal success: White 67%, minority 38%
//   Disability: 8 days longer processing

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(44);

const RACES = ['White','Black','Hispanic','Asian'];
const GENDERS = ['Male','Female'];
const BENEFIT_TYPES = ['SNAP','Medicaid','Housing Assistance','Unemployment Insurance','TANF','Child Care Subsidy'];
const LANGUAGES = ['English','Spanish','Mandarin','Arabic','Vietnamese'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const applications = [];

for (let i = 0; i < 500; i++) {
  const r = () => rand();

  const race = wChoice(RACES,[0.48,0.26,0.18,0.08],r());
  const gender = r()<0.58?'Female':'Male';
  const age = Math.floor(18+r()*60);
  const disabilityStatus = r()<0.15?1:0;
  const householdSize = Math.floor(1+r()*6);

  const language = race==='White'?'English':
    race==='Hispanic'?wChoice(LANGUAGES,[0,0.55,0,0,0.08].map((v,i)=>i===0?0.37:v),[0.37,0.55,0,0,0.08],r()):
    race==='Asian'?wChoice(['English','Mandarin','Vietnamese'],[0.42,0.38,0.20],r()):
    'English';
  const isNonEnglish = language!=='English';

  const benefitType = wChoice(BENEFIT_TYPES,[0.22,0.25,0.18,0.15,0.12,0.08],r());
  const needLevel = Math.floor(1+r()*5); // 1=low need, 5=critical need

  // Eligibility score (algorithmic)
  const baseEligibility = (needLevel/5)*85 + (householdSize>2?10:0) + (disabilityStatus?8:0);
  const eligibilityScore = Math.min(100, Math.round(baseEligibility + (r()-0.5)*10));
  const meetsEligibility = eligibilityScore >= 55;

  // Applied amount
  const appliedAmount = Math.round(200 + needLevel*150 + householdSize*80 + r()*200);

  // Approval — inject racial bias
  let approvalProb = meetsEligibility ? 0.75 : 0.20;
  if (race==='Black') approvalProb -= 0.17; // 61% vs 78%
  if (race==='Hispanic') approvalProb -= 0.10;
  if (isNonEnglish) approvalProb -= 0.10; // 22% more denials
  if (disabilityStatus) approvalProb -= 0.04;
  approvalProb = Math.min(0.95, Math.max(0.05, approvalProb));
  const approved = r() < approvalProb ? 1 : 0;

  // Approved amount — Medicaid disparity
  let approvedAmount = 0;
  if (approved) {
    approvedAmount = appliedAmount * (0.80 + r()*0.20);
    if (benefitType==='Medicaid') approvedAmount *= (race!=='White'?0.82:1.0); // 18% less for minorities
    approvedAmount = Math.round(approvedAmount);
  }

  // Processing time (days) — inject bias
  const baseProcessing = 7 + needLevel + Math.floor(r()*8);
  let processingBonus = 0;
  if (isNonEnglish) processingBonus += (9+r()*6); // avg +12 days
  if (disabilityStatus) processingBonus += (5+r()*6); // avg +8 days
  if (race==='Black') processingBonus += (1+r()*3);
  const processingTimeDays = Math.round(baseProcessing + processingBonus);

  // Appeal
  const appealFiled = approved===0 && r()<(meetsEligibility?0.55:0.25)?1:0;
  let appealSuccess = null;
  if (appealFiled) {
    const appealProb = race==='White'?0.67:0.38;
    appealSuccess = r()<appealProb?'approved':'denied';
  }

  // Zip code
  const zipCode = race==='White'?String(20000+Math.floor(r()*50000)):String(70000+Math.floor(r()*20000));

  applications.push({
    applicant_id: `BEN${String(i+1).padStart(4,'0')}`,
    benefit_type: benefitType,
    applied_amount: appliedAmount,
    approved_amount: approvedAmount,
    approved,
    approval_ratio: approved?(approvedAmount/appliedAmount):0,
    eligibility_score: eligibilityScore,
    meets_eligibility: meetsEligibility?1:0,
    need_level: needLevel,
    processing_time_days: processingTimeDays,
    appeal_filed: appealFiled,
    appeal_outcome: appealFiled?(appealSuccess||'pending'):'na',
    zip_code: zipCode,
    household_size: householdSize,
    race, gender, age,
    disability_status: disabilityStatus,
    primary_language: language,
    is_non_english: isNonEnglish?1:0,
  });
}

export const BENEFITS_DEMO = applications;
