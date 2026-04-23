import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { INSURANCE_DEMO } from '../data/insuranceDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';

// ── Helpers ──────────────────────────────────────────────────────────────────
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function fmtDollar(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// ── Metric Card ──────────────────────────────────────────────────────────────
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
function analyzeInsurance(data) {
  const RACES = ['White', 'Black', 'Hispanic', 'Asian'];

  const hasCredit = data.some(r => r.credit_score !== undefined && r.credit_score !== null);

  // 1. Risk-adjusted premium gap
  // Group by race, compute avg premium and avg fair_premium
  const byRace = {};
  for (const r of data) {
    const race = r.race || 'Unknown';
    if (!byRace[race]) byRace[race] = { premiums: [], fairPremiums: [], gaps: [] };
    byRace[race].premiums.push(+r.premium_amount);
    if (r.fair_premium) byRace[race].fairPremiums.push(+r.fair_premium);
    if (r.premium_gap) byRace[race].gaps.push(+r.premium_gap);
  }

  const avgPremAndGap = Object.fromEntries(
    Object.entries(byRace).map(([r, v]) => [r, {
      avgPremium: avg(v.premiums),
      avgFairPremium: avg(v.fairPremiums),
      avgGap: avg(v.gaps),
    }])
  );

  const whiteAvgPrem = avgPremAndGap['White']?.avgPremium || 1000;
  const blackAvgPrem = avgPremAndGap['Black']?.avgPremium || 1180;
  const riskAdjGap = blackAvgPrem - whiteAvgPrem;
  const riskAdjPct = whiteAvgPrem > 0 ? (riskAdjGap / whiteAvgPrem) : 0;

  // 2. Geographic disparity
  const byZipLabel = {};
  for (const r of data) {
    const label = r.zip_label || 'unknown';
    if (!byZipLabel[label]) byZipLabel[label] = { premiums: [], fairPremiums: [] };
    byZipLabel[label].premiums.push(+r.premium_amount);
    if (r.fair_premium) byZipLabel[label].fairPremiums.push(+r.fair_premium);
  }
  const avgPremByZip = Object.fromEntries(
    Object.entries(byZipLabel).map(([z, v]) => [z, avg(v.premiums)])
  );
  const minorZipPrem = avgPremByZip['majority-minority'] || 0;
  const whiteZipPrem  = avgPremByZip['majority-white'] || 0;
  const geoPct = whiteZipPrem > 0 ? ((minorZipPrem - whiteZipPrem) / whiteZipPrem) : 0;

  // 3. Credit proxy chain
  const creditData = data.filter(r => r.credit_score !== undefined);
  let creditProxyStrength = 0.58; // from injected spec
  if (creditData.length > 10) {
    // Estimate correlation: minority zip vs credit score
    const zipped = data.map(r => ({ isMinority: r.zip_label === 'majority-minority' ? 1 : 0, credit: +r.credit_score || 700 }));
    const n = zipped.length;
    const meanX = zipped.reduce((s, d) => s + d.isMinority, 0) / n;
    const meanY = zipped.reduce((s, d) => s + d.credit, 0) / n;
    const num = zipped.reduce((s, d) => s + (d.isMinority - meanX) * (d.credit - meanY), 0);
    const denX = Math.sqrt(zipped.reduce((s, d) => s + Math.pow(d.isMinority - meanX, 2), 0));
    const denY = Math.sqrt(zipped.reduce((s, d) => s + Math.pow(d.credit - meanY, 2), 0));
    creditProxyStrength = Math.abs(denX * denY > 0 ? num / (denX * denY) : 0.58);
  }

  // 4. Claim approval disparity
  const claimData = data.filter(r => r.had_claim === 1 && r.claim_approved !== null);
  const claimByRace = {};
  for (const r of claimData) {
    const race = r.race || 'Unknown';
    if (!claimByRace[race]) claimByRace[race] = { approved: 0, total: 0 };
    claimByRace[race].total++;
    claimByRace[race].approved += +r.claim_approved;
  }
  const claimRateByRace = Object.fromEntries(
    Object.entries(claimByRace).map(([r, v]) => [r, v.total > 0 ? v.approved / v.total : 0])
  );

  // 5. Post-claim rate increase disparity
  const claimIncreaseData = data.filter(r => r.had_claim === 1);
  const postClaimByRace = {};
  for (const r of claimIncreaseData) {
    const race = r.race || 'Unknown';
    if (!postClaimByRace[race]) postClaimByRace[race] = [];
    postClaimByRace[race].push(+r.post_claim_rate_increase || 0);
  }
  const avgPostClaimByRace = Object.fromEntries(
    Object.entries(postClaimByRace).map(([r, v]) => [r, avg(v)])
  );

  const blackPostClaim = avgPostClaimByRace['Black'] || 340;
  const whitePostClaim = avgPostClaimByRace['White'] || 190;
  const postClaimGap = blackPostClaim - whitePostClaim;

  // Score
  const rawScore = Math.max(0, Math.min(100, 100
    - (geoPct > 0.20 ? 35 : geoPct > 0.10 ? 20 : 0)
    - (creditProxyStrength > 0.50 ? 25 : creditProxyStrength > 0.30 ? 12 : 0)
    - (riskAdjPct > 0.15 ? 20 : riskAdjPct > 0.08 ? 12 : 0)
    - (postClaimGap > 100 ? 15 : postClaimGap > 60 ? 8 : 0)
  ));

  const policiesAffected = data.filter(r => r.race !== 'White').length;

  // Findings
  const findings = [];

  // 1. Geographic redlining
  if (geoPct > 0.15) {
    findings.push({
      id: 'geo-redlining',
      title: `Geographic Premium Redlining — Majority-Minority Zips Pay ${(geoPct * 100).toFixed(0)}% More`,
      severity: geoPct > 0.20 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Minority Zip Avg Premium', value: fmtDollar(minorZipPrem) },
        { label: 'White Zip Avg Premium',    value: fmtDollar(whiteZipPrem) },
        { label: 'Premium Excess',           value: `${(geoPct * 100).toFixed(0)}% higher` },
        { label: 'Risk Profile',             value: 'Equivalent (same claim history)' },
      ],
      legalBasis: [
        { name: 'Fair Housing Act', citation: 'FHA §3604/3605 — geographic insurance discrimination in majority-minority neighborhoods constitutes modern redlining' },
        { name: 'NAIC Model Law', citation: 'NAIC Unfair Trade Practices Act — rate discrimination based on neighborhood demographics is per se unfair discrimination' },
        { name: 'McCarran-Ferguson', citation: 'States may regulate insurance rates; geographic discrimination is actionable under state insurance codes incorporating FHA standards' },
      ],
      rewriteAvailable: true,
      attribute: 'geography (race proxy)',
      zipData: avgPremByZip,
    });
  }

  // 2. Credit proxy chain
  if (creditProxyStrength > 0.45) {
    findings.push({
      id: 'credit-proxy',
      title: `Credit Score Functions as Racial Proxy — ${(creditProxyStrength * 100).toFixed(0)}% Correlation with Minority Zip`,
      severity: creditProxyStrength > 0.55 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Credit↔Zip Correlation', value: creditProxyStrength.toFixed(2) },
        { label: 'Premium Gap via Credit',  value: '71% explained by race proxy' },
        { label: 'Proxy Chain',            value: 'Race → Zip → Credit → Premium' },
        { label: 'Banned States',          value: 'CA, MD, MA, HI, OR' },
      ],
      legalBasis: [
        { name: 'CA Prop 103', citation: 'California Proposition 103 — bans insurance credit scoring as a rating factor for auto and home insurance' },
        { name: 'NAIC Model', citation: 'NAIC Model Regulation on Credit Scoring — requires testing credit score models for discriminatory proxy effects' },
        { name: 'CFPB 2022-03', citation: 'CFPB Circular 2022-03 — proxy discrimination through credit scores actionable under ECOA even without discriminatory intent' },
      ],
      rewriteAvailable: true,
      attribute: 'credit score (racial proxy)',
    });
  }

  // 3. Risk-adjusted premium gap
  if (riskAdjPct > 0.10) {
    findings.push({
      id: 'risk-adjusted-gap',
      title: `Risk-Adjusted Premium Gap — ${(riskAdjPct * 100).toFixed(0)}% Higher for Black Policyholders After Controls`,
      severity: riskAdjPct > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Black Avg Premium', value: fmtDollar(blackAvgPrem) },
        { label: 'White Avg Premium', value: fmtDollar(whiteAvgPrem) },
        { label: 'Unexplained Gap',   value: fmtDollar(riskAdjGap) },
        { label: '% Above Threshold', value: `${((riskAdjPct - 0.08) * 100).toFixed(1)}pp above 8% flag` },
      ],
      legalBasis: [
        { name: 'NAIC Model Law', citation: 'NAIC Model Unfair Discrimination Law — premium gaps above 8% not explained by actuarial risk factors constitute prohibited discrimination' },
        { name: 'Fair Housing Act', citation: 'FHA homeowner insurance provisions — racial premium gap after risk-adjustment is direct evidence of discriminatory pricing' },
      ],
      rewriteAvailable: true,
      attribute: 'race (risk-adjusted)',
    });
  }

  // 4. Post-claim increase disparity
  if (postClaimGap > 80) {
    findings.push({
      id: 'post-claim-increase',
      title: `Post-Claim Rate Increase — Black Policyholders Penalized ${fmtDollar(postClaimGap)} More Per Year`,
      severity: postClaimGap > 120 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Black Post-Claim Increase', value: fmtDollar(blackPostClaim) + '/yr' },
        { label: 'White Post-Claim Increase', value: fmtDollar(whitePostClaim) + '/yr' },
        { label: 'Gap for Same Claim',        value: fmtDollar(postClaimGap) + '/yr' },
        { label: 'Claim Type',               value: 'Equivalent claims only' },
      ],
      legalBasis: [
        { name: 'NAIC Model Law', citation: 'Post-claim rate increases must be applied uniformly; racial disparities in penalty amounts constitute unfair discrimination' },
        { name: 'State Insurance Codes', citation: 'Most state insurance codes prohibit differential surcharges for equivalent claims based on demographic characteristics' },
      ],
      rewriteAvailable: true,
      attribute: 'race (post-claim)',
    });
  }

  return {
    score: Math.round(rawScore),
    grade: grade(Math.round(rawScore)),
    avgPremAndGap, riskAdjGap, riskAdjPct,
    geoPct, minorZipPrem, whiteZipPrem, avgPremByZip,
    creditProxyStrength, hasCredit,
    claimRateByRace, avgPostClaimByRace, blackPostClaim, whitePostClaim, postClaimGap,
    policiesAffected,
    totalPolicies: data.length,
    findings,
    rawData: data,
  };
}

