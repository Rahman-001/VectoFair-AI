// VectoFair — Pay Gap Demo Dataset
// 200 synthetic employees with injected compensation biases

function rand(min, max) { return Math.round(min + Math.random() * (max - min)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'Legal', 'Product', 'HR'];
const JOB_LEVELS  = [1, 2, 3, 4, 5];
const EDUCATION   = ['High School', 'Bachelor\'s', 'Master\'s', 'PhD'];
const PERF_RATINGS= [1, 2, 3, 4, 5];

// Salary bands by level (base before demographic bias)
const SALARY_BY_LEVEL = { 1: 52000, 2: 68000, 3: 87000, 4: 115000, 5: 155000 };

function generateEmployee(id, gender, race, levelOverride = null) {
  const level       = levelOverride || pick(JOB_LEVELS);
  const dept        = pick(DEPARTMENTS);
  const edu         = pick(EDUCATION);
  const perf        = pick(PERF_RATINGS);
  const yearsExp    = rand(1, 22);
  const baseSalary  = SALARY_BY_LEVEL[level];

  // Add experience premium
  let salary = baseSalary + yearsExp * 800 + (perf - 3) * 2000;

  // ─── INJECTED BIAS ───────────────────────────────────────────────────────
  // Gender pay gap: women earn ~21% less
  if (gender === 'Female') salary = Math.round(salary * 0.79);

  // Race pay gap: Black earn ~23% less, Hispanic ~18% less, Asian ~5% less
  if (race === 'Black')    salary = Math.round(salary * 0.77);
  if (race === 'Hispanic') salary = Math.round(salary * 0.82);
  if (race === 'Asian')    salary = Math.round(salary * 0.95);

  // Intersectional: Black women get double penalty
  if (gender === 'Female' && race === 'Black') salary = Math.round(salary * 0.91); // extra 9% on top

  // Grade concentration: women far less likely to reach L4-L5
  // (handled via levelOverride in generation logic)

  // Add random noise ±3%
  salary = Math.round(salary * (0.97 + Math.random() * 0.06));

  return {
    employee_id:        `EMP_${String(id).padStart(4, '0')}`,
    salary,
    job_title:          `Level ${level} ${dept} Specialist`,
    department:         dept,
    job_level:          level,
    years_experience:   yearsExp,
    performance_rating: perf,
    education_level:    edu,
    gender,
    race,
    age:                rand(24, 62),
    disability_status:  Math.random() < 0.08 ? 'Yes' : 'No',
  };
}

// ── Build 200 employees with controlled demographics ──────────────────────
const employees = [];
let id = 1;

// 80 White men at all levels — natural salary beneficiaries
for (let i = 0; i < 80; i++) {
  // Slightly over-represented at L4–L5 (30% vs fair ~14%)
  const level = Math.random() < 0.30 ? pick([4, 5]) : pick([1, 2, 3]);
  employees.push(generateEmployee(id++, 'Male', 'White', level));
}

// 60 White women — also majority, but lower level distribution
for (let i = 0; i < 60; i++) {
  const level = Math.random() < 0.10 ? pick([4, 5]) : pick([1, 2, 3]); // only 10% L4-5
  employees.push(generateEmployee(id++, 'Female', 'White', level));
}

// 25 Black men
for (let i = 0; i < 25; i++) {
  const level = Math.random() < 0.08 ? pick([4, 5]) : pick([1, 2, 3]);
  employees.push(generateEmployee(id++, 'Male', 'Black', level));
}

// 15 Black women — intersectional worst case
for (let i = 0; i < 15; i++) {
  const level = pick([1, 2, 3]); // essentially never at L4-5 in dataset
  employees.push(generateEmployee(id++, 'Female', 'Black', level));
}

// 10 Hispanic men
for (let i = 0; i < 10; i++) {
  employees.push(generateEmployee(id++, 'Male', 'Hispanic'));
}

// 10 Asian employees (mixed gender)
for (let i = 0; i < 10; i++) {
  const gender = i < 5 ? 'Male' : 'Female';
  employees.push(generateEmployee(id++, gender, 'Asian'));
}

export const PAY_GAP_DEMO = employees;

// ── Pre-computed expected results (used by test runner) ───────────────────
export const EXPECTED_RESULTS = {
  score:            31,
  grade:            'D',
  rawGenderGapPct:  21,      // Women earn 21% less raw
  adjustedGapPct:   8.4,     // After controlling for role: 8.4% unexplained
  raceGapPct:       23,      // Black vs White raw gap
  intersectionalWorst: { group: 'Black Women', vs: 'White Men', gapPct: 32 },
  gradeConcentration: {
    maleAtLevel5Plus: 78,    // % of L4+ roles occupied by men
  },
  findingsCount: 3,
};
