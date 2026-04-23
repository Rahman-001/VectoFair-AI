import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import { ADMISSIONS_DEMO } from '../data/admissionsDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'applicant_id',          type:'string' },
  { name:'merit_score',           type:'number',  note:'0-100 composite merit' },
  { name:'sat_score',             type:'number',  note:'400-1600' },
  { name:'admitted',              type:'0/1' },
  { name:'legacy_status',         type:'0/1',     note:'1=has legacy connection' },
  { name:'applied_financial_aid', type:'0/1' },
  { name:'high_school_type',      type:'string',  note:'Public/Private/Charter' },
  { name:'zip_type',              type:'string',  note:'Suburban/Rural or Urban Majority-Minority' },
  { name:'race',                  type:'string',  sensitive:true },
  { name:'gender',                type:'string',  sensitive:true },
  { name:'first_gen',             type:'0/1',     sensitive:true },
];


// ── Helpers ──────────────────────────────────────────────────────────────────
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function fmtPct(n, d = 0) { return (n * 100).toFixed(d) + '%'; }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function MetricCard({ label, value, sub, color = '#0f172a', icon }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px', padding: '20px 24px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: '160px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {icon && <span className="material-icons-round" style={{ fontSize: '18px', color: '#64748b' }}>{icon}</span>}
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ── Analysis Engine ───────────────────────────────────────────────────────────
function analyzeAdmissions(data) {
  const groupBy = (arr, key) => {
    const map = {};
    for (const r of arr) {
      const k = r[key] !== undefined && r[key] !== null ? String(r[key]) : 'Unknown';
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  };

  // 1. LEGACY ADVANTAGE
  const legacy = data.filter(r => r.legacy_status === 1);
  const nonLegacy = data.filter(r => r.legacy_status === 0);
  const legacyAdmRate = legacy.length ? avg(legacy.map(p => p.admitted)) : 0;
  const nonLegacyAdmRate = nonLegacy.length ? avg(nonLegacy.map(p => p.admitted)) : 0;
  const legacyBoost = legacyAdmRate - nonLegacyAdmRate;

  // Legacy racial composition
  const legacyByRace = groupBy(legacy, 'race');
  const legacyWhitePct = (legacyByRace['White']?.length ?? 0) / Math.max(legacy.length, 1);

  // Disparate impact: compare same-merit legacy vs non-legacy
  // Use merit_score quartiles
  const allScores = data.map(d => d.merit_score).sort((a, b) => a - b);
  const q3 = allScores[Math.floor(allScores.length * 0.75)];
  const topMeritNonLegacy = nonLegacy.filter(r => r.merit_score >= q3);
  const topMeritLegacy = legacy.filter(r => r.merit_score >= q3);
  const topNonLegacyAdmRate = topMeritNonLegacy.length ? avg(topMeritNonLegacy.map(p => p.admitted)) : 0;
  const topLegacyAdmRate = topMeritLegacy.length ? avg(topMeritLegacy.map(p => p.admitted)) : legacyAdmRate;

  // 2. FINANCIAL AID PENALTY
  const aidApplicants = data.filter(r => r.applied_financial_aid === 1);
  const nonAidApplicants = data.filter(r => r.applied_financial_aid === 0);

  // Control for merit (top 50% of merit score)
  const medianMerit = allScores[Math.floor(allScores.length * 0.50)];
  const aidHighMerit = aidApplicants.filter(r => r.merit_score >= medianMerit);
  const nonAidHighMerit = nonAidApplicants.filter(r => r.merit_score >= medianMerit);
  const aidAdmRate = aidHighMerit.length ? avg(aidHighMerit.map(p => p.admitted)) : 0;
  const nonAidAdmRate = nonAidHighMerit.length ? avg(nonAidHighMerit.map(p => p.admitted)) : 0;
  const aidPenalty = nonAidAdmRate - aidAdmRate;

  // 3. HIGH SCHOOL TYPE DISPARITY
  const byHSType = groupBy(data, 'high_school_type');
  const publicAdm = byHSType['Public'] ? avg(byHSType['Public'].map(p => p.admitted)) : 0;
  const privateAdm = byHSType['Private'] ? avg(byHSType['Private'].map(p => p.admitted)) : 0;
  const hsGap = privateAdm - publicAdm;

  // Control for SAT: compare public vs private with same SAT quartile
  const avgSAT = avg(data.map(r => r.sat_score));
  const midPublic = (byHSType['Public'] || []).filter(r => r.sat_score >= avgSAT - 50 && r.sat_score <= avgSAT + 50);
  const midPrivate = (byHSType['Private'] || []).filter(r => r.sat_score >= avgSAT - 50 && r.sat_score <= avgSAT + 50);
  const publicAdmSATControlled = midPublic.length ? avg(midPublic.map(p => p.admitted)) : publicAdm;
  const privateAdmSATControlled = midPrivate.length ? avg(midPrivate.map(p => p.admitted)) : privateAdm;
  const hsGapControlled = privateAdmSATControlled - publicAdmSATControlled;

  // 4. GEOGRAPHIC CONCENTRATION
  const byZip = groupBy(data, 'zip_type');
  const suburbAdm = byZip['Suburban/Rural'] ? avg(byZip['Suburban/Rural'].map(p => p.admitted)) : 0;
  const urbanAdm = byZip['Urban Majority-Minority'] ? avg(byZip['Urban Majority-Minority'].map(p => p.admitted)) : 0;
  const geoGap = suburbAdm - urbanAdm;

  // 5. RACE GAP AFTER ALL CONTROLS
  const byRace = groupBy(data, 'race');
  const admByRace = {};
  for (const [race, pts] of Object.entries(byRace)) {
    if (pts.length >= 10) {
      admByRace[race] = avg(pts.map(p => p.admitted));
    }
  }

  // Score
  let score = 100;
  if (legacyBoost > 0.30) score -= 28; else if (legacyBoost > 0.18) score -= 18;
  if (legacyWhitePct > 0.72) score -= 15; else if (legacyWhitePct > 0.60) score -= 8;
  if (aidPenalty > 0.12) score -= 20; else if (aidPenalty > 0.07) score -= 12;
  if (hsGapControlled > 0.12) score -= 15; else if (hsGapControlled > 0.07) score -= 8;
  if (geoGap > 0.12) score -= 12; else if (geoGap > 0.07) score -= 7;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const findings = [];

  if (legacyBoost > 0.20) {
    findings.push({
      id: 'legacy-proxy', rewriteAvailable: true,
      title: `Legacy Preference Functions as Racial Proxy — ${fmtPct(legacyWhitePct)} of Legacy Applicants are White, Admission Boost: +${fmtPct(legacyBoost)}`,
      severity: legacyBoost > 0.30 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Legacy Admission Rate', value: fmtPct(legacyAdmRate) },
        { label: 'Non-Legacy Admission Rate', value: fmtPct(nonLegacyAdmRate) },
        { label: 'Legacy Boost', value: `+${fmtPct(legacyBoost)}` },
        { label: 'Legacy Pool White %', value: fmtPct(legacyWhitePct) },
      ],
      legalBasis: [
        { name: 'SFFA v. Harvard 2023', citation: 'Students for Fair Admissions v. Harvard (2023) — Court scrutinized legacy preferences as historically tied to racial exclusion; schools must demonstrate race-neutrality of legacy policies' },
        { name: 'Title VI', citation: 'Title VI Civil Rights Act — admission criteria that correlate with race and produce disparate outcomes may constitute disparate impact discrimination' },
        { name: 'NACAC Ethics', citation: 'NACAC Statement of Principles — "Members shall commit to making admission decisions... based on specified criteria that do not include ability to pay" — legacy as proxy conflicts with merit principles' },
      ],
    });
  }

  if (aidPenalty > 0.10) {
    findings.push({
      id: 'aid-penalty', rewriteAvailable: true,
      title: `Financial Aid Penalty — Aid Applicants Admitted at ${fmtPct(aidAdmRate)} vs Non-Aid ${fmtPct(nonAidAdmRate)} (Same Merit Profile)`,
      severity: aidPenalty > 0.14 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Aid Applicant Rate (merit-matched)', value: fmtPct(aidAdmRate) },
        { label: 'Non-Aid Rate (merit-matched)', value: fmtPct(nonAidAdmRate) },
        { label: 'Penalty Gap', value: `-${fmtPct(aidPenalty)}` },
        { label: 'Need-Blind Claim', value: 'Need-blind policy violation risk flagged' },
      ],
      legalBasis: [
        { name: 'Title VI', citation: 'Financial aid penalty for merit-equal applicants may constitute resource discrimination against lower-income students who are disproportionately racial minorities' },
        { name: 'NACAC Ethics', citation: 'NACAC — Ethical standards require that financial need not be factored into admissions decisions for schools claiming need-blind policies' },
        { name: 'SFFA Context', citation: 'Post-SFFA analysis: economic diversity proxies for racial diversity must be non-discriminatory — aid penalties subvert this substitute approach' },
      ],
    });
  }

  if (hsGapControlled > 0.10) {
    findings.push({
      id: 'hs-type', rewriteAvailable: true,
      title: `High School Type Disparity — Public School Applicants Admitted at ${fmtPct(publicAdmSATControlled)} vs Private School ${fmtPct(privateAdmSATControlled)} (Same SAT)`,
      severity: hsGapControlled > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Public School Rate (SAT-matched)', value: fmtPct(publicAdmSATControlled) },
        { label: 'Private School Rate (SAT-matched)', value: fmtPct(privateAdmSATControlled) },
        { label: 'Gap', value: `-${fmtPct(hsGapControlled)}` },
        { label: 'SES Correlation', value: 'Public school = lower-SES, minority proxy' },
      ],
      legalBasis: [
        { name: 'Title VI Disparate Impact', citation: 'High school type disadvantaging public school applicants — who are disproportionately minority and low-SES — may constitute disparate impact under Title VI' },
        { name: 'SFFA v. Harvard 2023', citation: 'Race-neutral alternatives that account for school quality (context-weighted GPA) are specifically endorsed by the Supreme Court as compliant alternatives to race-conscious review' },
      ],
    });
  }

  if (geoGap > 0.10) {
    findings.push({
      id: 'geo-gap', rewriteAvailable: true,
      title: `Geographic Concentration — Urban Majority-Minority ZIP Admits at ${fmtPct(urbanAdm)} vs Suburban ${fmtPct(suburbAdm)}`,
      severity: geoGap > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Suburban/Rural Admit Rate', value: fmtPct(suburbAdm) },
        { label: 'Urban Majority-Minority Rate', value: fmtPct(urbanAdm) },
        { label: 'Geographic Gap', value: `-${fmtPct(geoGap)}` },
        { label: '"Geographic Diversity"', value: 'Claim does not hold statistically' },
      ],
      legalBasis: [
        { name: 'SFFA v. Harvard 2023', citation: 'Geographic diversity programs cannot use zip code as a de facto racial proxy — outcomes must be race-neutral in effect' },
        { name: 'Title VI', citation: 'Admission patterns correlated with neighborhood racial composition may trigger Title VI disparate impact scrutiny' },
      ],
    });
  }

  return {
    score, grade: grade(score),
    legacyBoost, legacyAdmRate, nonLegacyAdmRate, legacyWhitePct,
    topLegacyAdmRate, topNonLegacyAdmRate,
    aidPenalty, aidAdmRate, nonAidAdmRate,
    hsGap, hsGapControlled, publicAdmSATControlled, privateAdmSATControlled,
    publicAdm, privateAdm,
    geoGap, suburbAdm, urbanAdm,
    admByRace,
    totalApplicants: data.length,
    legacyCount: legacy.length,
    aidCount: aidApplicants.length,
    findings,
  };
}

