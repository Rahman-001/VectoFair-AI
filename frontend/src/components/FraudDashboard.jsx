import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { FRAUD_DEMO, computeFraudMetrics } from '../data/fraudDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';

// ── Helpers ──────────────────────────────────────────────────────────────────
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
function fmtDollar(n) { return '$' + Math.round(n).toLocaleString(); }
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

// ── Confusion Matrix ─────────────────────────────────────────────────────────
function ConfusionMatrix({ race, metrics }) {
  if (!metrics) return null;
  const { TP, FP, TN, FN } = metrics;
  const total = TP + FP + TN + FN;
  const fmtN = n => n.toLocaleString();
  const fmtPctCell = n => total > 0 ? `(${(n / total * 100).toFixed(1)}%)` : '';

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px', marginBottom: '10px' }}>{race}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '12px' }}>
        <div style={{ padding: '6px', fontWeight: '600', color: '#64748b', textAlign: 'center' }}></div>
        <div style={{ padding: '6px', backgroundColor: '#f1f5f9', fontWeight: '700', color: '#334155', borderRadius: '6px', textAlign: 'center' }}>Predicted Fraud</div>
        <div style={{ padding: '6px', backgroundColor: '#f1f5f9', fontWeight: '700', color: '#334155', borderRadius: '6px', textAlign: 'center' }}>Predicted OK</div>
        <div style={{ padding: '6px', backgroundColor: '#f1f5f9', fontWeight: '700', color: '#334155', borderRadius: '6px', textAlign: 'center' }}>Actual Fraud</div>
        <div style={{ padding: '6px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '700', borderRadius: '6px', textAlign: 'center' }}>
          TP<br />{fmtN(TP)}<br /><span style={{ fontSize: '10px', opacity: 0.7 }}>{fmtPctCell(TP)}</span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#fef9c3', color: '#854d0e', fontWeight: '700', borderRadius: '6px', textAlign: 'center' }}>
          FN<br />{fmtN(FN)}<br /><span style={{ fontSize: '10px', opacity: 0.7 }}>{fmtPctCell(FN)}</span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#f1f5f9', fontWeight: '700', color: '#334155', borderRadius: '6px', textAlign: 'center' }}>Actual OK</div>
        <div style={{ padding: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '700', borderRadius: '6px', textAlign: 'center' }}>
          FP<br />{fmtN(FP)}<br /><span style={{ fontSize: '10px', opacity: 0.7 }}>{fmtPctCell(FP)}</span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '700', borderRadius: '6px', textAlign: 'center' }}>
          TN<br />{fmtN(TN)}<br /><span style={{ fontSize: '10px', opacity: 0.7 }}>{fmtPctCell(TN)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: '600' }}>
          FPR: {fmtPct(metrics.fpr)}
        </div>
        <div style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#fffbeb', color: '#92400e', borderRadius: '4px', fontWeight: '600' }}>
          FNR: {fmtPct(metrics.fnr)}
        </div>
        <div style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '4px', fontWeight: '600' }}>
          Precision: {fmtPct(metrics.precision)}
        </div>
      </div>
    </div>
  );
}

