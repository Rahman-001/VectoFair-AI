// US Disease Prevalence by Race/Gender — approximate published CDC/NIH values
// Used by ClinicalTrialDashboard to compute representation ratios

export const DISEASE_PREVALENCE = {
  diabetes: {
    label: 'Type 2 Diabetes',
    overall: 11.3,
    byRace: { White: 7.5, Black: 11.7, Hispanic: 12.5, Asian: 9.2 },
    byGender: { Male: 12.1, Female: 10.5 },
    age65plus: 26.8,
  },
  hypertension: {
    label: 'Hypertension',
    overall: 47.0,
    byRace: { White: 45.7, Black: 57.1, Hispanic: 43.7, Asian: 38.0 },
    byGender: { Male: 50.0, Female: 44.0 },
    age65plus: 70.0,
  },
  heart_disease: {
    label: 'Coronary Heart Disease',
    overall: 6.2,
    byRace: { White: 6.5, Black: 6.5, Hispanic: 4.8, Asian: 3.7 },
    byGender: { Male: 8.0, Female: 4.6 },
    age65plus: 20.1,
  },
  breast_cancer: {
    label: 'Breast Cancer',
    overall: 13.0,
    byRace: { White: 13.0, Black: 12.0, Hispanic: 10.3, Asian: 9.5 },
    byGender: { Male: 0.1, Female: 12.9 },
    age65plus: 26.5,
  },
  prostate_cancer: {
    label: 'Prostate Cancer',
    overall: 12.5,
    byRace: { White: 11.6, Black: 17.0, Hispanic: 9.9, Asian: 8.0 },
    byGender: { Male: 12.5, Female: 0 },
    age65plus: 38.0,
  },
  depression: {
    label: 'Major Depression',
    overall: 8.3,
    byRace: { White: 9.1, Black: 7.2, Hispanic: 8.0, Asian: 4.8 },
    byGender: { Male: 5.5, Female: 11.2 },
    age65plus: 6.5,
  },
  asthma: {
    label: 'Asthma',
    overall: 8.0,
    byRace: { White: 7.7, Black: 10.9, Hispanic: 7.6, Asian: 4.0 },
    byGender: { Male: 6.3, Female: 9.6 },
    age65plus: 8.5,
  },
  lupus: {
    label: 'Systemic Lupus Erythematosus',
    overall: 0.11,
    byRace: { White: 0.06, Black: 0.22, Hispanic: 0.15, Asian: 0.12 },
    byGender: { Male: 0.02, Female: 0.20 },
    age65plus: 0.08,
  },
  multiple_sclerosis: {
    label: 'Multiple Sclerosis',
    overall: 0.30,
    byRace: { White: 0.38, Black: 0.22, Hispanic: 0.14, Asian: 0.06 },
    byGender: { Male: 0.18, Female: 0.42 },
    age65plus: 0.15,
  },
  stroke: {
    label: 'Stroke',
    overall: 2.8,
    byRace: { White: 2.5, Black: 4.0, Hispanic: 2.9, Asian: 2.2 },
    byGender: { Male: 2.9, Female: 2.7 },
    age65plus: 9.0,
  },
  alzheimers: {
    label: "Alzheimer's Disease",
    overall: 1.8,
    byRace: { White: 1.5, Black: 2.7, Hispanic: 2.3, Asian: 1.0 },
    byGender: { Male: 1.4, Female: 2.2 },
    age65plus: 10.7,
  },
  copd: {
    label: 'COPD',
    overall: 6.4,
    byRace: { White: 7.0, Black: 5.9, Hispanic: 4.2, Asian: 2.5 },
    byGender: { Male: 6.5, Female: 6.3 },
    age65plus: 14.2,
  },
  kidney_disease: {
    label: 'Chronic Kidney Disease',
    overall: 15.0,
    byRace: { White: 13.0, Black: 21.0, Hispanic: 16.0, Asian: 13.0 },
    byGender: { Male: 15.5, Female: 14.5 },
    age65plus: 38.0,
  },
  hiv_aids: {
    label: 'HIV/AIDS',
    overall: 0.34,
    byRace: { White: 0.18, Black: 0.98, Hispanic: 0.40, Asian: 0.08 },
    byGender: { Male: 0.55, Female: 0.13 },
    age65plus: 0.10,
  },
  colorectal_cancer: {
    label: 'Colorectal Cancer',
    overall: 4.4,
    byRace: { White: 4.1, Black: 5.3, Hispanic: 3.4, Asian: 3.4 },
    byGender: { Male: 5.0, Female: 3.9 },
    age65plus: 13.1,
  },
  covid_severity: {
    label: 'Severe COVID-19',
    overall: 4.5,
    byRace: { White: 3.0, Black: 7.0, Hispanic: 6.5, Asian: 4.0 },
    byGender: { Male: 5.8, Female: 3.1 },
    age65plus: 15.0,
  },
  sickle_cell: {
    label: 'Sickle Cell Disease',
    overall: 0.03,
    byRace: { White: 0.001, Black: 0.20, Hispanic: 0.05, Asian: 0.01 },
    byGender: { Male: 0.03, Female: 0.03 },
    age65plus: 0.01,
  },
  obesity: {
    label: 'Obesity',
    overall: 41.9,
    byRace: { White: 37.9, Black: 49.9, Hispanic: 45.6, Asian: 16.1 },
    byGender: { Male: 40.0, Female: 43.7 },
    age65plus: 37.2,
  },
  anxiety: {
    label: 'Generalized Anxiety Disorder',
    overall: 19.1,
    byRace: { White: 22.0, Black: 14.5, Hispanic: 15.0, Asian: 8.0 },
    byGender: { Male: 12.5, Female: 25.9 },
    age65plus: 11.2,
  },
  rheumatoid_arthritis: {
    label: 'Rheumatoid Arthritis',
    overall: 0.84,
    byRace: { White: 0.90, Black: 1.00, Hispanic: 0.78, Asian: 0.45 },
    byGender: { Male: 0.50, Female: 1.20 },
    age65plus: 2.20,
  },
};

