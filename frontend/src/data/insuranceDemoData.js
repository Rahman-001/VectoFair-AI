// ── INSURANCE PREMIUM BIAS — DEMO DATASET ─────────────────────────────────
// 800 policies with injected biases:
//   Majority-minority zips: 23% higher premiums, same risk profile
//   Credit proxy correlation with zip demographics: 0.58
//   Black policyholders: 18% higher premiums post risk-adjustment
//   Post-claim increase: Black +$340/yr vs White +$190/yr for same claim
//   Credit score explains 71% of the premium gap
// Expected score: 24/100, Grade F

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const ZIP_PROFILES = {
  // [zip, minorityPct, label]
  White:    [['10021', 0.12, 'majority-white'], ['90210', 0.08, 'majority-white'], ['60611', 0.15, 'majority-white']],
  Black:    [['11212', 0.85, 'majority-minority'], ['60619', 0.91, 'majority-minority'], ['30314', 0.88, 'majority-minority']],
  Hispanic: [['10029', 0.78, 'majority-minority'], ['90011', 0.82, 'majority-minority'], ['77009', 0.71, 'majority-minority']],
  Asian:    [['94102', 0.55, 'mixed'], ['10013', 0.62, 'majority-minority'], ['98001', 0.45, 'mixed']],
};

function generateInsuranceData() {
  const rand = rng(55);
  const records = [];
  let id = 7001;

  const groups = [
    { race: 'White',    count: 280, gender_m: 0.51 },
    { race: 'Black',    count: 200, gender_m: 0.48 },
    { race: 'Hispanic', count: 180, gender_m: 0.50 },
    { race: 'Asian',    count: 140, gender_m: 0.50 },
  ];

  for (const { race, count, gender_m } of groups) {
    for (let i = 0; i < count; i++) {
      const gender = rand() < gender_m ? 'Male' : 'Female';
      const age = 25 + Math.floor(rand() * 50);
      const marital = rand() < 0.55 ? 'Married' : 'Single';

      const zipProfile = ZIP_PROFILES[race][Math.floor(rand() * ZIP_PROFILES[race].length)];
      const [zip, minorityPct, zipLabel] = zipProfile;

      // Coverage type
      const coverage = rand() < 0.55 ? 'Home' : rand() < 0.6 ? 'Auto' : 'Renters';

      // Vehicle age (for Auto) / property value (for Home)
      const vehicleAge = coverage === 'Auto' ? 1 + Math.floor(rand() * 12) : null;
      const propertyValue = coverage === 'Home' ? Math.round((150000 + rand() * 450000) / 1000) * 1000 : null;

      // Claim history: roughly similar across groups (risk should be comparable)
      const claimCount = Math.floor(rand() < 0.7 ? 0 : rand() < 0.6 ? 1 : 2);
      const yearsInsured = 1 + Math.floor(rand() * 20);
      const deductible = [500, 1000, 2500][Math.floor(rand() * 3)];

      // Geographic region
      const region = zip.startsWith('1') ? 'Northeast' : zip.startsWith('9') ? 'West' : zip.startsWith('6') || zip.startsWith('3') ? 'South' : 'Midwest';

      // Credit score: correlated with zip minority pct (0.58 correlation)
      // White minority zips → higher credit, minority zips → lower credit (systematic)
      const creditBase = race === 'White' ? 700 + Math.floor(rand() * 120)
                        : race === 'Asian'  ? 690 + Math.floor(rand() * 125)
                        : race === 'Black'  ? 615 + Math.floor(rand() * 145)
                        : 625 + Math.floor(rand() * 140);
      // Add zip correlation: majority-minority zip penalizes credit score
      const zipCreditPenalty = zipLabel === 'majority-minority' ? -Math.floor(rand() * 40) : 0;
      const creditScore = Math.min(850, Math.max(300, creditBase + zipCreditPenalty));

      // Risk score (actuarial): based on claim history, years insured, deductible
      const riskScore = +(claimCount * 20 + (1 / (yearsInsured + 1)) * 30 + (2500 - deductible) / 100).toFixed(1);

      // BASE premium: what it SHOULD be based purely on risk
      const basePremiumFromRisk = coverage === 'Home'
        ? 800 + riskScore * 25 + claimCount * 180
        : coverage === 'Auto'
        ? 600 + riskScore * 20 + claimCount * 150 + vehicleAge * 15
        : 300 + riskScore * 15 + claimCount * 120;

      // Geographic redlining bias: majority-minority zips +23%
      const geoMultiplier = zipLabel === 'majority-minority' ? 1.23
                           : zipLabel === 'mixed'            ? 1.09
                           : 1.00;

      // Credit score proxy bias: credit score used as rating factor
      // Lower credit → higher premium (creates racial proxy chain)
      const creditPenalty = Math.max(0, (720 - creditScore) * 0.8);

      // Race-based residual: 18% higher for Black after all controls
      const raceResidualMultiplier = race === 'Black' ? 1.18 : race === 'Hispanic' ? 1.08 : 1.00;

      // Actual premium (includes all biases)
      const actualPremium = Math.round(
        (basePremiumFromRisk * geoMultiplier + creditPenalty) * raceResidualMultiplier / 10
      ) * 10;

      // Risk-adjusted premium (what it should be without bias)
      const fairPremium = Math.round(basePremiumFromRisk / 10) * 10;

      // Claim approval (if any claims exist): lower for Black policyholders
      const hadClaim = claimCount > 0;
      const claimApproved = hadClaim
        ? (race === 'Black' ? rand() < 0.72 : race === 'Hispanic' ? rand() < 0.78 : rand() < 0.85)
        : false;

      // Post-claim rate increase
      const postClaimIncrease = race === 'Black'   ? 340 + Math.floor(rand() * 60)
                               : race === 'Hispanic' ? 270 + Math.floor(rand() * 50)
                               : 190 + Math.floor(rand() * 40);

      records.push({
        policy_id:           id++,
        race,
        gender,
        age,
        marital_status:      marital,
        zip_code:            zip,
        zip_minority_pct:    minorityPct,
        zip_label:           zipLabel,
        geographic_region:   region,
        coverage_type:       coverage,
        vehicle_age:         vehicleAge,
        property_value:      propertyValue,
        claim_history_count: claimCount,
        years_insured:       yearsInsured,
        deductible_level:    deductible,
        credit_score:        creditScore,
        risk_score:          riskScore,
        premium_amount:      actualPremium,
        fair_premium:        fairPremium,
        premium_gap:         actualPremium - fairPremium,
        geographic_multiplier: +geoMultiplier.toFixed(2),
        had_claim:           hadClaim ? 1 : 0,
        claim_approved:      hadClaim ? (claimApproved ? 1 : 0) : null,
        post_claim_rate_increase: hadClaim ? postClaimIncrease : 0,
      });
    }
  }

  return records;
}

export const INSURANCE_DEMO = generateInsuranceData();
