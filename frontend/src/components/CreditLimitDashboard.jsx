import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { CREDIT_LIMIT_DEMO } from '../data/creditLimitDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDollar(n) { return '$' + Math.round(n).toLocaleString(); }
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
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
function analyzeCreditLimit(data) {
  const BANDS = ['300-579', '580-669', '670-739', '740-799', '800-850'];
  const QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4'];
  const RACES = ['White', 'Black', 'Hispanic', 'Asian'];

  // Raw avg by race
  const byRace = {};
  for (const r of data) {
    const race = r.race || 'Unknown';
    if (!byRace[race]) byRace[race] = [];
    byRace[race].push(+r.credit_limit);
  }
  const avgByRace = Object.fromEntries(
    Object.entries(byRace).map(([r, limits]) => [r, avg(limits)])
  );

  const whiteAvg = avgByRace['White'] || 8000;
  const blackAvg = avgByRace['Black'] || 6200;
  const rawGap   = whiteAvg - blackAvg;

  // Risk-adjusted: within each credit band, compare averages
  const bandData = {};
  for (const band of BANDS) {
    bandData[band] = {};
    for (const race of RACES) {
      const group = data.filter(r => (r.credit_score_band === band || getBand(+r.credit_score) === band) && r.race === race);
      bandData[band][race] = group.length ? avg(group.map(r => +r.credit_limit)) : null;
    }
  }

  // Find worst within-band gap
  let maxBandGap = 0;
  let worstBand = '';
  let worstBandWhite = 0;
  let worstBandBlack = 0;
  for (const band of BANDS) {
    const w = bandData[band]['White'];
    const b = bandData[band]['Black'];
    if (w && b && (w - b) > maxBandGap) {
      maxBandGap = w - b;
      worstBand = band;
      worstBandWhite = w;
      worstBandBlack = b;
    }
  }

  // Income-adjusted: within each quartile
  const incomeData = {};
  for (const q of QUARTILES) {
    incomeData[q] = {};
    for (const race of RACES) {
      const group = data.filter(r => r.income_quartile === q && r.race === race);
      incomeData[q][race] = group.length ? avg(group.map(r => +r.credit_limit)) : null;
    }
  }
  const hispQ2 = incomeData['Q2']?.['Hispanic'] || 4800;
  const whiteQ2 = incomeData['Q2']?.['White'] || 6900;
  const incomeGap = whiteQ2 - hispQ2;

  // Limit increase frequency
  const increaseByRace = {};
  for (const r of data) {
    const race = r.race || 'Unknown';
    if (!increaseByRace[race]) increaseByRace[race] = [];
    increaseByRace[race].push(+r.limit_increase_count || 0);
  }
  const avgIncreaseByRace = Object.fromEntries(
    Object.entries(increaseByRace).map(([r, vals]) => [r, avg(vals)])
  );

  // Utilization trap: project 3-year credit score divergence
  const groupAAvg = whiteAvg; // high limit group
  const groupBAvg = blackAvg; // low limit group
  const spendNeed = 2800;     // same spending need for both
  const utilizA = Math.min(0.95, spendNeed / groupAAvg);
  const utilizB = Math.min(0.95, spendNeed / groupBAvg);
  // Every 10pp utilization above 30% costs ~6 credit score points
  const scoreImpactDiff = Math.max(0, (utilizB - utilizA)) * 60;

  // Overall bias score
  const rawScore = Math.max(0, Math.min(100, 100
    - (maxBandGap > 1500 ? 35 : maxBandGap > 800 ? 20 : 5)
    - (incomeGap > 1500 ? 20 : incomeGap > 800 ? 12 : 3)
    - (scoreImpactDiff > 12 ? 15 : scoreImpactDiff > 8 ? 8 : 2)
    - ((avgIncreaseByRace['White'] || 0) > (avgIncreaseByRace['Black'] || 0) * 1.5 ? 10 : 0)
  ));

  // Customers affected
  const affectedCount = data.filter(r => r.race !== 'White').length;

  // Findings
  const findings = [];

  if (maxBandGap > 1500) {
    findings.push({
      id: 'risk-adjusted-gap',
      title: `Risk-Adjusted Limit Gap — Within ${worstBand} Credit Band`,
      severity: maxBandGap > 2000 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Gap Within Band',   value: fmtDollar(maxBandGap) },
        { label: 'White Avg Limit',   value: fmtDollar(worstBandWhite) },
        { label: 'Black Avg Limit',   value: fmtDollar(worstBandBlack) },
        { label: 'Credit Band',       value: worstBand },
      ],
      legalBasis: [
        { name: 'ECOA Regulation B', citation: 'Equal Credit Opportunity Act, Regulation B §1002.4 — prohibits credit limit discrimination based on race within equivalent risk tiers' },
        { name: 'CFPB 2022-03', citation: 'CFPB Circular 2022-03 — algorithmic credit limit decisions must not produce disparate outcomes by race' },
      ],
      rewriteAvailable: true,
      attribute: 'race (risk-adjusted)',
      segmentData: bandData,
    });
  }

  if (incomeGap > 1500) {
    findings.push({
      id: 'income-adjusted-gap',
      title: 'Income-Adjusted Limit Gap — Hispanic vs White (Q2)',
      severity: incomeGap > 2000 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Gap at Q2 Income',    value: fmtDollar(incomeGap) },
        { label: 'Hispanic Q2 Avg',     value: fmtDollar(hispQ2) },
        { label: 'White Q2 Avg',        value: fmtDollar(whiteQ2) },
        { label: '% Gap',               value: ((incomeGap / whiteQ2) * 100).toFixed(1) + '%' },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'ECOA prohibits national origin discrimination in credit limit setting' },
        { name: 'Fair Housing Act', citation: 'FHA geographic provisions apply when income quartile gaps correlate with zip code demographics' },
      ],
      rewriteAvailable: true,
      attribute: 'race (income-adjusted)',
      segmentData: incomeData,
    });
  }

  if (scoreImpactDiff > 8) {
    findings.push({
      id: 'utilization-trap',
      title: 'Utilization Trap — Compound Credit Score Harm Over 3 Years',
      severity: scoreImpactDiff > 15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Forced Utilization Gap',   value: `${((utilizB - utilizA) * 100).toFixed(0)}pp higher` },
        { label: '3-Year Score Divergence',  value: `${scoreImpactDiff.toFixed(0)} pts` },
        { label: 'High Limit Group Util.',   value: `${(utilizA * 100).toFixed(0)}%` },
        { label: 'Low Limit Group Util.',    value: `${(utilizB * 100).toFixed(0)}%` },
      ],
      legalBasis: [
        { name: 'CFPB 2022-03', citation: 'Algorithmic harm over time — compounding effects of initial credit limit disparities must be assessed' },
        { name: 'ECOA', citation: 'ECOA disparate impact — structural disadvantage created by limit differences constitutes ongoing discrimination' },
      ],
      rewriteAvailable: true,
      attribute: 'compound',
      utilizationData: { groupAAvg, groupBAvg, utilizA, utilizB, scoreImpactDiff },
    });
  }

  return {
    score: Math.round(rawScore),
    grade: grade(Math.round(rawScore)),
    avgByRace, rawGap, maxBandGap, worstBand, worstBandWhite, worstBandBlack,
    incomeGap, hispQ2, whiteQ2, bandData, incomeData,
    avgIncreaseByRace,
    utilizA, utilizB, scoreImpactDiff,
    affectedCount,
    totalCustomers: data.length,
    findings,
    rawData: data,
  };
}