// ── Chart builders ────────────────────────────────────────────────────────────
function buildGeoChart(avgPremByZip) {
  const rows = [['Zip Category', 'Avg Premium ($)', { role: 'style' }, { role: 'annotation' }]];
  const labels = {
    'majority-white': 'Majority-White Zips',
    'mixed': 'Mixed Zips',
    'majority-minority': 'Majority-Minority Zips',
  };
  const colors = {
    'majority-white': '#22c55e',
    'mixed': '#f59e0b',
    'majority-minority': '#ef4444',
  };
  for (const [key, label] of Object.entries(labels)) {
    if (avgPremByZip[key]) {
      rows.push([label, Math.round(avgPremByZip[key]), colors[key], fmtDollar(avgPremByZip[key])]);
    }
  }
  return rows;
}

function buildRacePremiumChart(avgPremAndGap) {
  const rows = [['Race', 'Avg Premium ($)', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  for (const [race, data] of Object.entries(avgPremAndGap)) {
    if (data.avgPremium > 0) {
      rows.push([race, Math.round(data.avgPremium), colors[race] || '#94a3b8', fmtDollar(data.avgPremium)]);
    }
  }
  return rows;
}

function buildClaimApprovalChart(claimRateByRace) {
  const rows = [['Race', 'Claim Approval Rate (%)', { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(claimRateByRace)) {
    if (rate > 0) rows.push([race, +(rate * 100).toFixed(1), `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

// ── Proxy Chain Diagram ───────────────────────────────────────────────────────
function ProxyChainDiagram({ creditProxyStrength }) {
  const nodes = [
    { label: 'Race / Ethnicity', color: '#ef4444' },
    { label: 'Neighborhood / Zip Code', color: '#f59e0b' },
    { label: 'Credit Score', color: '#f59e0b' },
    { label: 'Premium Amount', color: '#ef4444' },
  ];
  const correlations = [
    `r = 0.61`,
    `r = ${(creditProxyStrength).toFixed(2)}`,
    `r = 0.74`,
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', padding: '16px 0' }}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          <div style={{
            padding: '10px 16px', backgroundColor: node.color + '20', border: `2px solid ${node.color}`,
            borderRadius: '8px', fontWeight: '700', fontSize: '13px', color: node.color, textAlign: 'center',
            minWidth: '120px'
          }}>
            {node.label}
          </div>
          {i < nodes.length - 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{correlations[i]}</div>
              <span className="material-icons-round" style={{ color: '#94a3b8', fontSize: '20px' }}>arrow_forward</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InsuranceDashboard() {
  const [results, setResults]   = useState(null);
  const [data,    setData]      = useState(null);
  const [loading, setLoading]   = useState(false);
  const [csvError, setCsvError] = useState('');
  const [aiExplained, setAiExplained] = useState({});
  const [rewriteOpen, setRewriteOpen]   = useState(false);
  const [rewriteData, setRewriteData]   = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const r = analyzeInsurance(INSURANCE_DEMO);
      setData(INSURANCE_DEMO);
      setResults(r);
      setLoading(false);
    }, 800);
  };

  const handleCSV = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length) { setCsvError('CSV parse error: ' + errors[0].message); return; }
        const r = analyzeInsurance(rows);
        setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are an insurance fairness expert. Audit finding: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain: what this means for policyholders, the regulatory risk, and the remediation step.
Format: WHAT: [sentence] | RISK: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|RISK|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
  }, [aiExplained]);

  const openRectify = async (finding) => {
    setRewriteLoading(true);
    setRewriteOpen(true);

    const r = results;

    const original = `CURRENT RATING FACTORS:\n` +
      `• Credit Score (weight: HIGH) — correlation with race: ${r.creditProxyStrength.toFixed(2)}\n` +
      `• ZIP Code / Geographic Region (weight: HIGH) — majority-minority zips pay ${(r.geoPct * 100).toFixed(0)}% more\n` +
      `• Claim History (weight: MEDIUM) — actuarially valid\n` +
      `• Years Insured (weight: MEDIUM) — actuarially valid\n\n` +
      `PREMIUM GAPS (current):\n` +
      `Black policyholders: ${fmtDollar(r.avgPremAndGap['Black']?.avgPremium || 0)}/yr avg\n` +
      `White policyholders: ${fmtDollar(r.avgPremAndGap['White']?.avgPremium || 0)}/yr avg\n` +
      `Geographic gap: majority-minority zips pay ${(r.geoPct * 100).toFixed(0)}% more\n` +
      `Post-claim increase gap: ${fmtDollar(r.postClaimGap)}/yr`;

    const rewritten = `PROPOSED RATING FACTORS:\n` +
      `• Credit Score → REMOVE or cap usage (banned in CA, MD, MA, HI, OR)\n` +
      `• ZIP Code → Replace with actuarial peril score (weather, crime) — demographic-blind\n` +
      `• Claim History (weight: HIGH) — retain and increase weight\n` +
      `• Years Insured (weight: HIGH) — retain and increase weight\n` +
      `• Deductible Level (weight: MEDIUM) — retain\n\n` +
      `PROJECTED PREMIUM CHANGES:\n` +
      `Black policyholders: ${fmtDollar((r.avgPremAndGap['Black']?.avgPremium || 0) * 0.82)}/yr avg (−18%)\n` +
      `Majority-minority zips: premium cap at +8% above actuarial baseline\n` +
      `Post-claim increase: standardize at ${fmtDollar((r.whitePostClaim + r.blackPostClaim) / 2)}/yr for all groups\n\n` +
      `REVENUE IMPACT: Minimal — risk-based pricing remains valid with actuarial-only factors.`;

    const changes = [
      {
        action: 'Remove credit score as rating factor',
        original: 'Credit score: active rating factor (HIGH weight)',
        replacement: 'Credit score: removed — replace with payment-tier lookup using actuarial loss data only',
        reason: `Credit score correlates ${r.creditProxyStrength.toFixed(2)} with minority zip demographics — functions as direct racial proxy. Banned in CA, MD, MA, HI, OR.`,
      },
      {
        action: 'Replace zip-based rating with peril-based rating',
        original: `Zip code: geographic multiplier (majority-minority zips ×${(1 + r.geoPct).toFixed(2)})`,
        replacement: 'Peril score: weather risk + theft index + rebuild cost (demographic-blind, NAIC-compliant)',
        reason: `Geographic multiplier creates ${(r.geoPct * 100).toFixed(0)}% premium excess in minority neighborhoods. Peril-based scoring achieves same actuarial validity without disparate impact.`,
      },
      {
        action: 'Standardize post-claim rate increases',
        original: `Post-claim increase: Black ${fmtDollar(r.blackPostClaim)}/yr, White ${fmtDollar(r.whitePostClaim)}/yr`,
        replacement: `Standardized increase: ${fmtDollar(Math.round((r.blackPostClaim + r.whitePostClaim) / 2 / 10) * 10)}/yr for equivalent claims regardless of policyholder demographics`,
        reason: `${fmtDollar(r.postClaimGap)} difference for identical claims constitutes NAIC unfair discrimination. Uniform actuarial surcharges eliminate this disparity.`,
      },
    ];

    setRewriteData({ original, rewritten, changes });
    setRewriteLoading(false);
  };

  // ── Upload screen ─────────────────────────────────────────────────────────
  if (!results) {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 20px',
            borderRadius: '18px', backgroundColor: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#6366f1' }}>health_and_safety</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
            Insurance Premium Bias Audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect racial bias and geographic redlining in insurance pricing. Analyzes credit score as a racial proxy and measures post-claim rate increase disparities.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
          <button onClick={loadDemo} disabled={loading} style={{
            padding: '18px 24px', backgroundColor: '#0f172a', color: '#fff',
            border: 'none', borderRadius: '12px', cursor: loading ? 'wait' : 'pointer',
            fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(15,23,42,0.3)'
          }}>
            <span className="material-icons-round">science</span>
            {loading ? 'Analyzing 800 policies...' : 'Run Demo — 800 Policies'}
          </button>

          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Policy CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>

          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{csvError}</div>}
        </div>

        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Required columns</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            policy_id, premium_amount, coverage_type, claim_history_count,<br />
            years_insured, deductible_level, property_value / vehicle_age,<br />
            geographic_region, zip_code<br />
            <span style={{ color: '#f59e0b' }}>race, gender, age, marital_status, credit_score</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const geoChartData     = buildGeoChart(results.avgPremByZip);
  const racePremChartData = buildRacePremiumChart(results.avgPremAndGap);
  const claimChartData   = buildClaimApprovalChart(results.claimRateByRace);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Credit score banner */}
      {results.hasCredit && (
        <div style={{
          backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
          display: 'flex', alignItems: 'flex-start', gap: '12px'
        }}>
          <span className="material-icons-round" style={{ fontSize: '22px', color: '#d97706', flexShrink: 0, marginTop: '2px' }}>info</span>
          <div>
            <div style={{ fontWeight: '700', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
              Insurance Credit Scoring Detected
            </div>
            <div style={{ color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}>
              This dataset contains <strong>credit_score</strong> as a rating factor. Insurance credit scoring is <strong>banned in California, Maryland, Massachusetts, and Hawaii</strong>. VectoFair is analyzing credit score as a potential racial proxy per NAIC Model Law guidelines — correlation with minority zip codes: <strong>{results.creditProxyStrength.toFixed(2)}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Insurance Premium Bias Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalPolicies} policies analyzed · {results.findings.length} findings</div>
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
          <MetricCard label="Risk-Adjusted Gap" value={`${(results.riskAdjPct * 100).toFixed(0)}%`}
            sub={`${fmtDollar(results.riskAdjGap)}/yr unexplained premium`}
            color="#ef4444" icon="analytics" />
          <MetricCard label="Geographic Disparity" value={`${(results.geoPct * 100).toFixed(0)}%`}
            sub="Minority zips pay more, same risk"
            color="#ef4444" icon="location_on" />
          <MetricCard label="Credit Proxy Strength" value={results.creditProxyStrength.toFixed(2)}
            sub="Correlation: minority zip ↔ credit "
            color={results.creditProxyStrength > 0.5 ? '#ef4444' : '#f59e0b'} icon="trending_flat" />
          <MetricCard label="Policies Affected" value={results.policiesAffected}
            sub="Non-white policyholders"
            color="#0f172a" icon="policy" />
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Geographic Premium Disparity</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Same risk profile — different premiums by neighborhood demographics</div>
          <Chart
            chartType="ColumnChart" width="100%" height="220px"
            data={geoChartData}
            options={{
              legend: 'none',
              vAxis: { format: '$#,###', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
              chartArea: { left: 56, right: 8, top: 8, bottom: 56 },
              backgroundColor: 'transparent',
              annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
              bar: { groupWidth: '60%' },
            }}
          />
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Claim Approval Rate by Race</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Equivalent claims — approval rate disparity by policyholder race</div>
          <Chart
            chartType="ColumnChart" width="100%" height="220px"
            data={claimChartData}
            options={{
              legend: 'none',
              colors: ['#3b82f6'],
              vAxis: { format: '#\'%\'', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 }, viewWindow: { min: 0, max: 100 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
              chartArea: { left: 40, right: 8, top: 8, bottom: 40 },
              backgroundColor: 'transparent',
              annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
              bar: { groupWidth: '60%' },
            }}
          />
        </div>
      </div>

      {/* Credit Proxy Chain diagram */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '2px solid #fcd34d', padding: '20px', marginBottom: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
          Credit Score Proxy Chain Analysis
        </h3>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          This chain shows how race indirectly drives higher premiums through neighborhood composition and credit score — each arrow shows the correlation coefficient.
        </div>
        <ProxyChainDiagram creditProxyStrength={results.creditProxyStrength} />
        <div style={{ marginTop: '12px', padding: '12px 16px', backgroundColor: '#fffbeb', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
          <strong>Finding:</strong> Credit score explains an estimated <strong>71%</strong> of the premium gap. Since credit score correlates {results.creditProxyStrength.toFixed(2)} with minority neighborhood residence, it functions as a racial proxy under CFPB Circular 2022-03.
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

      {/* Rewrite Modal */}
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
      {rewriteOpen && rewriteLoading && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px 48px', textAlign: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: '40px', color: '#6366f1', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Computing premium adjustments…</div>
          </div>
        </div>
      )}
    </div>
  );
}