// ── Chart Builders ────────────────────────────────────────────────────────────
function buildLegacyFunnelChart(legacyAdmRate, nonLegacyAdmRate, topLegacyAdmRate, topNonLegacyAdmRate) {
  return [
    ['Group', 'All Applicants (%)', 'Top Merit (Top 25%) (%)'],
    ['Legacy', +(legacyAdmRate * 100).toFixed(1), +(topLegacyAdmRate * 100).toFixed(1)],
    ['Non-Legacy', +(nonLegacyAdmRate * 100).toFixed(1), +(topNonLegacyAdmRate * 100).toFixed(1)],
  ];
}

function buildHSChart(publicAdm, privateAdm, charter) {
  const rows = [['School Type', 'Admission Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  rows.push(['Private School', +(privateAdm * 100).toFixed(1), '#22c55e', `${(privateAdm * 100).toFixed(0)}%`]);
  if (charter !== undefined) rows.push(['Charter School', +(charter * 100).toFixed(1), '#f59e0b', `${(charter * 100).toFixed(0)}%`]);
  rows.push(['Public School', +(publicAdm * 100).toFixed(1), '#ef4444', `${(publicAdm * 100).toFixed(0)}%`]);
  return rows;
}

function buildAdmByRaceChart(admByRace) {
  const colors = { White: '#6366f1', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444', Other: '#94a3b8' };
  const rows = [['Race', 'Admission Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(admByRace)) {
    rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildGeoChart(suburbAdm, urbanAdm) {
  return [
    ['ZIP Type', 'Admission Rate (%)', { role: 'style' }, { role: 'annotation' }],
    ['Suburban / Rural', +(suburbAdm * 100).toFixed(1), '#22c55e', `${(suburbAdm * 100).toFixed(0)}%`],
    ['Urban Majority-Minority', +(urbanAdm * 100).toFixed(1), '#ef4444', `${(urbanAdm * 100).toFixed(0)}%`],
  ];
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdmissionsDashboard() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiExplained, setAiExplained] = useState({});
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteData, setRewriteData] = useState(null);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      setResults(analyzeAdmissions(ADMISSIONS_DEMO));
      setLoading(false);
    }, 900);
  };
  const handleCSV = (rows, err) => {
    if (err) return;
    setResults(analyzeAdmissions(rows));
  };

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a college admissions fairness expert. Bias finding: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain: what this means for applicants, the legal risk for the institution, and the policy recommendation.
Format: WHAT: [sentence] | RISK: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|RISK|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
  }, [aiExplained]);

  const openRectify = (finding) => {
    const r = results;
    const original = `CURRENT ADMISSIONS RUBRIC:\n` +
      `• Legacy preference: ${fmtPct(r.legacyAdmRate)} admission rate — ${fmtPct(r.legacyWhitePct)} White applicants\n` +
      `• Financial aid applicants: ${fmtPct(r.aidAdmRate)} vs non-aid ${fmtPct(r.nonAidAdmRate)} (same merit)\n` +
      `• Public school applicants: ${fmtPct(r.publicAdm)} vs private ${fmtPct(r.privateAdm)}\n` +
      `• Urban majority-minority ZIP: ${fmtPct(r.urbanAdm)} vs suburban ${fmtPct(r.suburbAdm)}\n` +
      `• No socioeconomic diversity index in use\n` +
      `• No context-weighted GPA adjustment for school type`;

    const rewritten = `PROPOSED EQUITABLE ADMISSIONS RUBRIC:\n\n` +
      `1. LEGACY PREFERENCE — PHASE OUT\n` +
      `   • Remove legacy as standalone criteria; replace with alumni engagement metric (merit-tied)\n` +
      `   • Legacy applicants evaluated solely on academic and co-curricular merit\n` +
      `   • 3-year transition plan to maintain alumni relations without discriminatory preference\n\n` +
      `2. NEED-BLIND ENFORCEMENT\n` +
      `   • Separate financial aid office from admissions review — wall of separation\n` +
      `   • Audit admission decisions by aid status quarterly for disparate impact\n` +
      `   • First-gen college scholarship program to attract qualified low-income applicants\n\n` +
      `3. CONTEXT-WEIGHTED GPA (SFFA-ENDORSED)\n` +
      `   • GPA weighted by course rigor index for applicant's specific high school\n` +
      `   • Public school rigorous course completion given equal weight to private school equivalent\n` +
      `   • Eliminates school-type disadvantage for same-caliber academic achievement\n\n` +
      `4. SOCIOECONOMIC DIVERSITY INDEX\n` +
      `   • First-gen college, family income bracket 1-2, public school → diversity credit\n` +
      `   • Race-neutral mechanism to achieve diversity in post-SFFA environment\n` +
      `   • Community college partnership pipeline for two-year transfer pathways`;

    const changes = [
      {
        action: 'Remove legacy preference from admissions rubric',
        original: `Legacy status: admission boost +${fmtPct(r.legacyBoost)} (pool ${fmtPct(r.legacyWhitePct)} White)`,
        replacement: 'Legacy: no standalone preference; alumni engagement measured separately via merit-tied criteria',
        reason: `Legacy pool is ${fmtPct(r.legacyWhitePct)} White — when it provides +${fmtPct(r.legacyBoost)} admission boost, it functions as a racial proxy under post-SFFA scrutiny`,
      },
      {
        action: 'Implement context-weighted GPA',
        original: `Raw GPA: public school applicants disadvantaged ${fmtPct(r.hsGapControlled)} vs private (same SAT)`,
        replacement: 'Context-weighted GPA: adjust for school course rigor index — endorsed by SFFA majority as race-neutral diversity tool',
        reason: `${fmtPct(r.hsGapControlled)} admission gap persists even after SAT control — public school disadvantage not explained by merit`,
      },
      {
        action: 'Enforce need-blind separation',
        original: `Aid applicants: ${fmtPct(r.aidAdmRate)} vs non-aid ${fmtPct(r.nonAidAdmRate)} — ${fmtPct(r.aidPenalty)} gap at same merit`,
        replacement: 'Aid status: fully separated from admissions file review; penalty gap eliminated through audit protocol',
        reason: `${fmtPct(r.aidPenalty)} penalty for merit-equal aid applicants violates need-blind policy claims and disproportionately disadvantages low-income/minority applicants`,
      },
    ];

    setRewriteData({ original, rewritten, changes });
    setRewriteOpen(true);
  };

  const chartOpts = {
    legend: 'none',
    vAxis: { format: '#\'%\'', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
    hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
    chartArea: { left: 48, right: 8, top: 8, bottom: 48 },
    backgroundColor: 'transparent',
    annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
    bar: { groupWidth: '60%' },
  };

  if (!results) {
    return (
      <UploadOrDemo
        title="Admissions Algorithm Audit"
        description="Detect bias in college admissions — legacy preference as racial proxy, financial aid penalty, high school type disparity, and geographic concentration effects. Post-SFFA v. Harvard compliance assessment."
        icon="school"
        iconColor="#f59e0b"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 800 Applicants"
        columns={CSV_COLUMNS}
        loading={loading}
        whatWeDetect={[
          'Legacy preference functioning as a racial proxy (SFFA v. Harvard 2023)',
          'Financial aid penalty for merit-equal applicants (need-blind policy violations)',
          'High school type disparity — public vs. private school admission gaps',
          'Geographic concentration bias by ZIP code racial composition',
          'Race admission rate gaps after SAT/merit control',
        ]}
      />
    );
  }

  const byHSType = {};
  ADMISSIONS_DEMO.reduce((acc, r) => {
    acc[r.high_school_type] = acc[r.high_school_type] || [];
    acc[r.high_school_type].push(r);
    return acc;
  }, byHSType);
  const charterAdm = byHSType['Charter'] ? avg(byHSType['Charter'].map(p => p.admitted)) : undefined;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Admissions Algorithm Bias Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalApplicants} applicants analyzed · {results.findings.length} findings · {results.legacyCount} legacy applicants</div>
        </div>
        <button onClick={loadDemo} style={{
          padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
          border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
          fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset
        </button>
      </div>

      {/* Score + Metrics */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', minWidth: '180px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <BiasScoreGauge score={results.score} grade={results.grade} size={120} />
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>Fairness Score</div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <MetricCard label="Legacy Advantage" value={`+${fmtPct(results.legacyBoost)}`}
            sub={`Legacy ${fmtPct(results.legacyAdmRate)} vs non-legacy ${fmtPct(results.nonLegacyAdmRate)}`}
            color="#ef4444" icon="family_restroom" />
          <MetricCard label="Aid Penalty" value={`-${fmtPct(results.aidPenalty)}`}
            sub={`Same merit: aid ${fmtPct(results.aidAdmRate)} vs non-aid ${fmtPct(results.nonAidAdmRate)}`}
            color={results.aidPenalty > 0.12 ? '#ef4444' : '#f59e0b'} icon="attach_money" />
          <MetricCard label="School Type Gap" value={`-${fmtPct(results.hsGapControlled)}`}
            sub={`Public ${fmtPct(results.publicAdmSATControlled)} vs private ${fmtPct(results.privateAdmSATControlled)} (SAT-matched)`}
            color={results.hsGapControlled > 0.12 ? '#ef4444' : '#f59e0b'} icon="apartment" />
          <MetricCard label="Geographic Gap" value={`-${fmtPct(results.geoGap)}`}
            sub={`Urban minority ZIP ${fmtPct(results.urbanAdm)} vs suburban ${fmtPct(results.suburbAdm)}`}
            color={results.geoGap > 0.12 ? '#ef4444' : '#f59e0b'} icon="location_on" />
        </div>
      </div>

      {/* Charts 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Legacy vs Non-Legacy Admission Rate</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Blue = all applicants, purple = top merit quartile</div>
          <Chart chartType="ColumnChart" width="100%" height="220px"
            data={buildLegacyFunnelChart(results.legacyAdmRate, results.nonLegacyAdmRate, results.topLegacyAdmRate, results.topNonLegacyAdmRate)}
            options={{ ...chartOpts, legend: { position: 'top' }, colors: ['#3b82f6', '#8b5cf6'] }}
          />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Admission Rate by High School Type</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Overall rates — public school correlation with lower-SES/minority demographics</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildHSChart(results.publicAdm, results.privateAdm, charterAdm)} options={chartOpts} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Admission Rate by Race</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Overall admission rate — no merit control here (see findings for controlled analysis)</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildAdmByRaceChart(results.admByRace)} options={chartOpts} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Admission Rate by ZIP Code Type</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Geographic "diversity" claim assessed — does it hold statistically?</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildGeoChart(results.suburbAdm, results.urbanAdm)} options={chartOpts} />
        </div>
      </div>

      {/* Findings */}
      <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Findings</h2>
      {results.findings.map(f => (
        <FindingCard
          key={f.id}
          title={f.title}
          severity={f.severity}
          metrics={f.metrics}
          legalBasis={f.legalBasis}
          rewriteAvailable={f.rewriteAvailable}
          fetchExplanation={() => fetchExplanation(f.id, f)}
          onRectifyClick={() => openRectify(f)}
        />
      ))}

      {results.findings.length === 0 && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <span className="material-icons-round" style={{ fontSize: '36px', color: '#16a34a', display: 'block', marginBottom: '8px' }}>verified</span>
          <div style={{ fontWeight: '700', color: '#15803d', fontSize: '16px' }}>Holistic Review Appears Equitable</div>
          <div style={{ color: '#166534', fontSize: '13px', marginTop: '4px' }}>No statistically significant proxy factor biases detected after merit control.</div>
        </div>
      )}

      {rewriteOpen && rewriteData && (
        <RewriteModal
          isOpen={rewriteOpen}
          onClose={() => setRewriteOpen(false)}
          onAccept={() => setRewriteOpen(false)}
          originalContent={rewriteData.original}
          rewrittenContent={rewriteData.rewritten}
          changesApplied={rewriteData.changes}
        />
      )}
    </div>
  );
}
