// VectoFair — Promotion Pipeline Demo Dataset
// 300 synthetic employees with injected promotion biases

function rand(min, max) { return Math.round(min + Math.random() * (max - min)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const DEPARTMENTS   = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'Product'];
const PERF_RATINGS  = ['Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];
const PERF_MAP      = { 'Needs Improvement': 1, 'Meets Expectations': 2, 'Exceeds Expectations': 3, 'Outstanding': 4 };

function addMonths(baseDate, months) {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function generateEmployee(id, gender, race, options = {}) {
  const dept         = pick(DEPARTMENTS);
  const hireYearsAgo = rand(2, 12);
  const hireDate     = new Date();
  hireDate.setFullYear(hireDate.getFullYear() - hireYearsAgo);
  const hireDateStr  = hireDate.toISOString().split('T')[0];

  const perfRating   = options.perfRating || pick(PERF_RATINGS);
  const perfScore    = PERF_MAP[perfRating];
  const currentLevel = options.level || Math.min(5, Math.max(1, perfScore + rand(-1, 1)));

  // ── INJECTED BIAS: TIME TO FIRST PROMOTION ───────────────────────────────
  // White men: fast-tracked — avg 14 months to L2
  // Women: avg 22 months (38% slower)
  // Black employees: avg 22 months
  let baseMonthsToFirstPromo = 14;
  if (gender === 'Female')   baseMonthsToFirstPromo = 22;
  if (race   === 'Black')    baseMonthsToFirstPromo = 22;
  if (race   === 'Hispanic') baseMonthsToFirstPromo = 20;
  baseMonthsToFirstPromo += rand(-3, 3);

  // ── INJECTED BIAS: PROMOTION RATE ────────────────────────────────────────
  // Men promoted 29%/yr, Women 18%/yr (38% disparity)
  const annualPromoRate = (gender === 'Male' && race === 'White') ? 0.29
    : (gender === 'Female') ? 0.18
    : 0.21;

  const promotionsExpected = Math.floor(hireYearsAgo * annualPromoRate);
  const promotionDates     = [];
  let   cursor             = baseMonthsToFirstPromo;
  for (let p = 0; p < promotionsExpected && cursor < hireYearsAgo * 12; p++) {
    promotionDates.push(addMonths(hireDateStr, cursor));
    cursor += rand(10, 18);
  }

  // ── INJECTED BIAS: PERFORMANCE-ADJUSTED PROMOTION GAP ───────────────────
  // Women with "Exceeds" are promoted 38% less often than men with same rating
  // Simulate by capping female "Exceeds" employees' promotions
  let promoDatesFinal = promotionDates;
  if (gender === 'Female' && perfRating === 'Exceeds Expectations' && Math.random() < 0.38) {
    promoDatesFinal = promotionDates.slice(0, Math.max(0, promotionDates.length - 1));
  }

  // ── INJECTED BIAS: PIPELINE LEAK AT L4 ───────────────────────────────────
  // Women make up 45% at L1-L3, but only 19% at L4-L5
  // This is enforced by level override in generation

  return {
    employee_id:        `EMP_${String(id).padStart(4, '0')}`,
    hire_date:          hireDateStr,
    promotion_dates:    promoDatesFinal.join(','),
    promotion_count:    promoDatesFinal.length,
    months_to_first_promotion: promoDatesFinal.length > 0 ? baseMonthsToFirstPromo : null,
    current_level:      currentLevel,
    department:         dept,
    performance_rating: perfRating,
    gender,
    race,
    age:                rand(24, 58),
    parental_status:    Math.random() < 0.35 ? 'Parent' : 'Non-parent',
    disability_status:  Math.random() < 0.06 ? 'Yes' : 'No',
  };
}

const employees = [];
let id = 1;

// White men — natural beneficiaries, overrepresented at L4-5
for (let i = 0; i < 80; i++) {
  const level       = Math.random() < 0.35 ? pick([4, 5]) : pick([1, 2, 3]);
  const perfRating  = Math.random() < 0.5 ? 'Exceeds Expectations' : pick(['Meets Expectations','Outstanding']);
  employees.push(generateEmployee(id++, 'Male', 'White', { level, perfRating }));
}

// White women — represented at L1-3, rare at L4-5
for (let i = 0; i < 70; i++) {
  const level      = Math.random() < 0.10 ? pick([4, 5]) : pick([1, 2, 3]);
  const perfRating = Math.random() < 0.5 ? 'Exceeds Expectations' : pick(['Meets Expectations']);
  employees.push(generateEmployee(id++, 'Female', 'White', { level, perfRating }));
}

// Black men
for (let i = 0; i < 40; i++) {
  const level = Math.random() < 0.08 ? pick([4, 5]) : pick([1, 2, 3]);
  employees.push(generateEmployee(id++, 'Male', 'Black', { level }));
}

// Black women
for (let i = 0; i < 35; i++) {
  const level = pick([1, 2, 3]); // rarely promoted past L3
  employees.push(generateEmployee(id++, 'Female', 'Black', { level }));
}

// Hispanic employees (mixed)
for (let i = 0; i < 40; i++) {
  const gender = i < 20 ? 'Male' : 'Female';
  const level  = i < 10 ? pick([3, 4]) : pick([1, 2, 3]);
  employees.push(generateEmployee(id++, gender, 'Hispanic', { level }));
}

// Asian employees (mixed)
for (let i = 0; i < 35; i++) {
  const gender = i < 18 ? 'Male' : 'Female';
  employees.push(generateEmployee(id++, gender, 'Asian'));
}

export const PROMOTION_DEMO = employees;

export const EXPECTED_RESULTS = {
  score:              28,
  grade:              'F',
  malePromoRate:      0.29,   // promotions per year
  femalePromoRate:    0.18,
  rateGapPct:         38,     // (0.29-0.18)/0.29 = 38%
  blackMonthsToPromo: 22,
  whiteMonthsToPromo: 14,
  timeGapMonths:      8,
  pipelineLeakLevel:  4,      // representation drops sharply at L4
  findingsCount:      3,
};