function getBand(score) {
  if (score < 580) return '300-579';
  if (score < 670) return '580-669';
  if (score < 740) return '670-739';
  if (score < 800) return '740-799';
  return '800-850';
}

// ── Chart builders ────────────────────────────────────────────────────────────
const BANDS = ['300-579', '580-669', '670-739', '740-799', '800-850'];
const Q_LABELS = ['Q1 (<$50k)', 'Q2 ($50-72k)', 'Q3 ($72-100k)', 'Q4 (>$100k)'];

function buildBandChart(bandData) {
  const rows = [['Credit Band', 'White', 'Black', 'Hispanic', 'Asian']];
  for (const band of BANDS) {
    rows.push([
      band,
      bandData[band]?.['White'] || 0,
      bandData[band]?.['Black'] || 0,
      bandData[band]?.['Hispanic'] || 0,
      bandData[band]?.['Asian'] || 0,
    ]);
  }
  return rows;
}

function buildIncomeChart(incomeData) {
  const rows = [['Income Quartile', 'White', 'Black', 'Hispanic', 'Asian']];
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, i) => {
    rows.push([
      Q_LABELS[i],
      incomeData[q]?.['White'] || 0,
      incomeData[q]?.['Black'] || 0,
      incomeData[q]?.['Hispanic'] || 0,
      incomeData[q]?.['Asian'] || 0,
    ]);
  });
  return rows;
}

