// Recidivism Model Audit Demo Data — 1,000 synthetic defendants
// Modeled after ProPublica Broward County patterns:
//   Black defendants: FPR ~43%, FNR ~29%
//   White defendants: FPR ~24%, FNR ~46%
//   Calibration roughly equal (PPV similar)
//   Age explains ~35% of racial gap

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(88);

const RACES = ['White','Black','Hispanic','Other'];
const GENDERS = ['Male','Female'];
const CHARGES = ['Felony','Misdemeanor','Drug Offense','Property Crime','Violent Crime'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const defendants = [];

for (let i = 0; i < 1000; i++) {
  const r = () => rand();

  const race = wChoice(RACES,[0.42,0.40,0.12,0.06],r());
  const gender = wChoice(GENDERS,[0.82,0.18],r());
  const ageAtAssessment = Math.floor(18+r()*47);
  const priorConvictions = Math.floor(r()*6);
  const chargeType = wChoice(CHARGES,[0.25,0.30,0.20,0.15,0.10],r());

  // True reoffend probability — based on criminology literature
  let baseReoffendProb = 0.30
    + (priorConvictions*0.06)
    - (Math.min(ageAtAssessment-18,30)*0.008)
    + (chargeType==='Violent Crime'?0.08:0)
    + (chargeType==='Drug Offense'?0.05:0);

  // Socioeconomic factors correlated with race — not reflecting individual culpability
  if (race==='Black') baseReoffendProb += 0.03; // structural, not individual
  if (race==='Hispanic') baseReoffendProb += 0.01;

  baseReoffendProb = Math.min(0.75, Math.max(0.05, baseReoffendProb));
  const actualReoffended = r() < baseReoffendProb ? 1 : 0;

  // Risk score (1-10) — COMPAS-like, biased
  // Age weighs heavily — correlates with race in this dataset
  const ageScore = ageAtAssessment < 25 ? 3 : ageAtAssessment < 35 ? 2 : ageAtAssessment < 45 ? 1 : 0;
  const priorScore = Math.min(priorConvictions * 1.2, 4);
  const chargeScore = chargeType==='Violent Crime'?2:chargeType==='Felony'?1.5:1;

  let rawRiskScore = 2 + ageScore + priorScore + chargeScore;

  // Black defendants get slightly higher scores for same profile (historical bias in training data)
  if (race==='Black') rawRiskScore += (0.3+r()*0.4);
  if (race==='White') rawRiskScore -= (0.1+r()*0.3);

  const riskScore = Math.round(Math.min(10, Math.max(1, rawRiskScore + (r()-0.5)*1.5)));

  // Label: high risk = score >= 7, low risk = score <= 4, medium = 5-6
  const predictedHighRisk = riskScore >= 7 ? 1 : 0;
  const predictedLowRisk = riskScore <= 4 ? 1 : 0;

  // FPR: predicted high-risk, did NOT reoffend
  // FNR: predicted low-risk, DID reoffend
  const isFP = predictedHighRisk === 1 && actualReoffended === 0 ? 1 : 0;
  const isFN = predictedLowRisk === 1 && actualReoffended === 1 ? 1 : 0;

  defendants.push({
    defendant_id: `DEF${String(i+1).padStart(4,'0')}`,
    risk_score: riskScore,
    predicted_high_risk: predictedHighRisk,
    predicted_low_risk: predictedLowRisk,
    actual_reoffended: actualReoffended,
    is_fp: isFP,
    is_fn: isFN,
    prior_convictions: priorConvictions,
    age_at_assessment: ageAtAssessment,
    charge_type: chargeType,
    race, gender,
  });
}

export const RECIDIVISM_DEMO = defendants;