// Helper: find closest condition key from free text
export function matchCondition(conditionText) {
  if (!conditionText) return null;
  const text = conditionText.toLowerCase();
  const keys = Object.keys(DISEASE_PREVALENCE);
  for (const key of keys) {
    if (text.includes(key.replace('_', ' ')) || text.includes(key)) return key;
  }
  // Fuzzy common aliases
  if (text.includes('diabet')) return 'diabetes';
  if (text.includes('hypert')) return 'hypertension';
  if (text.includes('heart') || text.includes('coronar')) return 'heart_disease';
  if (text.includes('breast')) return 'breast_cancer';
  if (text.includes('prostat')) return 'prostate_cancer';
  if (text.includes('depress')) return 'depression';
  if (text.includes('asthma')) return 'asthma';
  if (text.includes('lupus')) return 'lupus';
  if (text.includes('sclerosis')) return 'multiple_sclerosis';
  if (text.includes('stroke')) return 'stroke';
  if (text.includes('alzheim')) return 'alzheimers';
  if (text.includes('copd') || text.includes('pulmonar')) return 'copd';
  if (text.includes('kidney') || text.includes('renal')) return 'kidney_disease';
  if (text.includes('hiv') || text.includes('aids')) return 'hiv_aids';
  if (text.includes('colorect') || text.includes('colon')) return 'colorectal_cancer';
  if (text.includes('covid') || text.includes('sars')) return 'covid_severity';
  if (text.includes('sickle')) return 'sickle_cell';
  if (text.includes('obes')) return 'obesity';
  if (text.includes('anxiety')) return 'anxiety';
  if (text.includes('arthrit') || text.includes('rheumat')) return 'rheumatoid_arthritis';
  return null;
}
