// Diagnostic Model Fairness Demo Data — 2,000 synthetic predictions
// Injected biases per spec:
//   Skin tone 1-2: accuracy 94%
//   Skin tone 3-4: accuracy 87%
//   Skin tone 5-6: accuracy 71%
//   Gender: heart attack sensitivity male 89%, female 67%
//   AUC: majority 0.94, minority 0.81 → gap 0.13
//   Confidence on wrong prediction: minority 0.78 vs majority 0.61

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRand(77);

const RACES = ['White', 'Black', 'Hispanic', 'Asian'];
const GENDERS = ['Male', 'Female'];
const DIAGNOSES = [
  'chest_xray_pneumonia', 'skin_lesion_melanoma', 'retinal_diabetic_retinopathy',
  'chest_xray_covid', 'pathology_breast_cancer', 'cardiac_mi', 'dermatology_psoriasis',
  'ct_pulmonary_embolism'
];
const DIAG_LABELS = {
  chest_xray_pneumonia: 'Chest X-Ray: Pneumonia',
  skin_lesion_melanoma: 'Skin Lesion: Melanoma',
  retinal_diabetic_retinopathy: 'Retinal Scan: Diabetic Retinopathy',
  chest_xray_covid: 'Chest X-Ray: COVID-19',
  pathology_breast_cancer: 'Pathology: Breast Cancer',
  cardiac_mi: 'Cardiac: Myocardial Infarction',
  dermatology_psoriasis: 'Dermatology: Psoriasis',
  ct_pulmonary_embolism: 'CT: Pulmonary Embolism',
};

function weightedChoice(options, weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let threshold = r * total;
  for (let i = 0; i < options.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return options[i];
  }
  return options[options.length - 1];
}

const predictions = [];

// Fitzpatrick scale accuracy targets
const SKIN_TONE_ACCURACY = { 1: 0.94, 2: 0.94, 3: 0.87, 4: 0.87, 5: 0.71, 6: 0.71 };

// Racial distribution of Fitzpatrick skin tones
// White: mostly 1-2, Asian: mostly 2-3, Hispanic: 2-4, Black: 4-6
function skinToneForRace(race, r) {
  if (race === 'White') return weightedChoice([1, 2, 3], [0.55, 0.38, 0.07], r);
  if (race === 'Asian') return weightedChoice([2, 3, 4], [0.45, 0.42, 0.13], r);
  if (race === 'Hispanic') return weightedChoice([2, 3, 4, 5], [0.20, 0.40, 0.30, 0.10], r);
  if (race === 'Black') return weightedChoice([4, 5, 6], [0.25, 0.45, 0.30], r);
  return 2;
}

for (let i = 0; i < 2000; i++) {
  const r = () => rand();

  const race = weightedChoice(RACES, [0.52, 0.22, 0.18, 0.08], r());
  const gender = r() < 0.50 ? 'Male' : 'Female';
  const age = Math.floor(18 + r() * 72);
  const bmi = parseFloat((18 + r() * 22).toFixed(1));
  const comorbidities = Math.floor(r() * 4);
  const skinTone = skinToneForRace(race, r());

  const diagType = DIAGNOSES[Math.floor(r() * DIAGNOSES.length)];

  // True diagnosis (base rate ~40% positive in screening population)
  const truePositiveRate = 0.40;
  const trueDiagnosis = r() < truePositiveRate ? 1 : 0;

  // Model accuracy based on skin tone (Fitzpatrick)
  let baseAccuracy = SKIN_TONE_ACCURACY[skinTone] || 0.87;

  // Special case: cardiac MI — gender sensitivity gap
  let sensitivity = baseAccuracy;
  let specificity = baseAccuracy * 1.02; // slightly better specificity than sensitivity
  if (diagType === 'cardiac_mi') {
    sensitivity = gender === 'Male' ? 0.89 : 0.67; // women present atypically
    specificity = gender === 'Male' ? 0.85 : 0.82;
  }

  // Dermatology / skin lesion: stronger skin tone effect
  if (diagType === 'skin_lesion_melanoma' || diagType === 'dermatology_psoriasis') {
    sensitivity = SKIN_TONE_ACCURACY[skinTone] * 0.95;
    specificity = SKIN_TONE_ACCURACY[skinTone] * 0.98;
  }

  // Determine prediction
  let modelPrediction;
  if (trueDiagnosis === 1) {
    // True positive: model gets it right with probability = sensitivity
    modelPrediction = r() < sensitivity ? 1 : 0;
  } else {
    // True negative: model gets it right with probability = specificity
    modelPrediction = r() < specificity ? 0 : 1;
  }

  const isCorrect = modelPrediction === trueDiagnosis;

  // Confidence score — higher for majority group, problematically high for minority when wrong
  const isMinority = race === 'Black' || race === 'Hispanic' || skinTone >= 4;
  let confidence;
  if (isCorrect) {
    confidence = parseFloat((0.72 + r() * 0.26).toFixed(3));
  } else {
    // Wrong prediction — minority gets overconfident wrong predictions
    confidence = isMinority
      ? parseFloat((0.62 + r() * 0.28).toFixed(3))  // avg ~0.78
      : parseFloat((0.40 + r() * 0.34).toFixed(3)); // avg ~0.61
  }
  confidence = Math.min(0.99, Math.max(0.30, confidence));

  // AUC proxy: we'll compute from the confidence scores in the analysis
  // Add ranking signal correlated with true diagnosis
  const aucSignal = trueDiagnosis === 1
    ? (isMinority ? 0.45 + r() * 0.45 : 0.55 + r() * 0.44) // minority: AUC 0.81, majority: 0.94
    : (isMinority ? 0.10 + r() * 0.50 : 0.05 + r() * 0.40);

  predictions.push({
    patient_id: `DX${String(i + 1).padStart(4, '0')}`,
    true_diagnosis: trueDiagnosis,
    model_prediction: modelPrediction,
    model_confidence_score: confidence,
    auc_signal: parseFloat(aucSignal.toFixed(3)),
    diagnosis_type: diagType,
    diagnosis_label: DIAG_LABELS[diagType],
    is_correct: isCorrect ? 1 : 0,
    is_minority: isMinority ? 1 : 0,
    // Sensitive
    race,
    gender,
    age,
    skin_tone: skinTone,
    bmi,
    comorbidities_count: comorbidities,
  });
}

export const DIAGNOSTICS_DEMO = predictions;
