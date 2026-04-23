// ── CREDIT LIMIT FAIRNESS — DEMO DATASET ─────────────────────────────────
// 400 customers with injected biases:
//   Black 720-739 band: avg $6,200 vs White $8,400 (gap $2,200)
//   Hispanic Q2 income: avg $4,800 vs White $6,900
//   Limit increase frequency: White 2.1x vs Black 1.2x per 3 years
// Expected score: 34/100

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateCreditLimitData() {
  const rand = rng(99);
  const records = [];
  let id = 5001;

  const config = [
    { race: 'White',    count: 140 },
    { race: 'Black',    count: 110 },
    { race: 'Hispanic', count:  90 },
    { race: 'Asian',    count:  60 },
  ];

  // Credit score band base limits (White reference)
  const bandBaseLimits = {
    '300-579': 1800,
    '580-669': 4200,
    '670-739': 8400,  // White reference in 720-739
    '740-799': 12500,
    '800-850': 18000,
  };

  // Race modifiers within same band
  const raceModifiers = {
    White:    1.00,
    Black:    0.74,  // $6,200 / $8,400 in 720-739 band
    Hispanic: 0.85,
    Asian:    0.97,
  };

  for (const { race, count } of config) {
    for (let i = 0; i < count; i++) {
      const gender = rand() < 0.51 ? 'Male' : 'Female';
      const age = 22 + Math.floor(rand() * 48);
      const marital = rand() < 0.55 ? 'Married' : rand() < 0.5 ? 'Single' : 'Other';

      // Credit score with slight demographic correlation (realistic)
      const baseScore = race === 'White' ? 670 + Math.floor(rand() * 170)
                      : race === 'Asian'  ? 660 + Math.floor(rand() * 175)
                      : race === 'Black'  ? 620 + Math.floor(rand() * 185)
                      : 625 + Math.floor(rand() * 180);
      const creditScore = Math.min(850, Math.max(300, baseScore));

      // Determine band
      let band;
      if (creditScore < 580) band = '300-579';
      else if (creditScore < 670) band = '580-669';
      else if (creditScore < 740) band = '670-739';
      else if (creditScore < 800) band = '740-799';
      else band = '800-850';

      // Income
      const incomeBase = race === 'White' || race === 'Asian'
        ? 50000 + Math.floor(rand() * 70000)
        : 38000 + Math.floor(rand() * 60000);
      const income = incomeBase;
      const incomeQ = income < 50000 ? 'Q1' : income < 72000 ? 'Q2' : income < 100000 ? 'Q3' : 'Q4';

      // DTI
      const dti = +(0.12 + rand() * 0.38).toFixed(2);

      // Payment history score (0-100)
      const paymentHistory = Math.round(60 + rand() * 40);

      // Account age
      const accountAge = 6 + Math.floor(rand() * 150);

      // Credit limit: base from band, modified by race bias
      const baseLimitForBand = bandBaseLimits[band];
      // Q2 income Hispanic override: $4,800 avg vs White $6,900
      let modifier = raceModifiers[race];
      if (race === 'Hispanic' && incomeQ === 'Q2') modifier = 0.696; // 4800/6900

      // Add random noise ±15%
      const noise = 0.85 + rand() * 0.30;
      const creditLimit = Math.round(baseLimitForBand * modifier * noise / 100) * 100;

      // Limit increase frequency per 3 years
      const increaseFreq = race === 'White' ? 1.6 + rand() * 1.0
                         : race === 'Black'  ? 0.8 + rand() * 0.8
                         : race === 'Asian'  ? 1.4 + rand() * 0.9
                         : 1.0 + rand() * 0.8;

      // Utilization (realistic: lower limit → forced higher utilization)
      const spendingNeed = 2000 + rand() * 4000; // realistic monthly spend need
      const utilization = Math.min(0.95, spendingNeed / Math.max(creditLimit, 500));

      // Projected credit score impact from utilization
      const utilizationPenalty = utilization > 0.3
        ? Math.round((utilization - 0.3) * 60) // rough model
        : 0;

      const zip = race === 'White' ? ['10021', '90210', '60611'][Math.floor(rand() * 3)]
                : race === 'Black'  ? ['11212', '60619', '30314'][Math.floor(rand() * 3)]
                : race === 'Hispanic' ? ['10029', '90011', '77009'][Math.floor(rand() * 3)]
                : ['94102', '10013', '98001'][Math.floor(rand() * 3)];

      records.push({
        customer_id:           id++,
        race,
        gender,
        age,
        marital_status:        marital,
        zip_code:              zip,
        credit_score:          creditScore,
        credit_score_band:     band,
        income,
        income_quartile:       incomeQ,
        debt_to_income:        dti,
        payment_history_score: paymentHistory,
        account_age_months:    accountAge,
        credit_limit:          creditLimit,
        limit_increase_count:  +(increaseFreq).toFixed(1),
        utilization_rate:      +utilization.toFixed(3),
        utilization_penalty_pts: utilizationPenalty,
      });
    }
  }

  return records;
}

export const CREDIT_LIMIT_DEMO = generateCreditLimitData();