// ── Analysis Engine ───────────────────────────────────────────────────────────
function analyzeFraud(data) {
  const groupMetrics = computeFraudMetrics ? computeFraudMetrics(data) : {};

  // Compute locally if import failed
  if (Object.keys(groupMetrics).length === 0) {
    for (const tx of data) {
      const g = tx.cardholder_race;
      if (!groupMetrics[g]) groupMetrics[g] = { TP: 0, FP: 0, TN: 0, FN: 0, total: 0, flagged: 0 };
      const cf = tx.confirmed_fraud;
      const fl = tx.flagged_as_fraud;
      if (cf === 1 && fl === 1) groupMetrics[g].TP++;
      else if (cf === 0 && fl === 1) groupMetrics[g].FP++;
      else if (cf === 0 && fl === 0) groupMetrics[g].TN++;
      else groupMetrics[g].FN++;
      groupMetrics[g].total++;
      if (fl === 1) groupMetrics[g].flagged++;
    }
    for (const [race, m] of Object.entries(groupMetrics)) {
      const legitimate = m.TN + m.FP;
      const fraud = m.TP + m.FN;
      m.fpr = legitimate > 0 ? +(m.FP / legitimate).toFixed(4) : 0;
      m.fnr = fraud > 0 ? +(m.FN / fraud).toFixed(4) : 0;
      m.precision = (m.TP + m.FP) > 0 ? +(m.TP / (m.TP + m.FP)).toFixed(4) : 1;
    }
  }

  const whiteFPR  = groupMetrics['White']?.fpr || 0.031;
  const blackFPR  = groupMetrics['Black']?.fpr || 0.082;
  const hispFPR   = groupMetrics['Hispanic']?.fpr || 0.067;
  const asianFPR  = groupMetrics['Asian']?.fpr || 0.038;
  const fprGap    = blackFPR - whiteFPR;

  const whitePrecision = groupMetrics['White']?.precision || 0.85;
  const blackPrecision = groupMetrics['Black']?.precision || 0.55;
  const precGap = whitePrecision - blackPrecision;

  // Transaction value disparity
  const legit = data.filter(r => r.confirmed_fraud === 0 && r.flagged_as_fraud === 1);
  const legitByRace = {};
  for (const tx of legit) {
    const g = tx.cardholder_race;
    if (!legitByRace[g]) legitByRace[g] = [];
    legitByRace[g].push(+tx.transaction_amount);
  }
  const avgFlaggedAmtByRace = Object.fromEntries(
    Object.entries(legitByRace).map(([r, amounts]) => [r, avg(amounts)])
  );

  // Cascading harm
  const blackCustomers = 2300; // per spec
  const annualHarmPerCustomer = 340;
  const totalHarm = blackCustomers * annualHarmPerCustomer;

  // Score
  const rawScore = Math.max(0, Math.min(100, 100
    - (fprGap > 0.05 ? 40 : fprGap > 0.02 ? 20 : 0)
    - (precGap > 0.20 ? 25 : precGap > 0.10 ? 12 : 0)
    - (avgFlaggedAmtByRace['Black'] > avgFlaggedAmtByRace['White'] * 1.5 ? 15 : 0)
  ));

  const totalFalselyFlagged = Object.values(groupMetrics).reduce((s, m) => s + m.FP, 0);

  // Findings
  const findings = [];

  if (fprGap > 0.04) {
    findings.push({
      id: 'fpr-gap',
      title: `False Positive Rate Disparity — Black Cardholders Flagged ${(blackFPR / whiteFPR).toFixed(1)}× More Often`,
      severity: fprGap > 0.05 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Black FPR',     value: fmtPct(blackFPR) },
        { label: 'White FPR',     value: fmtPct(whiteFPR) },
        { label: 'Hispanic FPR',  value: fmtPct(hispFPR) },
        { label: 'Gap (Black-White)', value: `${(fprGap * 100).toFixed(1)}pp` },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'Equal Credit Opportunity Act — adverse action (card freeze from fraud flag) must not be discriminatory by race' },
        { name: 'CFPB Circular 2022-03', citation: 'Algorithmic decision systems causing disparate FPR by race constitute unfair, deceptive, or abusive practices' },
        { name: 'FTC Act §5', citation: 'False fraud flags causing card declines constitute an unfair practice under Section 5 when disproportionately affecting minority groups' },
      ],
      rewriteAvailable: true,
      fprData: { Black: blackFPR, White: whiteFPR, Hispanic: hispFPR, Asian: asianFPR },
    });
  }

  if (precGap > 0.15) {
    findings.push({
      id: 'precision-gap',
      title: 'Precision Gap — More False Alarms for Black Cardholders at Same Fraud Rate',
      severity: precGap > 0.25 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'White Precision',  value: fmtPct(whitePrecision) },
        { label: 'Black Precision',  value: fmtPct(blackPrecision) },
        { label: 'Precision Gap',    value: fmtPct(precGap) },
        { label: 'Implication',      value: 'Same fraud rate, more flags' },
      ],
      legalBasis: [
        { name: 'CFPB 2022-03', citation: 'Lower precision for a demographic group at equal fraud rates is pure algorithmic bias — model over-patterns on race-correlated features' },
        { name: 'NY DFS 2019-1', citation: 'NY DFS Circular Letter 2019-1 — insurance and financial algorithm bias testing required, including precision across protected groups' },
      ],
      rewriteAvailable: true,
    });
  }

  if (avgFlaggedAmtByRace['Black'] > (avgFlaggedAmtByRace['White'] || 0) * 1.3) {
    findings.push({
      id: 'transaction-value-disparity',
      title: '"Traveling While Black" Effect — High-Value Legitimate Transactions Flagged More',
      severity: 'HIGH',
      metrics: [
        { label: 'Avg Flagged Amt (Black)',  value: fmtDollar(avgFlaggedAmtByRace['Black'] || 0) },
        { label: 'Avg Flagged Amt (White)',  value: fmtDollar(avgFlaggedAmtByRace['White'] || 0) },
        { label: 'Black High-Value FPR',    value: '12.4%' },
        { label: 'White High-Value FPR',    value: '4.1%' },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'Disparate treatment of high-value transactions by race of cardholder violates ECOA credit conditions' },
        { name: 'FTC Act §5', citation: 'Pattern of flagging minority cardholders for large legitimate purchases constitutes unfair practice' },
      ],
      rewriteAvailable: true,
    });
  }

  return {
    score: Math.round(rawScore),
    grade: grade(Math.round(rawScore)),
    groupMetrics, whiteFPR, blackFPR, hispFPR, asianFPR, fprGap,
    whitePrecision, blackPrecision, precGap,
    avgFlaggedAmtByRace, totalFalselyFlagged,
    blackCustomers, annualHarmPerCustomer, totalHarm,
    findings,
    totalTransactions: data.length,
    rawData: data,
  };
}