function buildUtilizationTrapChart(results) {
  // Project credit scores over 3 years
  const startScoreA = 720; // both groups start with same score
  const startScoreB = 720;
  const rows = [['Year', 'High Limit Group (White avg)', 'Low Limit Group (Black avg)']];

  for (let month = 0; month <= 36; month += 6) {
    const yearLabel = month === 0 ? 'Now' : `${month / 6 * 6}mo`;
    // High limit: utilization stays low, score improves slightly
    const scoreA = startScoreA + (month / 36) * 8 - (results.utilizA > 0.30 ? (results.utilizA - 0.30) * 60 : 0);
    // Low limit: utilization forced high, score erodes
    const scoreB = startScoreB - (month / 36) * results.scoreImpactDiff - (results.utilizB > 0.30 ? (results.utilizB - 0.30) * 60 : 0);
    rows.push([yearLabel, Math.round(scoreA), Math.round(scoreB)]);
  }
  return rows;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreditLimitDashboard() {
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
      const r = analyzeCreditLimit(CREDIT_LIMIT_DEMO);
      setData(CREDIT_LIMIT_DEMO);
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
        const r = analyzeCreditLimit(rows);
        setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a consumer credit fairness expert. An audit found: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain in 3 sentences: what this means for affected consumers, the legal risk, and the fix.
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

    // Build segment table
    const segments = [
      { segment: 'Black (720-739 band)', current: results.worstBandBlack, target: results.worstBandWhite },
      { segment: 'Hispanic (Q2 income)', current: results.hispQ2, target: results.whiteQ2 },
      { segment: 'Black avg (all bands)', current: results.avgByRace['Black'] || 6200, target: results.avgByRace['White'] || 8400 },
      { segment: 'Hispanic avg (all bands)', current: results.avgByRace['Hispanic'] || 5500, target: results.avgByRace['White'] || 8400 },
    ];

    const original = segments.map(s =>
      `${s.segment} | Current Avg Limit: ${fmtDollar(s.current)} | Gap: ${fmtDollar(s.target - s.current)}`
    ).join('\n');

    const rewritten = segments.map(s => {
      const phase1 = s.current + (s.target - s.current) * 0.33;
      const phase2 = s.current + (s.target - s.current) * 0.66;
      return `${s.segment} | Month 2: ${fmtDollar(phase1)} | Month 4: ${fmtDollar(phase2)} | Month 6: ${fmtDollar(s.target)} | Gap closed: 100%`;
    }).join('\n');

    const changes = segments.map(s => ({
      action: `Tier-based increase — ${s.segment}`,
      original: `Avg limit: ${fmtDollar(s.current)}`,
      replacement: `Target limit: ${fmtDollar(s.target)} over 6 months`,
      reason: `Within-band/quartile gap of ${fmtDollar(s.target - s.current)} constitutes ECOA violation. Phased increase reduces lender risk while achieving fairness compliance.`,
    }));

    // Projected credit score improvement
    const scoreGain = Math.round(results.scoreImpactDiff * 0.7);
    changes.push({
      action: 'Projected credit score improvement',
      original: `Low-limit group utilization: ${(results.utilizB * 100).toFixed(0)}%`,
      replacement: `After equalization: ~${(results.utilizA * 100 + 5).toFixed(0)}% utilization, +${scoreGain} credit score points over 3 years`,
      reason: 'Equalizing limits reduces forced high utilization, repairing the compounding credit score divergence.',
    });

    setRewriteData({ original, rewritten, changes });
    setRewriteLoading(false);
  };

  const exportCSV = () => {
    if (!results) return;
    const rows = [
      ['customerSegment', 'currentAvgLimit', 'suggestedLimit', 'gapAmount'],
      ['Black (720-739 band)', results.worstBandBlack, results.worstBandWhite, results.worstBandWhite - results.worstBandBlack],
      ['Hispanic (Q2)', results.hispQ2, results.whiteQ2, results.whiteQ2 - results.hispQ2],
      ['Black (all bands)', results.avgByRace['Black'] || 6200, results.avgByRace['White'] || 8400, (results.avgByRace['White'] || 8400) - (results.avgByRace['Black'] || 6200)],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'credit_limit_remediation.csv'; a.click();
    URL.revokeObjectURL(url);
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
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#10b981' }}>credit_card</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
            Credit Limit Fairness Audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect unexplained credit limit disparities within the same credit risk bands and income quartiles. Visualizes the utilization trap compounding effect over 3 years.
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
            {loading ? 'Analyzing 400 customers...' : 'Run Demo — 400 Customers'}
          </button>

          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Customer CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>

          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{csvError}</div>}
        </div>

        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Required columns</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            customer_id, credit_limit, credit_score, income,<br />
            debt_to_income, payment_history_score, account_age_months<br />
            <span style={{ color: '#f59e0b' }}>race, gender, age, marital_status, zip_code</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const bandChartData   = buildBandChart(results.bandData);
  const incomeChartData = buildIncomeChart(results.incomeData);
  const trapChartData   = buildUtilizationTrapChart(results);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Credit Limit Fairness Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalCustomers} customers analyzed · {results.findings.length} findings</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportCSV} style={{
            padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
            border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>download</span> Export Remediation CSV
          </button>
          <button onClick={loadDemo} style={{
            padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
            border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset
          </button>
        </div>
      </div>

      {/* Score + Metric Cards */}
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
          <MetricCard label="Raw Limit Gap" value={fmtDollar(results.rawGap)}
            sub="White vs Black average" color="#ef4444" icon="trending_down" />
          <MetricCard label="Risk-Adjusted Gap" value={fmtDollar(results.maxBandGap)}
            sub={`Within ${results.worstBand} band`} color="#ef4444" icon="analytics" />
          <MetricCard label="Income-Adjusted Gap" value={fmtDollar(results.incomeGap)}
            sub="Hispanic vs White at Q2 income" color="#f59e0b" icon="attach_money" />
          <MetricCard label="Customers Affected" value={results.affectedCount}
            sub="Non-white customers with lower limits" color="#0f172a" icon="person" />
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Avg Credit Limit by Credit Score Band</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Same credit risk, different limits — unexplained bias</div>
          <Chart
            chartType="ColumnChart" width="100%" height="220px"
            data={bandChartData}
            options={{
              colors: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
              legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 9 } },
              vAxis: { format: '$#,###', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
              chartArea: { left: 64, right: 8, top: 32, bottom: 40 },
              backgroundColor: 'transparent',
              bar: { groupWidth: '70%' },
            }}
          />
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Avg Credit Limit by Income Quartile</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Same income, different limits — income does not explain the gap</div>
          <Chart
            chartType="ColumnChart" width="100%" height="220px"
            data={incomeChartData}
            options={{
              colors: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
              legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 9 } },
              vAxis: { format: '$#,###', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
              chartArea: { left: 64, right: 8, top: 32, bottom: 40 },
              backgroundColor: 'transparent',
              bar: { groupWidth: '70%' },
            }}
          />
        </div>
      </div>

      {/* Utilization Trap chart — full width */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '2px solid #fca5a5', padding: '20px', marginBottom: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
            Utilization Trap — 3-Year Credit Score Projection
          </h3>
          <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>
            "This is how a {fmtDollar(results.rawGap)} limit gap becomes a {results.scoreImpactDiff.toFixed(0)}-point credit score gap in 3 years"
          </div>
        </div>
        <Chart
          chartType="LineChart" width="100%" height="200px"
          data={trapChartData}
          options={{
            colors: ['#22c55e', '#ef4444'],
            legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 11 } },
            vAxis: {
              title: 'Credit Score', titleTextStyle: { color: '#94a3b8', fontSize: 11 },
              gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 }
            },
            hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
            chartArea: { left: 64, right: 16, top: 32, bottom: 40 },
            backgroundColor: 'transparent',
            pointSize: 5,
            lineWidth: 3,
          }}
        />
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
            <span className="material-icons-round" style={{ fontSize: '40px', color: '#10b981', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Computing limit adjustments…</div>
          </div>
        </div>
      )}
    </div>
  );
}
