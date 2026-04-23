// VectoFair — Demo Datasets
// Dataset A: TechCorp Hiring (BIASED) — gender & age bias baked in
// Dataset B: EduLoan Fair Dataset (FAIR) — balanced outcomes across demographics

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Dataset A: BIASED ─────────────────────────────────────────────────────────
export function generateBiasedDataset() {
  const rand = seededRandom(42);
  const rows = [];

  for (let i = 0; i < 500; i++) {
    const gender = rand() < 0.52 ? 'Male' : 'Female';
    const age = Math.floor(rand() * 35) + 22; // 22–56
    const yearsExp = Math.max(0, Math.floor(rand() * 20) - (age < 30 ? 8 : 0));
    const uniTier = rand() < 0.3 ? 'Tier 1' : rand() < 0.6 ? 'Tier 2' : 'Tier 3';

    let hireProb = 0.45;

    // Strong gender bias: males +16%, females -11%
    if (gender === 'Male') hireProb += 0.16;
    else hireProb -= 0.11;

    // Age bias: >45 heavy penalty
    if (age > 45) hireProb -= 0.28;
    else if (age < 30) hireProb += 0.05;

    if (yearsExp > 10) hireProb += 0.08;
    else if (yearsExp < 2) hireProb -= 0.1;

    if (uniTier === 'Tier 1') hireProb += 0.1;
    else if (uniTier === 'Tier 3') hireProb -= 0.05;

    hireProb = Math.min(0.95, Math.max(0.05, hireProb));
    const hired = rand() < hireProb ? 1 : 0;

    rows.push({ age, gender, years_experience: yearsExp, university_tier: uniTier, hired });
  }
  return rows;
}

export const BIASED_DEMO_CONFIG = {
  name: 'TechCorp Hiring Dataset',
  description: '500 candidates • Hiring decisions from Q1 2024 • Contains gender & age bias',
  type: 'biased',
  badge: 'Biased Dataset',
  decisionColumn: 'hired',
  sensitiveColumns: ['gender', 'age'],
  columns: ['age', 'gender', 'years_experience', 'university_tier', 'hired'],
  stats: [
    { value: '500', label: 'Candidates' },
    { value: '34%', label: 'Female Hired' },
    { value: '61%', label: 'Male Hired' },
  ],
};

// ── Dataset B: FAIR ───────────────────────────────────────────────────────────
export function generateFairDataset() {
  const rand = seededRandom(99);
  const rows = [];

  for (let i = 0; i < 500; i++) {
    const gender = rand() < 0.50 ? 'Male' : 'Female';
    const age = Math.floor(rand() * 35) + 22;
    const creditScore = Math.floor(rand() * 400) + 400; // 400–800
    const income = Math.floor(rand() * 70000) + 30000;  // 30k–100k
    const loanAmount = Math.floor(rand() * 40000) + 10000;

    // Approval based purely on financial merit — no demographic bias
    let approveProb = 0.4;
    if (creditScore > 700) approveProb += 0.28;
    else if (creditScore > 600) approveProb += 0.12;
    else if (creditScore < 500) approveProb -= 0.15;

    if (income > 70000) approveProb += 0.12;
    else if (income < 40000) approveProb -= 0.08;

    if (loanAmount > 40000) approveProb -= 0.1;
    else if (loanAmount < 20000) approveProb += 0.06;

    // Tiny, tolerable noise — no systematic gender/age tilt
    approveProb += (rand() - 0.5) * 0.04;

    approveProb = Math.min(0.95, Math.max(0.05, approveProb));
    const approved = rand() < approveProb ? 1 : 0;

    rows.push({ age, gender, credit_score: creditScore, annual_income: income, loan_amount: loanAmount, approved });
  }
  return rows;
}

export const FAIR_DEMO_CONFIG = {
  name: 'EduLoan Fair Dataset',
  description: '500 applicants • Loan approvals from Q2 2024 • No demographic bias',
  type: 'fair',
  badge: 'Fair Dataset',
  decisionColumn: 'approved',
  sensitiveColumns: ['gender', 'age'],
  columns: ['age', 'gender', 'credit_score', 'annual_income', 'loan_amount', 'approved'],
  stats: [
    { value: '500', label: 'Applicants' },
    { value: '~50%', label: 'Female Approved' },
    { value: '~51%', label: 'Male Approved' },
  ],
};

// ── Legacy export (used by old handleDemoDataset) ─────────────────────────────
export const generateDemoDataset = generateBiasedDataset;
export const DEMO_CONFIG = BIASED_DEMO_CONFIG;