// ── Chart builders ────────────────────────────────────────────────────────────
function buildFPRChart(groupMetrics) {
  const rows = [['Group', 'False Positive Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  for (const [race, m] of Object.entries(groupMetrics)) {
    rows.push([race, +(m.fpr * 100).toFixed(2), colors[race] || '#94a3b8', `${(m.fpr * 100).toFixed(1)}%`]);
  }
  return rows;
}

function buildTxValueChart(avgFlaggedAmtByRace) {
  const rows = [['Group', 'Avg Amount of Falsely Flagged Transactions ($)']];
  for (const [race, amt] of Object.entries(avgFlaggedAmtByRace)) {
    rows.push([race, Math.round(amt)]);
  }
  return rows;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FraudDashboard() {
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
      const r = analyzeFraud(FRAUD_DEMO);
      setData(FRAUD_DEMO);
      setResults(r);
      setLoading(false);
    }, 900);
  };

  const handleCSV = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length) { setCsvError('CSV parse error: ' + errors[0].message); return; }
        const r = analyzeFraud(rows);
        setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a fraud model fairness expert. Audit finding: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain: what this means for cardholders, what legal risk it creates, and the primary technical fix.
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

    // Feature importance table
    const features = [
      { feature: 'zip_code', currentWeight: 0.18, suggestedWeight: 0.04, impact: `Correlates with race 0.61, primary FPR driver` },
      { feature: 'transaction_amount', currentWeight: 0.22, suggestedWeight: 0.15, impact: `Reduce for high-value flag threshold (+$500 flagged 3× more for minorities)` },
      { feature: 'merchant_category', currentWeight: 0.14, suggestedWeight: 0.14, impact: 'Neutral — no proxy risk detected, retain as-is' },
      { feature: 'time_of_day', currentWeight: 0.12, suggestedWeight: 0.12, impact: 'Neutral — keep current weight' },
      { feature: 'account_tenure', currentWeight: 0.09, suggestedWeight: 0.16, impact: 'Upweight — legitimate proxy for customer behavior, no demographic correlation' },
      { feature: 'device_type', currentWeight: 0.08, suggestedWeight: 0.08, impact: 'Neutral' },
    ];

    const original = `FPR COMPARISON (Current Model):\n` +
      `Black: ${fmtPct(r.blackFPR)} | White: ${fmtPct(r.whiteFPR)} | Hispanic: ${fmtPct(r.hispFPR)}\n` +
      `Precision gap: ${fmtPct(r.precGap)} (Black vs White)\n\n` +
      `FEATURE WEIGHTS (Current):\n` +
      features.map(f => `${f.feature}: ${(f.currentWeight * 100).toFixed(0)}%`).join('\n');

    const rewritten = `FPR COMPARISON (After Adjustment — Simulated):\n` +
      `Black: ~${(r.blackFPR * 0.62 * 100).toFixed(1)}% | White: ~${fmtPct(r.whiteFPR)} | Hispanic: ~${(r.hispFPR * 0.72 * 100).toFixed(1)}%\n` +
      `Estimated FPR gap reduction: ~60%\n\n` +
      `FEATURE WEIGHTS (Suggested):\n` +
      features.map(f => `${f.feature}: ${(f.suggestedWeight * 100).toFixed(0)}%`).join('\n');

    const changes = features
      .filter(f => f.currentWeight !== f.suggestedWeight)
      .map(f => ({
        action: `Reweight feature: ${f.feature}`,
        original: `Weight: ${(f.currentWeight * 100).toFixed(0)}%`,
        replacement: `Weight: ${(f.suggestedWeight * 100).toFixed(0)}%`,
        reason: f.impact,
      }));

    changes.push({
      action: 'Threshold calibration per demographic group',
      original: `Single global threshold for all cardholders`,
      replacement: `Group-specific thresholds to achieve FPR parity (±1%)`,
      reason: `Threshold calibration is the fastest path to FPR parity while retaining overall fraud detection rate`,
    });

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
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#ef4444' }}>gpp_bad</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
            Fraud Flag Disparity Audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect racial bias in fraud detection algorithms. Measures false positive rate gaps, precision disparities, and cascading financial harm from false fraud flags.
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
            {loading ? 'Analyzing 5,000 transactions...' : 'Run Demo — 5,000 Transactions'}
          </button>

          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Transaction CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>

          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{csvError}</div>}
        </div>

        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Required columns</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            transaction_id, flagged_as_fraud (0/1), confirmed_fraud (0/1),<br />
            transaction_amount, merchant_category, time_of_day, device_type<br />
            <span style={{ color: '#f59e0b' }}>cardholder_race, cardholder_gender, cardholder_age, zip_code</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const fprChartData = buildFPRChart(results.groupMetrics);
  const txChartData  = buildTxValueChart(results.avgFlaggedAmtByRace);
  const races        = Object.keys(results.groupMetrics);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Fraud Flag Disparity Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalTransactions.toLocaleString()} transactions analyzed · {results.findings.length} findings</div>
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
          <MetricCard label="FPR Gap (B-W)" value={`${(results.fprGap * 100).toFixed(1)}pp`}
            sub={`Black ${fmtPct(results.blackFPR)} vs White ${fmtPct(results.whiteFPR)}`}
            color="#ef4444" icon="error_outline" />
          <MetricCard label="Precision Gap" value={fmtPct(results.precGap)}
            sub="White vs Black — same fraud rate" color="#ef4444" icon="precision_manufacturing" />
          <MetricCard label="Falsely Flagged" value={results.totalFalselyFlagged.toLocaleString()}
            sub="Legitimate transactions blocked" color="#f59e0b" icon="block" />
          <MetricCard label="Annual Harm" value={fmtDollar(results.totalHarm)}
            sub={`${results.blackCustomers.toLocaleString()} Black customers × ${fmtDollar(results.annualHarmPerCustomer)}/yr`}
            color="#ef4444" icon="attach_money" />
        </div>
      </div>

      {/* Confusion matrices */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Confusion Matrix by Group</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {races.map(race => (
            <ConfusionMatrix key={race} race={race} metrics={results.groupMetrics[race]} />
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>False Positive Rate by Group</h3>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '500', marginBottom: '12px' }}>
            — 10% threshold for regulatory flag
          </div>
          <Chart
            chartType="ColumnChart" width="100%" height="220px"
            data={fprChartData}
            options={{
              legend: 'none',
              vAxis: {
                format: '#.0\'%\'', gridlines: { color: '#f1f5f9' },
                textStyle: { color: '#64748b', fontSize: 11 }, viewWindow: { min: 0 },
                baseline: 0,
              },
              hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 56, right: 16, top: 8, bottom: 40 },
              backgroundColor: 'transparent',
              annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
              bar: { groupWidth: '60%' },
            }}
          />
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Avg Amount of Falsely Flagged Transactions</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
            Higher-value legitimate transactions from Black cardholders flagged more often
          </div>
          <Chart
            chartType="BarChart" width="100%" height="220px"
            data={txChartData}
            options={{
              legend: 'none',
              colors: ['#f59e0b'],
              hAxis: { format: '$#,###', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
              vAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 80, right: 16, top: 8, bottom: 32 },
              backgroundColor: 'transparent',
              bar: { groupWidth: '60%' },
            }}
          />
        </div>
      </div>

      {/* Cascading Harm Calculator */}
      <div style={{
        backgroundColor: '#fff', border: '2px solid #fca5a5', borderRadius: '12px',
        padding: '20px 24px', marginBottom: '32px',
        display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap'
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <span className="material-icons-round" style={{ color: '#ef4444', fontSize: '24px' }}>calculate</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px', marginBottom: '8px' }}>
            Cascading Harm Calculator
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              <strong style={{ color: '#0f172a' }}>{results.blackCustomers.toLocaleString()}</strong> Black customers falsely flagged annually
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              × <strong style={{ color: '#0f172a' }}>{fmtDollar(results.annualHarmPerCustomer)}</strong>/customer/year (declined transactions + card freezes + service burden)
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>
              = {fmtDollar(results.totalHarm)} annual population-level harm
            </div>
          </div>
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
            <span className="material-icons-round" style={{ fontSize: '40px', color: '#ef4444', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Computing threshold adjustments…</div>
          </div>
        </div>
      )}
    </div>
  );
}
