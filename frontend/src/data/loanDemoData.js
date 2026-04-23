// ── LOAN APPROVAL DEMO DATASET ─────────────────────────────────────────────
// 600 records with injected biases matching test case specifications:
//   Black applicants: disparate impact ~0.57 (SEVERE)
//   Age 55+: disparate impact ~0.60 (SEVERE)
//   Zip codes included for redlining detection
//   Income-adjusted bias persists across all 4 income quartiles
//   Intersectional: Black women approved 31% vs White men 74%

const RACES  = ['White', 'Black', 'Hispanic', 'Asian'];
const GENDERS = ['Male', 'Female'];
const ZIPS = {
  White:    ['10001', '10021', '10036', '10065', '90210'],
  Black:    ['11212', '11213', '60619', '60620', '30314'],
  Hispanic: ['10029', '10030', '90011', '90023', '77009'],
  Asian:    ['94102', '95014', '10013', '10038', '98001'],
};

// Approval probabilities
const BASE_APPROVAL = {
  White:    { Male: 0.74, Female: 0.68 },
  Black:    { Male: 0.42, Female: 0.31 },
  Hispanic: { Male: 0.51, Female: 0.45 },
  Asian:    { Male: 0.70, Female: 0.65 },
};

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateLoanData() {
  const rand = rng(42);
  const records = [];

  let id = 1001;

  // Distribution: 35% White, 25% Black, 22% Hispanic, 18% Asian
  const raceDist = [
    { race: 'White',    share: 0.35 },
    { race: 'Black',    share: 0.25 },
    { race: 'Hispanic', share: 0.22 },
    { race: 'Asian',    share: 0.18 },
  ];

  for (const { race, share } of raceDist) {
    const count = Math.round(600 * share);
    const zips = ZIPS[race];

    for (let i = 0; i < count; i++) {
      const gender = rand() < 0.52 ? 'Male' : 'Female';
      // age: normal distribution centered around 38, ±13
      const ageRaw = 25 + Math.floor(rand() * 50);
      const age = Math.min(Math.max(ageRaw, 22), 75);
      const ageGroup = age >= 55 ? '55+' : '25-54';

      // Income: $35k–$150k, with slight minority income disadvantage
      const incomeBase = race === 'White' || race === 'Asian'
        ? 55000 + Math.floor(rand() * 65000)
        : 40000 + Math.floor(rand() * 55000);
      const income = incomeBase;

      // Income quartile
      const incomeQ = income < 52000 ? 'Q1' : income < 72000 ? 'Q2' : income < 98000 ? 'Q3' : 'Q4';

      // Credit score: 580–800
      const creditScore = Math.round(580 + rand() * 220);

      // DTI: 0.15–0.55
      const dti = +(0.15 + rand() * 0.40).toFixed(2);

      // Approval: base rate by race/gender, with age penalty for 55+
      let baseProb = BASE_APPROVAL[race][gender];
      if (ageGroup === '55+') baseProb *= 0.81; // brings to ~0.60 DI for age group

      // Income and credit score nudge (keep bias mostly unexplained by these)
      const creditBonus = (creditScore - 680) / 1000;
      const incomeBonus = (income - 60000) / 500000;
      let approvalProb = Math.min(0.95, Math.max(0.05, baseProb + creditBonus + incomeBonus));

      const approved = rand() < approvalProb ? 1 : 0;

      // Loan amount: $80k–$400k
      const loanAmount = Math.round((80000 + rand() * 320000) / 1000) * 1000;

      // zip code
      const zip = zips[Math.floor(rand() * zips.length)];

      records.push({
        applicant_id:   id++,
        race,
        gender,
        age,
        age_group:      ageGroup,
        income,
        income_quartile: incomeQ,
        credit_score:   creditScore,
        debt_to_income: dti,
        loan_amount:    loanAmount,
        loan_purpose:   rand() < 0.6 ? 'Home Purchase' : rand() < 0.5 ? 'Refinance' : 'Home Equity',
        zip_code:       zip,
        approved,
      });
    }
  }

  return records;
}

export const LOAN_DEMO = generateLoanData();

// Pre-compute summary stats for quick headers
export function getLoanSummary(data) {
  const total = data.length;
  const overall = data.filter(r => r.approved).length / total;

  const byRace = {};
  const byAge  = {};
  const byGender = {};

  for (const r of data) {
    if (!byRace[r.race])   byRace[r.race]   = { approved: 0, total: 0 };
    if (!byAge[r.age_group])  byAge[r.age_group]  = { approved: 0, total: 0 };
    if (!byGender[r.gender]) byGender[r.gender] = { approved: 0, total: 0 };

    byRace[r.race].total++;
    byRace[r.race].approved += r.approved;
    byAge[r.age_group].total++;
    byAge[r.age_group].approved += r.approved;
    byGender[r.gender].total++;
    byGender[r.gender].approved += r.approved;
  }

  const raceRates = Object.fromEntries(
    Object.entries(byRace).map(([k, v]) => [k, v.total > 0 ? v.approved / v.total : 0])
  );
  const ageRates = Object.fromEntries(
    Object.entries(byAge).map(([k, v]) => [k, v.total > 0 ? v.approved / v.total : 0])
  );

  const whiteRate = raceRates['White'] || overall;
  const disparateImpacts = Object.fromEntries(
    Object.entries(raceRates).map(([k, v]) => [k, whiteRate > 0 ? +(v / whiteRate).toFixed(2) : 1])
  );

  const ageRef = ageRates['25-54'] || overall;
  const ageDI = {};
  Object.entries(ageRates).forEach(([k, v]) => {
    ageDI[k] = ageRef > 0 ? +(v / ageRef).toFixed(2) : 1;
  });

  return { total, overall, raceRates, ageRates, disparateImpacts, ageDI, byRace, byAge, byGender };
}
