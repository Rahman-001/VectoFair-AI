// VectoFair — Batch Bias Comparator
// Computes pool-level statistics, screening equity simulation, and demographic analysis

import { getRiskLevel } from './resumeSignalExtractor';

// ── Compute pool-level fairness score ─────────────────────────────────────────
export function computePoolFairnessScore(analyzedResumes) {
  if (!analyzedResumes || analyzedResumes.length === 0) return 0;

  const scores = analyzedResumes.map((r) => r.biasVulnerabilityScore || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Pool fairness = inverse of average bias vulnerability
  // A pool of 100% LOW bias candidates = 90/100
  // A pool with high variance across name categories = lower score
  const categoryScores = {};
  const categoryCounts = {};

  for (const r of analyzedResumes) {
    const cat = r.nameCategory || 'ambiguous';
    if (!categoryScores[cat]) { categoryScores[cat] = 0; categoryCounts[cat] = 0; }
    categoryScores[cat] += r.biasVulnerabilityScore || 0;
    categoryCounts[cat]++;
  }

  const categoryAvgs = Object.keys(categoryScores).map((cat) => ({
    category: cat,
    avg: categoryScores[cat] / categoryCounts[cat],
    count: categoryCounts[cat],
  }));

  // Disparity = difference between highest and lowest category avg
  if (categoryAvgs.length < 2) {
    return Math.max(0, Math.round(100 - avgScore));
  }

  const maxAvg = Math.max(...categoryAvgs.map((c) => c.avg));
  const minAvg = Math.min(...categoryAvgs.map((c) => c.avg));
  const disparity = maxAvg - minAvg;

  // Pool fairness penalized by disparity
  const base = Math.max(0, 100 - avgScore);
  const penalty = disparity * 0.5;
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

// ── Demographic breakdown ──────────────────────────────────────────────────────
export function computeDemographicBreakdown(analyzedResumes) {
  const breakdown = {};

  for (const r of analyzedResumes) {
    const cat = r.nameCategory || 'ambiguous';
    if (!breakdown[cat]) breakdown[cat] = { count: 0, totalScore: 0, resumes: [] };
    breakdown[cat].count++;
    breakdown[cat].totalScore += r.biasVulnerabilityScore || 0;
    breakdown[cat].resumes.push(r);
  }

  return Object.entries(breakdown).map(([category, data]) => ({
    category,
    count: data.count,
    avgBiasScore: Math.round(data.totalScore / data.count),
    percentage: Math.round((data.count / analyzedResumes.length) * 100),
    resumes: data.resumes,
  }));
}

// ── Biased shortlist simulation ────────────────────────────────────────────────
// Simulates what a biased screener would do ranking by low bias vulnerability
export function simulateBiasedShortlist(analyzedResumes, n = 10) {
  // Biased screener: prefer Anglo names, low signal count, high-prestige institutions
  const scored = analyzedResumes.map((r) => ({
    ...r,
    biasedRank: r.biasVulnerabilityScore, // Lower = more preferred by biased screener
  }));

  // Sort ascending (biased screener would pick low-vulnerability = Anglo-name candidates first)
  const ranked = [...scored].sort((a, b) => a.biasedRank - b.biasedRank);
  return ranked.slice(0, n);
}

// ── Fair shortlist simulation ─────────────────────────────────────────────────
// Simulates blind screening — random selection (no bias signal influence)
export function simulateFairShortlist(analyzedResumes, n = 10) {
  // In a fair system, all candidates have equal chance regardless of name
  // We simulate this by shuffling and picking top N (or stratified sampling)
  const shuffled = [...analyzedResumes].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ── Screening equity score ────────────────────────────────────────────────────
export function computeScreeningEquityScore(biasedShortlist, fairShortlist) {
  const countByCategory = (list) => {
    const counts = {};
    for (const r of list) {
      const cat = r.nameCategory || 'ambiguous';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  };

  const biasedCounts = countByCategory(biasedShortlist);
  const fairCounts = countByCategory(fairShortlist);

  return { biasedCounts, fairCounts };
}

// ── Generate blind screening checklist ────────────────────────────────────────
export function generateBlindScreeningChecklist(analyzedResumes) {
  const universalFields = [
    { field: 'Full Name', reason: 'Name-based discrimination is the most documented form of hiring bias', icon: 'person', priority: 'critical' },
    { field: 'Home Address', reason: 'Address reveals neighborhood, zip code can proxy for race and income', icon: 'home', priority: 'critical' },
    { field: 'Photo', reason: "Photos reveal race, gender, age, and disability status — all protected characteristics", icon: 'photo_camera', priority: 'critical' },
    { field: 'Graduation Year', reason: 'Age proxy — ADEA protects workers over 40 from age discrimination', icon: 'calendar_today', priority: 'high' },
    { field: 'Personal Website / Social Media Links', reason: 'May reveal race, gender, religion, or disability status', icon: 'link', priority: 'high' },
    { field: 'Pronouns', reason: 'Gender disclosure should not affect screening decisions', icon: 'record_voice_over', priority: 'high' },
    { field: 'University Name (initial screen)', reason: 'Prestige bias screens out HBCU, community college, and international graduates', icon: 'school', priority: 'medium' },
    { field: 'Gendered Organization Names', reason: 'Sorority/fraternity membership can reveal gender and social class', icon: 'groups', priority: 'medium' },
    { field: 'Disability Disclosure', reason: 'ADA prohibits adverse action on this basis — should not be visible to screeners', icon: 'accessibility', priority: 'medium' },
    { field: 'Citizenship/Visa Status', reason: 'IRCA prohibits discrimination based on national origin/citizenship status', icon: 'flag', priority: 'medium' },
  ];

  // Identify which signals were most common in the pool
  const signalTypeCounts = {};
  for (const r of analyzedResumes) {
    for (const s of (r.signals || [])) {
      signalTypeCounts[s.type] = (signalTypeCounts[s.type] || 0) + 1;
    }
  }

  // Mark which fields are specifically flagged for this pool
  return universalFields.map((f) => ({
    ...f,
    flaggedInPool: (
      (f.field.includes('Name') && signalTypeCounts.NAME_BIAS > 0) ||
      (f.field.includes('Address') && signalTypeCounts.ADDRESS_SIGNAL > 0) ||
      (f.field.includes('Graduation') && signalTypeCounts.AGE_PROXY > 0) ||
      (f.field.includes('Pronouns') && signalTypeCounts.GENDER_SIGNAL > 0) ||
      (f.field.includes('Disability') && signalTypeCounts.DISABILITY_SIGNAL > 0) ||
      (f.field.includes('Citizenship') && signalTypeCounts.VISA_STATUS_SIGNAL > 0)
    ),
  }));
}

// ── Google Charts data formatters ──────────────────────────────────────────────
export function formatBarChartData(demographicBreakdown) {
  // Returns data array for Google Charts Bar
  const data = [['Name Category', 'Avg Bias Score', { role: 'style' }, { role: 'tooltip' }]];
  const colors = {
    'Anglo': '#22c55e',
    'African-American': '#dc2626',
    'Hispanic': '#f59e0b',
    'Asian': '#3b82f6',
    'South Asian': '#8b5cf6',
    'Arabic': '#ec4899',
    'ambiguous': '#94a3b8',
  };

  for (const d of demographicBreakdown) {
    data.push([
      d.category,
      d.avgBiasScore,
      `color: ${colors[d.category] || '#94a3b8'}`,
      `${d.category}: ${d.avgBiasScore}/100 avg bias score (${d.count} resume${d.count !== 1 ? 's' : ''})`,
    ]);
  }
  return data;
}

export function formatPieChartData(demographicBreakdown) {
  const data = [['Name Category', 'Count']];
  for (const d of demographicBreakdown) {
    data.push([`${d.category} (${d.count})`, d.count]);
  }
  return data;
}

// ── Main batch analysis function ──────────────────────────────────────────────
export function runBatchAnalysis(analyzedResumes) {
  const poolFairnessScore = computePoolFairnessScore(analyzedResumes);
  const demographicBreakdown = computeDemographicBreakdown(analyzedResumes);
  const biasedShortlist = simulateBiasedShortlist(analyzedResumes, 10);
  const fairShortlist = simulateFairShortlist(analyzedResumes, 10);
  const { biasedCounts, fairCounts } = computeScreeningEquityScore(biasedShortlist, fairShortlist);
  const blindScreeningChecklist = generateBlindScreeningChecklist(analyzedResumes);

  // Key insight text
  const maxCategory = demographicBreakdown.reduce((max, d) => d.avgBiasScore > max.avgBiasScore ? d : max, demographicBreakdown[0] || { avgBiasScore: 0, category: 'N/A' });
  const minCategory = demographicBreakdown.reduce((min, d) => d.avgBiasScore < min.avgBiasScore ? d : min, demographicBreakdown[0] || { avgBiasScore: 0, category: 'N/A' });

  const angloData = demographicBreakdown.find((d) => d.category === 'Anglo');
  const minorityData = demographicBreakdown.filter((d) => d.category !== 'Anglo' && d.category !== 'ambiguous');
  const minorityAvg = minorityData.length > 0
    ? Math.round(minorityData.reduce((s, d) => s + d.avgBiasScore * d.count, 0) / minorityData.reduce((s, d) => s + d.count, 0))
    : 0;

  const angloInBiasedShortlist = biasedShortlist.filter((r) => r.nameCategory === 'Anglo').length;
  const minorityInBiasedShortlist = biasedShortlist.filter((r) => r.nameCategory !== 'Anglo' && r.nameCategory !== 'ambiguous').length;

  return {
    poolFairnessScore,
    demographicBreakdown,
    biasedShortlist,
    fairShortlist,
    biasedCounts,
    fairCounts,
    blindScreeningChecklist,
    keyInsight: maxCategory.category !== minCategory.category
      ? `Candidates with "${maxCategory.category}" names have ${maxCategory.avgBiasScore - minCategory.avgBiasScore} point higher average bias vulnerability scores than "${minCategory.category}" candidates with equal qualifications.`
      : 'Bias vulnerability is relatively consistent across name categories in this pool.',
    angloAvgScore: angloData?.avgBiasScore || 0,
    minorityAvgScore: minorityAvg,
    angloInBiasedShortlist,
    minorityInBiasedShortlist,
    barChartData: formatBarChartData(demographicBreakdown),
    pieChartData: formatPieChartData(demographicBreakdown),
    riskSummary: {
      high: analyzedResumes.filter((r) => getRiskLevel(r.biasVulnerabilityScore) === 'HIGH').length,
      medium: analyzedResumes.filter((r) => getRiskLevel(r.biasVulnerabilityScore) === 'MEDIUM').length,
      low: analyzedResumes.filter((r) => getRiskLevel(r.biasVulnerabilityScore) === 'LOW').length,
    },
  };
}
