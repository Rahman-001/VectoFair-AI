// ── FRAUD FLAG DISPARITY — DEMO DATASET ──────────────────────────────────
// 5,000 transactions with injected biases:
//   Black FPR: 8.2%, White: 3.1%, Hispanic: 6.7%
//   Legitimate transactions >$500 from Black cardholders: flagged 12.4% vs White 4.1%
//   FNR roughly equal across groups
//   Cascading harm: 2,300 Black customers affected, $340/yr

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const MERCHANT_CATS = ['Grocery', 'Gas', 'Restaurant', 'Travel', 'Electronics', 'Retail', 'Healthcare'];
const DEVICES = ['Mobile App', 'Physical Card', 'Web Browser', 'ATM'];
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Late Night'];

function generateFraudData() {
  const rand = rng(77);
  const records = [];
  let txId = 90001;

  // Distribution: 1750 White, 1300 Black, 1150 Hispanic, 800 Asian
  const groups = [
    { race: 'White',    count: 1750, baseFraudRate: 0.035, baseFPR: 0.031 },
    { race: 'Black',    count: 1300, baseFraudRate: 0.034, baseFPR: 0.082 },
    { race: 'Hispanic', count: 1150, baseFraudRate: 0.033, baseFPR: 0.067 },
    { race: 'Asian',    count:  800, baseFraudRate: 0.032, baseFPR: 0.038 },
  ];

  for (const { race, count, baseFraudRate, baseFPR } of groups) {
    for (let i = 0; i < count; i++) {
      const gender = rand() < 0.50 ? 'Male' : 'Female';
      const age = 21 + Math.floor(rand() * 55);
      const tenure = +(1 + rand() * 12).toFixed(1);

      // Transaction amount: $5–$2000
      const amount = Math.round((5 + rand() * 1995) * 100) / 100;
      const isHighValue = amount > 500;

      const merchant = MERCHANT_CATS[Math.floor(rand() * MERCHANT_CATS.length)];
      const device = DEVICES[Math.floor(rand() * DEVICES.length)];
      const timeOfDay = TIMES[Math.floor(rand() * TIMES.length)];

      const zip = race === 'White' ? ['10021', '90210'][Math.floor(rand() * 2)]
                : race === 'Black'  ? ['11212', '60619'][Math.floor(rand() * 2)]
                : race === 'Hispanic' ? ['10029', '90011'][Math.floor(rand() * 2)]
                : ['94102', '10013'][Math.floor(rand() * 2)];

      // Is this a genuinely fraudulent transaction?
      const confirmedFraud = rand() < baseFraudRate ? 1 : 0;

      let flaggedAsFraud;

      if (confirmedFraud === 1) {
        // True fraud: most should be caught (FNR ~25% across all groups — roughly equal)
        flaggedAsFraud = rand() < 0.75 ? 1 : 0;
      } else {
        // Legitimate transaction: apply group-specific false positive rate
        // For high-value transactions, Black cardholders have 12.4% FP rate vs White 4.1%
        let fpr = baseFPR;
        if (isHighValue) {
          if (race === 'Black') fpr = 0.124;
          else if (race === 'White') fpr = 0.041;
          else if (race === 'Hispanic') fpr = 0.085;
          else fpr = 0.044;
        }
        flaggedAsFraud = rand() < fpr ? 1 : 0;
      }

      records.push({
        transaction_id:       txId++,
        cardholder_race:      race,
        cardholder_gender:    gender,
        cardholder_age:       age,
        zip_code:             zip,
        account_tenure_years: tenure,
        transaction_amount:   amount,
        merchant_category:    merchant,
        time_of_day:          timeOfDay,
        device_type:          device,
        is_high_value:        isHighValue ? 1 : 0,
        flagged_as_fraud:     flaggedAsFraud,
        confirmed_fraud:      confirmedFraud,
      });
    }
  }

  return records;
}

export const FRAUD_DEMO = generateFraudData();

// Helper: pre-compute group metrics
export function computeFraudMetrics(data) {
  const groups = {};

  for (const tx of data) {
    const g = tx.cardholder_race;
    if (!groups[g]) groups[g] = { TP: 0, FP: 0, TN: 0, FN: 0, total: 0, flagged: 0 };

    const cf = tx.confirmed_fraud;
    const fl = tx.flagged_as_fraud;

    if (cf === 1 && fl === 1) groups[g].TP++;
    else if (cf === 0 && fl === 1) groups[g].FP++;
    else if (cf === 0 && fl === 0) groups[g].TN++;
    else groups[g].FN++;

    groups[g].total++;
    if (fl === 1) groups[g].flagged++;
  }

  const result = {};
  for (const [race, m] of Object.entries(groups)) {
    const legitimate = m.TN + m.FP;
    const fraud = m.TP + m.FN;
    const fpr = legitimate > 0 ? m.FP / legitimate : 0;
    const fnr = fraud > 0 ? m.FN / fraud : 0;
    const precision = (m.TP + m.FP) > 0 ? m.TP / (m.TP + m.FP) : 1;
    result[race] = { ...m, fpr: +fpr.toFixed(4), fnr: +fnr.toFixed(4), precision: +precision.toFixed(4) };
  }
  return result;
}
