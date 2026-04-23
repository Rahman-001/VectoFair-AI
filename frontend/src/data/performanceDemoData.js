// VectoFair — Performance Review Demo Dataset
// 150 employees + biased review texts

function rand(min, max, decimals = 0) {
  const v = min + Math.random() * (max - min);
  return decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── LINGUISTIC BIAS POOLS ─────────────────────────────────────────────────
const AGENTIC_PHRASES = [
  'drove significant results', 'led the initiative', 'owned the outcome',
  'spearheaded the project', 'executed with precision', 'delivered measurable impact',
  'took decisive action', 'championed the strategy', 'commanded the team',
  'transformed the process', 'accelerated delivery', 'won key stakeholder buy-in',
];

const COMMUNAL_PHRASES = [
  'was very supportive of', 'helped the team with', 'assisted in coordinating',
  'was a great team player', 'collaborated effectively', 'offered support to colleagues',
  'was always willing to help', 'contributed to team morale', 'worked well with others',
  'was dependable and cooperative', 'showed good attitude', 'was pleasant to work with',
];

const PERSONALITY_CRITIQUES = [
  'can be difficult at times', 'needs to work on their attitude',
  'sometimes comes across too aggressively', 'can be abrasive in meetings',
  'needs to improve their interpersonal style', 'struggles with team dynamics',
];

const PERFORMANCE_FOCUS = [
  'consistently exceeded targets', 'delivered project on time and under budget',
  'achieved 115% of quota', 'reduced cycle time by 18%',
  'improved system reliability from 97% to 99.9%', 'grew revenue by $1.2M',
];

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'Product'];

function genReview(gender, race, kpi, managerId) {
  const isBiasedManager = managerId === 'MGR_004';

  // Women get communal language; men get agentic language
  const mainPhrase = gender === 'Male'
    ? pick(AGENTIC_PHRASES)
    : pick(COMMUNAL_PHRASES);

  // Minority employees under biased manager also get personality critiques
  const extraPhrase = (isBiasedManager && race !== 'White')
    ? `. However, ${pick(PERSONALITY_CRITIQUES)}`
    : `. ${pick(PERFORMANCE_FOCUS)}`;

  const kpiStatement = `KPI score: ${kpi}/100. `;
  return `${kpiStatement}This employee ${mainPhrase}${extraPhrase}.`;
}

function generateEmployee(id, gender, race, options = {}) {
  const dept       = pick(DEPARTMENTS);
  const tenure     = rand(1, 15);
  const kpiScore   = rand(55, 95);
  const managerId  = options.forceManager || pick(['MGR_001','MGR_002','MGR_003','MGR_004','MGR_005','MGR_006']);

  // ── RAW RATING (with bias) ────────────────────────────────────────────
  // Base from KPI — fair system would do this only
  let baseRating = 1 + (kpiScore / 100) * 4; // maps 0-100 → 1-5

  // BIAS 1: Gender rating gap — men rated 0.6 pts higher for same KPI
  if (gender === 'Female') baseRating -= 0.6;

  // BIAS 2: Manager MGR_004 rates minority employees 0.9 pts lower
  if (managerId === 'MGR_004' && race !== 'White') baseRating -= 0.9;

  // Clamp and round to 1 decimal
  const rating = parseFloat(Math.max(1, Math.min(5, baseRating + rand(-2, 2, 1))).toFixed(1));

  // ── POST-LEAVE BIAS ───────────────────────────────────────────────────
  const onParentalLeaveLastYear = Math.random() < (gender === 'Female' ? 0.18 : 0.08);
  let preLeaveRating = null;
  if (onParentalLeaveLastYear) {
    // Women's ratings drop 0.6 post-leave; men's unchanged
    preLeaveRating = gender === 'Female'
      ? parseFloat(Math.min(5, rating + 0.6).toFixed(1))
      : rating;
  }

  return {
    employee_id:              `EMP_${String(id).padStart(4,'0')}`,
    manager_id:               managerId,
    rating,
    pre_leave_rating:         preLeaveRating,
    on_parental_leave:        onParentalLeaveLastYear,
    department:               dept,
    tenure_years:             tenure,
    kpi_score:                kpiScore,
    review_text:              genReview(gender, race, kpiScore, managerId),
    gender,
    race,
    age:                      rand(24, 59),
    disability_status:        Math.random() < 0.07 ? 'Yes' : 'No',
  };
}

const employees = [];
let id = 1;

// White men — rated fairly (beneficiaries)
for (let i = 0; i < 40; i++) {
  const mgr = i < 8 ? 'MGR_004' : undefined; // MGR_004 rates White men fairly
  employees.push(generateEmployee(id++, 'Male', 'White', { forceManager: mgr }));
}

// White women — communal language, lower ratings despite same KPI
for (let i = 0; i < 35; i++) {
  employees.push(generateEmployee(id++, 'Female', 'White'));
}

// Black men — some under MGR_004
for (let i = 0; i < 25; i++) {
  const mgr = i < 8 ? 'MGR_004' : undefined;
  employees.push(generateEmployee(id++, 'Male', 'Black', { forceManager: mgr }));
}

// Black women — double penalty
for (let i = 0; i < 20; i++) {
  const mgr = i < 6 ? 'MGR_004' : undefined;
  employees.push(generateEmployee(id++, 'Female', 'Black', { forceManager: mgr }));
}

// Hispanic employees (mixed)
for (let i = 0; i < 20; i++) {
  const gender = i < 10 ? 'Male' : 'Female';
  employees.push(generateEmployee(id++, gender, 'Hispanic'));
}

// Asian employees (mixed)
for (let i = 0; i < 10; i++) {
  const gender = i < 5 ? 'Male' : 'Female';
  employees.push(generateEmployee(id++, gender, 'Asian'));
}

export const PERFORMANCE_DEMO = employees;

export const EXPECTED_RESULTS = {
  score:             27,
  grade:             'F',
  womenAvgRating:    3.1,
  menAvgRating:      3.7,
  ratingGap:         0.6,
  biasedManagerId:   'MGR_004',
  managerDisparity:  0.9,
  postLeaveDropF:    0.6, // women's post-leave drop
  postLeaveDropM:    0.0, // men unchanged
  linguisticBias:    true,
  findingsCount:     4,
};
