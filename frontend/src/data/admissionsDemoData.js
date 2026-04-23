// Admissions Algorithm Audit Demo Data — 800 applicants
// Injected biases per spec:
//   Legacy applicants: 77% White, admission rate 68% vs non-legacy 31%
//   Financial aid applicants: admitted 19% vs 34% same profile
//   Public school: 24% vs private 41% same SAT
//   Urban majority-minority zip: 21% vs suburban 38%

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRand(13);

const RACES = ['White', 'Black', 'Hispanic', 'Asian', 'Other'];
const GENDERS = ['Male', 'Female', 'Non-binary'];
const HS_TYPES = ['Public', 'Private', 'Charter'];
const INCOME_BRACKETS = [1, 2, 3, 4, 5]; // 1=lowest, 5=highest

function weightedChoice(options, weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let threshold = r * total;
  for (let i = 0; i < options.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return options[i];
  }
  return options[options.length - 1];
}

const applicants = [];

for (let i = 0; i < 800; i++) {
  const r = () => rand();

  // Race distribution
  const race = weightedChoice(RACES, [0.50, 0.13, 0.18, 0.14, 0.05], r());
  const gender = weightedChoice(GENDERS, [0.46, 0.51, 0.03], r());

  // First gen college student
  const firstGenProb = race === 'White' ? 0.19 : race === 'Asian' ? 0.25 : 0.42;
  const firstGenCollege = r() < firstGenProb ? 1 : 0;

  // Family income bracket — correlated with race
  const incomeWeights = race === 'White' ? [0.08, 0.14, 0.24, 0.30, 0.24]
    : race === 'Asian' ? [0.10, 0.16, 0.22, 0.28, 0.24]
    : race === 'Black' ? [0.26, 0.30, 0.24, 0.14, 0.06]
    : race === 'Hispanic' ? [0.24, 0.28, 0.26, 0.15, 0.07]
    : [0.15, 0.20, 0.25, 0.22, 0.18];
  const familyIncomeBracket = weightedChoice(INCOME_BRACKETS, incomeWeights, r());

  // High school type — correlated with income
  const hsWeights = familyIncomeBracket >= 4 ? [0.35, 0.55, 0.10]
    : familyIncomeBracket === 3 ? [0.60, 0.30, 0.10]
    : [0.78, 0.12, 0.10];
  const highSchoolType = weightedChoice(HS_TYPES, hsWeights, r());

  // ZIP code type
  const zipWeights = familyIncomeBracket >= 4 ? [0.72, 0.28]
    : familyIncomeBracket <= 2 ? [0.25, 0.75]
    : [0.50, 0.50];
  const zipType = weightedChoice(['Suburban/Rural', 'Urban Majority-Minority'], zipWeights, r());
  const homeZipCode = zipType === 'Suburban/Rural'
    ? String(10000 + Math.floor(r() * 80000))
    : String(90000 + Math.floor(r() * 9999));

  // Academic metrics — correlated with income/school type
  const gpaBase = 2.8 + familyIncomeBracket * 0.24 + (highSchoolType === 'Private' ? 0.15 : 0);
  const gpa = parseFloat(Math.min(4.0, Math.max(2.0, gpaBase + (r() - 0.5) * 0.8)).toFixed(2));

  const satBase = 900 + familyIncomeBracket * 80 + (highSchoolType === 'Private' ? 60 : 0);
  const satScore = Math.min(1600, Math.max(800, Math.round(satBase + (r() - 0.5) * 200)));

  const ecBase = 4 + familyIncomeBracket * 0.8 + (highSchoolType !== 'Public' ? 1.0 : 0);
  const extracurricularsScore = parseFloat(Math.min(10, Math.max(1, ecBase + (r() - 0.5) * 3)).toFixed(1));

  const essayBase = 5 + (r() * 4);
  const essayScore = parseFloat(Math.min(10, Math.max(1, essayBase + (firstGenCollege ? -0.5 : 0))).toFixed(1));

  // Legacy status — 77% White per spec
  const isLegacy = r() < (race === 'White' ? 0.13 : 0.03) ? 1 : 0;
  // This creates ~77% White legacy pool when weighted by population

  // Financial aid application — anti-correlated with income
  const appliedFinancialAid = familyIncomeBracket <= 3 ? (r() < 0.82 ? 1 : 0) : (r() < 0.12 ? 1 : 0);

  // Athlete status
  const athleteStatus = r() < 0.06 ? 1 : 0;

  // Merit score (normalized composite)
  const meritScore = (gpa / 4.0) * 35 + (satScore / 1600) * 35 + (extracurricularsScore / 10) * 15 + (essayScore / 10) * 15;

  // Admission decision — inject biases
  let admissionProb;

  if (isLegacy) {
    // Legacy boost: 68% admission regardless of merit
    admissionProb = 0.68;
  } else {
    // Base from merit
    admissionProb = 0.05 + (meritScore / 100) * 0.55;

    // Financial aid penalty
    if (appliedFinancialAid) admissionProb *= 0.56; // 19% vs 34%

    // High school type: public school penalty
    if (highSchoolType === 'Public') admissionProb *= 0.75; // 24% vs 41% private
    else if (highSchoolType === 'Private') admissionProb *= 1.15;

    // Geographic penalty for majority-minority urban zip
    if (zipType === 'Urban Majority-Minority') admissionProb *= 0.65; // 21% vs 38%

    // Athlete boost
    if (athleteStatus) admissionProb = Math.min(admissionProb * 1.5, 0.75);
  }

  admissionProb = Math.max(0.04, Math.min(0.92, admissionProb));
  const admitted = r() < admissionProb ? 1 : 0;

  // Waitlisted
  const waitlisted = admitted === 0 && r() < 0.18 ? 1 : 0;

  applicants.push({
    applicant_id: `APP${String(i + 1).padStart(4, '0')}`,
    gpa,
    sat_score: satScore,
    extracurriculars_score: extracurricularsScore,
    essay_score: essayScore,
    merit_score: parseFloat(meritScore.toFixed(1)),
    legacy_status: isLegacy,
    athlete_status: athleteStatus,
    applied_financial_aid: appliedFinancialAid,
    admitted,
    waitlisted,
    high_school_type: highSchoolType,
    home_zip_code: homeZipCode,
    zip_type: zipType,
    // Sensitive
    race,
    gender,
    first_gen_college: firstGenCollege,
    family_income_bracket: familyIncomeBracket,
  });
}

export const ADMISSIONS_DEMO = applicants;
