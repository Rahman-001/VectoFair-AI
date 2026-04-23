// VectoFair — Bias Calculator
// Computes demographic parity, equal opportunity, and disparate impact

/**
 * Get unique values for a column
 */
function getGroups(data, column) {
  return [...new Set(data.map((r) => String(r[column])))];
}

/**
 * Positive decision rate for a specific group
 */
function positiveRate(data, decisionCol, sensitiveCol, groupValue) {
  const group = data.filter((r) => String(r[sensitiveCol]) === groupValue);
  if (group.length === 0) return 0;
  const positive = group.filter((r) => Number(r[decisionCol]) === 1).length;
  return positive / group.length;
}

/**
 * Demographic Parity — difference in positive decision rate between groups
 */
export function calculateDemographicParity(data, decisionCol, sensitiveCol) {
  const groups = getGroups(data, sensitiveCol);
  const rates = {};
  groups.forEach((g) => {
    rates[g] = positiveRate(data, decisionCol, sensitiveCol, g);
  });

  const values = Object.values(rates);
  const maxRate = Math.max(...values);
  const minRate = Math.min(...values);
  const disparity = maxRate - minRate;

  // Find which groups have max/min
  const maxGroup = Object.keys(rates).find((k) => rates[k] === maxRate);
  const minGroup = Object.keys(rates).find((k) => rates[k] === minRate);

  return {
    metric: 'Demographic Parity',
    disparity: parseFloat(disparity.toFixed(4)),
    maxGroup,
    minGroup,
    maxRate: parseFloat(maxRate.toFixed(4)),
    minRate: parseFloat(minRate.toFixed(4)),
    groupRates: rates,
    verdict: disparity > 0.2 ? 'SEVERE BIAS' : disparity > 0.1 ? 'MILD BIAS' : 'FAIR',
    description:
      'Difference in positive decision rate between demographic groups. A value of 0 is ideal.',
  };
}

/**
 * Disparate Impact Ratio — 80% rule
 * DI = min(P(Y=1|A), P(Y=1|B)) / max(P(Y=1|A), P(Y=1|B))
 * Flag as biased if < 0.8
 */
export function calculateDisparateImpact(data, decisionCol, sensitiveCol) {
  const groups = getGroups(data, sensitiveCol);
  const rates = {};
  groups.forEach((g) => {
    rates[g] = positiveRate(data, decisionCol, sensitiveCol, g);
  });

  const values = Object.values(rates);
  const maxRate = Math.max(...values);
  const minRate = Math.min(...values);

  const ratio = maxRate === 0 ? 0 : parseFloat((minRate / maxRate).toFixed(4));

  const maxGroup = Object.keys(rates).find((k) => rates[k] === maxRate);
  const minGroup = Object.keys(rates).find((k) => rates[k] === minRate);

  return {
    metric: 'Disparate Impact Ratio',
    ratio,
    disparity: parseFloat((maxRate - minRate).toFixed(4)),
    maxGroup,
    minGroup,
    maxRate: parseFloat(maxRate.toFixed(4)),
    minRate: parseFloat(minRate.toFixed(4)),
    groupRates: rates,
    verdict: ratio < 0.5 ? 'SEVERE BIAS' : ratio < 0.8 ? 'MILD BIAS' : 'FAIR',
    description:
      'Ratio of positive rates between groups. Values below 0.8 violate the "80% rule" of equal employment law.',
  };
}

/**
 * Equal Opportunity — difference in true positive rate
 * (requires a ground truth column; if none provided, uses decision col as proxy)
 */
export function calculateEqualOpportunity(data, decisionCol, sensitiveCol) {
  // For datasets without separate ground truth, we compute
  // the positive rate as a proxy (same as demographic parity but framed differently)
  const groups = getGroups(data, sensitiveCol);
  const rates = {};
  groups.forEach((g) => {
    rates[g] = positiveRate(data, decisionCol, sensitiveCol, g);
  });

  const values = Object.values(rates);
  const maxRate = Math.max(...values);
  const minRate = Math.min(...values);
  const disparity = maxRate - minRate;

  const maxGroup = Object.keys(rates).find((k) => rates[k] === maxRate);
  const minGroup = Object.keys(rates).find((k) => rates[k] === minRate);

  return {
    metric: 'Equal Opportunity',
    disparity: parseFloat(disparity.toFixed(4)),
    maxGroup,
    minGroup,
    maxRate: parseFloat(maxRate.toFixed(4)),
    minRate: parseFloat(minRate.toFixed(4)),
    groupRates: rates,
    verdict: disparity > 0.2 ? 'SEVERE BIAS' : disparity > 0.1 ? 'MILD BIAS' : 'FAIR',
    description:
      'Difference in opportunity to receive positive decisions across groups. Equal opportunity requires all groups to have similar positive rates.',
  };
}

/**
 * Run all three metrics for a given sensitive attribute
 */
export function analyzeAttribute(data, decisionCol, sensitiveCol) {
  const dp = calculateDemographicParity(data, decisionCol, sensitiveCol);
  const di = calculateDisparateImpact(data, decisionCol, sensitiveCol);
  const eo = calculateEqualOpportunity(data, decisionCol, sensitiveCol);

  // Aggregate severity
  const verdicts = [dp.verdict, di.verdict, eo.verdict];
  const overallVerdict = verdicts.includes('SEVERE BIAS')
    ? 'SEVERE BIAS'
    : verdicts.includes('MILD BIAS')
    ? 'MILD BIAS'
    : 'FAIR';

  return {
    attribute: sensitiveCol,
    metrics: [dp, di, eo],
    overallVerdict,
    groupRates: dp.groupRates,
  };
}

/**
 * Compute overall fairness score (0-100) and grade
 */
export function computeOverallFairnessScore(findings) {
  if (!findings || findings.length === 0) return { score: 100, grade: 'A' };

  // Score each finding
  let totalPenalty = 0;
  let metricCount = 0;

  findings.forEach((finding) => {
    finding.metrics.forEach((metric) => {
      metricCount++;
      if (metric.verdict === 'SEVERE BIAS') totalPenalty += 25;
      else if (metric.verdict === 'MILD BIAS') totalPenalty += 12;
    });
  });

  const avgPenalty = metricCount > 0 ? totalPenalty / metricCount : 0;
  const score = Math.max(0, Math.round(100 - avgPenalty * 2.5));

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 55) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Auto-detect column type from values
 */
export function detectColumnTypes(data, columns) {
  const types = {};
  columns.forEach((col) => {
    const values = data.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '');
    const unique = [...new Set(values)];

    if (unique.length === 2) {
      types[col] = 'binary';
    } else if (unique.length <= 10 || values.some((v) => isNaN(Number(v)))) {
      types[col] = 'categorical';
    } else {
      types[col] = 'numerical';
    }
  });
  return types;
}

/**
 * For numerical columns, bin into groups for analysis
 */
export function binNumericalColumn(data, col, bins = 2) {
  const values = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return data.map((r) => ({
    ...r,
    [`${col}_group`]: Number(r[col]) <= median ? `≤${median}` : `>${median}`,
  }));
}
