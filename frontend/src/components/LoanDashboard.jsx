import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { LOAN_DEMO } from '../data/loanDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';

// ── Helpers ─────────────────────────────────────────────────────────────────
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function fmt(n) { return (n * 100).toFixed(1) + '%'; }
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = '#0f172a', icon, pulse }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px', padding: '20px 24px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: '160px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {icon && <span className="material-icons-round" style={{ fontSize: '18px', color: '#64748b' }}>{icon}</span>}
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        {pulse && (
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444',
            display: 'inline-block',
            animation: 'pulse-dot 1.4s ease-in-out infinite'
          }} />
        )}
      </div>
      <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ── Analysis Engine ───────────────────────────────────────────────────────────
function analyzeLoan(data) {
  const hasZip = data.some(r => r.zip_code);

  // Approval rates
  const groups = {};
  for (const r of data) {
    const race = r.race || 'Unknown';
    const gender = r.gender || 'Unknown';
    const age = r.age_group || (parseInt(r.age) >= 55 ? '55+' : '25-54');
    const iq = r.income_quartile || 'Q2';

    if (!groups[race]) groups[race] = { total: 0, approved: 0 };
    groups[race].total++;
    groups[race].approved += +r.approved;
  }

  const raceRates = {};
  Object.entries(groups).forEach(([r, g]) => {
    raceRates[r] = g.total > 0 ? g.approved / g.total : 0;
  });

  const whiteRate = raceRates['White'] || 0.5;

  // Disparate Impact
  const di = {};
  Object.entries(raceRates).forEach(([r, rate]) => {
    di[r] = whiteRate > 0 ? +(rate / whiteRate).toFixed(3) : 1;
  });

  // Age group DI
  const ageGroups = {};
  for (const r of data) {
    const ag = r.age_group || (parseInt(r.age) >= 55 ? '55+' : '25-54');
    if (!ageGroups[ag]) ageGroups[ag] = { total: 0, approved: 0 };
    ageGroups[ag].total++;
    ageGroups[ag].approved += +r.approved;
  }
  const ageRates = {};
  Object.entries(ageGroups).forEach(([g, v]) => {
    ageRates[g] = v.total > 0 ? v.approved / v.total : 0;
  });
  const ageRef = ageRates['25-54'] || whiteRate;
  const ageDI = {};
  Object.entries(ageRates).forEach(([g, v]) => {
    ageDI[g] = ageRef > 0 ? +(v / ageRef).toFixed(3) : 1;
  });

  // Income-quartile adjusted
  const incomeAdjusted = {};
  for (const r of data) {
    const iq = r.income_quartile || 'Q2';
    if (!incomeAdjusted[iq]) incomeAdjusted[iq] = {};
    const race = r.race || 'Unknown';
    if (!incomeAdjusted[iq][race]) incomeAdjusted[iq][race] = { total: 0, approved: 0 };
    incomeAdjusted[iq][race].total++;
    incomeAdjusted[iq][race].approved += +r.approved;
  }
  // Check if bias persists in each quartile
  let biasedQuartiles = 0;
  for (const [q, races] of Object.entries(incomeAdjusted)) {
    const qWhite = races['White'] ? races['White'].approved / races['White'].total : null;
    const qBlack = races['Black'] ? races['Black'].approved / races['Black'].total : null;
    if (qWhite && qBlack && qWhite > 0 && (qBlack / qWhite) < 0.80) biasedQuartiles++;
  }

  // Intersectional: Black women vs White men
  const blackWomen = data.filter(r => r.race === 'Black' && r.gender === 'Female');
  const whiteMen   = data.filter(r => r.race === 'White' && r.gender === 'Male');
  const blackWomenRate = blackWomen.length ? blackWomen.filter(r => r.approved).length / blackWomen.length : 0;
  const whiteMenRate   = whiteMen.length   ? whiteMen.filter(r => r.approved).length / whiteMen.length : 0;

  // Score
  const blacks = data.filter(r => r.race === 'Black');
  const blackApproval = blacks.length ? blacks.filter(r => r.approved).length / blacks.length : 0;
  const blackDI = whiteRate > 0 ? blackApproval / whiteRate : 1;
  const ageSevereDI = ageDI['55+'] || 1;
  const intersectGap = whiteMenRate > 0 ? (whiteMenRate - blackWomenRate) / whiteMenRate : 0;

  const rawScore = Math.max(0, Math.min(100, 100
    - (blackDI < 0.80 ? Math.round((0.80 - blackDI) * 150) : 0)
    - (ageSevereDI < 0.80 ? Math.round((0.80 - ageSevereDI) * 80) : 0)
    - (biasedQuartiles >= 3 ? 25 : biasedQuartiles * 8)
    - (intersectGap > 0.35 ? 15 : intersectGap > 0.25 ? 8 : 0)
  ));

  // Build findings
  const findings = [];

  // 1. Racial disparate impact
  const worstDI = Math.min(...Object.values(di).filter(v => v < 1));
  const worstGroup = Object.entries(di).find(([_, v]) => v === worstDI)?.[0] || 'Black';
  if (worstDI < 0.80) {
    findings.push({
      id: 'racial-di',
      title: `Racial Disparate Impact — ${worstGroup} Applicants`,
      severity: worstDI < 0.70 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Disparate Impact',  value: worstDI.toFixed(2) },
        { label: `${worstGroup} Rate`, value: pct(raceRates[worstGroup] || 0) },
        { label: 'White Rate',        value: pct(whiteRate) },
        { label: 'Legal Threshold',   value: '0.80' },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'Equal Credit Opportunity Act (15 U.S.C. §1691) — prohibits credit discrimination based on race, national origin' },
        { name: 'Fair Housing Act', citation: 'FHA §3605 — prohibits discriminatory mortgage lending practices' },
        { name: 'HMDA', citation: 'Home Mortgage Disclosure Act — requires collection and disclosure of loan data by race/ethnicity' },
      ],
      rewriteAvailable: true,
      attribute: worstGroup,
      groupRates: raceRates,
    });
  }

  // 2. Age disparate impact
  if ((ageDI['55+'] || 1) < 0.80) {
    findings.push({
      id: 'age-di',
      title: 'Age Disparate Impact — Applicants 55+',
      severity: (ageDI['55+'] || 1) < 0.65 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Age 55+ DI',    value: (ageDI['55+'] || 0).toFixed(2) },
        { label: 'Age 55+ Rate',  value: pct(ageRates['55+'] || 0) },
        { label: 'Under 55 Rate', value: pct(ageRates['25-54'] || 0) },
        { label: 'Legal Threshold', value: '0.80' },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'Equal Credit Opportunity Act — prohibits credit discrimination based on age' },
        { name: 'CFPB Reg B', citation: 'Regulation B §1002.6 — age cannot be used as a negative factor in credit scoring systems' },
      ],
      rewriteAvailable: true,
      attribute: 'age',
      groupRates: ageRates,
    });
  }

  // 3. Income-adjusted bias
  if (biasedQuartiles >= 3) {
    findings.push({
      id: 'income-adjusted-bias',
      title: 'Income-Adjusted Bias Persists Across All Quartiles',
      severity: biasedQuartiles === 4 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Biased Quartiles', value: `${biasedQuartiles}/4` },
        { label: 'Implication', value: 'Not income-related' },
        { label: 'Black Approval',  value: pct(blackApproval) },
        { label: 'White Approval',  value: pct(whiteRate) },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'ECOA disparate impact theory — bias unexplained by income constitutes illegal discrimination' },
        { name: 'CFPB Circular 2022-03', citation: 'Algorithmic decision-making must not produce outcomes that correlate with protected characteristics' },
      ],
      rewriteAvailable: true,
      attribute: 'race (income-adjusted)',
      groupRates: raceRates,
    });
  }

  // 4. Intersectional
  if (whiteMenRate > 0 && (blackWomenRate / whiteMenRate) < 0.60) {
    findings.push({
      id: 'intersectional',
      title: `Intersectional Compound Bias — Black Women vs White Men`,
      severity: 'HIGH',
      metrics: [
        { label: 'Black Women',   value: pct(blackWomenRate) },
        { label: 'White Men',     value: pct(whiteMenRate) },
        { label: 'Approval Gap',  value: `${((whiteMenRate - blackWomenRate) * 100).toFixed(0)}pp` },
        { label: 'Compound DI',   value: (blackWomenRate / whiteMenRate).toFixed(2) },
      ],
      legalBasis: [
        { name: 'ECOA', citation: 'Intersectional discrimination — Lam v. Univ. of Hawaii doctrine applied to credit, considering combined protected characteristics' },
        { name: 'Fair Housing Act', citation: 'FHA covers intersectional discrimination in mortgage lending' },
      ],
      rewriteAvailable: true,
      attribute: 'race+gender',
      groupRates: { 'Black Women': blackWomenRate, 'White Men': whiteMenRate },
    });
  }

  return {
    score: Math.round(rawScore),
    grade: grade(Math.round(rawScore)),
    raceRates, ageRates, ageDI, di,
    whiteRate, blackApproval, blackDI,
    blackWomenRate, whiteMenRate,
    biasedQuartiles, incomeAdjusted,
    hasZip,
    totalApplicants: data.length,
    findings,
    rawData: data,
  };
}

// ── Chart data builders ───────────────────────────────────────────────────────
function buildRaceChart(raceRates) {
  const rows = [['Race/Ethnicity', 'Approval Rate', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  Object.entries(raceRates).forEach(([r, rate]) => {
    rows.push([r, +(rate * 100).toFixed(1), colors[r] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  });
  return rows;
}

function buildIncomeChart(incomeAdjusted, raceRates) {
  const races = Object.keys(raceRates);
  const rows = [['Income Quartile', ...races]];
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
    const row = [q];
    races.forEach(r => {
      const g = incomeAdjusted[q]?.[r];
      row.push(g && g.total > 0 ? +(g.approved / g.total * 100).toFixed(1) : 0);
    });
    rows.push(row);
  });
  return rows;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LoanDashboard() {
  const [results, setResults]     = useState(null);
  const [data,    setData]        = useState(null);
  const [loading, setLoading]     = useState(false);
  const [csvError, setCsvError]   = useState('');
  const [aiExplained, setAiExplained] = useState({});
  const [rewriteOpen, setRewriteOpen]   = useState(false);
  const [rewriteData, setRewriteData]   = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const r = analyzeLoan(LOAN_DEMO);
      setData(LOAN_DEMO);
      setResults(r);
      setLoading(false);
      try {
        sessionStorage.setItem('fl_loan_results', JSON.stringify({
          ...r, moduleId: 'loan', moduleName: 'Loan Approval Audit',
          timestamp: new Date().toISOString()
        }));
      } catch {}
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
        const r = analyzeLoan(rows);
        setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a fair lending expert. A loan approval bias audit found: "${finding.title}" with severity ${finding.severity}.
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain in 3 plain-English sentences: what this means for affected applicants, the regulatory risk, and the most impactful remediation step.
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

    const segments = Object.entries(finding.groupRates || {}).slice(0, 8);
    const whiteRate = finding.groupRates?.['White'] || results?.whiteRate || 0.7;
    const targetDI = 0.80;

    const originalLines = segments.map(([seg, rate]) => {
      const di = whiteRate > 0 ? (rate / whiteRate) : 1;
      return `${seg} | Current Rate: ${pct(rate)} | DI: ${di.toFixed(2)} | Status: ${di < 0.80 ? '❌ BELOW THRESHOLD' : '✓ OK'}`;
    }).join('\n');

    const rewrittenLines = segments.map(([seg, rate]) => {
      const di = whiteRate > 0 ? (rate / whiteRate) : 1;
      const suggestedRate = di < 0.80 ? Math.min(whiteRate, rate / 0.80 * 1.05) : rate;
      return `${seg} | Suggested Rate: ${pct(suggestedRate)} | DI after: ${Math.min(1.0, suggestedRate / whiteRate).toFixed(2)} | Change: ${pct(suggestedRate) !== pct(rate) ? '+' + ((suggestedRate - rate) * 100).toFixed(1) + 'pp' : 'No change needed'}`;
    }).join('\n');

    const changes = segments
      .filter(([seg, rate]) => whiteRate > 0 && (rate / whiteRate) < 0.80)
      .map(([seg, rate]) => ({
        action: `Threshold Adjustment — ${seg}`,
        original: `Approval rate: ${pct(rate)}`,
        replacement: `Target rate: ${pct(Math.min(whiteRate, rate / 0.80 * 1.05))}`,
        reason: `Disparate impact ${(rate / whiteRate).toFixed(2)} is below 0.80 legal threshold. Adjusting approval criteria to bring into compliance.`,
      }));

    setRewriteData({ original: originalLines, rewritten: rewrittenLines, changes });
    setRewriteLoading(false);
  };

  // ── Upload screen ─────────────────────────────────────────────────────────
  if (!results) {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <style>{`
          @keyframes pulse-dot {
            0%,100% { opacity:1; transform:scale(1); }
            50% { opacity:0.5; transform:scale(1.4); }
          }
        `}</style>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 20px',
            borderRadius: '18px', backgroundColor: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#3b82f6' }}>account_balance</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
            Loan Approval Bias Audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect discriminatory patterns in loan approval decisions. Computes disparate impact by race, age, income quartile, and intersectional groups. Surfaces ECOA/FHA compliance risks.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
          <button
            onClick={loadDemo}
            disabled={loading}
            style={{
              padding: '18px 24px', backgroundColor: '#0f172a', color: '#fff',
              border: 'none', borderRadius: '12px', cursor: loading ? 'wait' : 'pointer',
              fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '10px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.3)'
            }}
          >
            <span className="material-icons-round">science</span>
            {loading ? 'Loading 600 applicants...' : 'Try 600 Applicant Demo Dataset'}
          </button>

          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Loan Applications CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>

          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>{csvError}</div>}
        </div>

        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Required CSV columns
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            applicant_id, approved (0/1), income, credit_score,<br />
            debt_to_income, loan_amount, loan_purpose, zip_code,<br />
            <span style={{ color: '#f59e0b' }}>race, gender, age</span> — sensitive, for analysis only
          </div>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const raceChartData  = buildRaceChart(results.raceRates);
  const incomeChartData = buildIncomeChart(results.incomeAdjusted, results.raceRates);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      <style>{`
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.5; transform:scale(1.4); }
        }
      `}</style>

      {/* Redlining warning banner */}
      {results.hasZip && (
        <div style={{
          backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
          display: 'flex', alignItems: 'flex-start', gap: '12px'
        }}>
          <span className="material-icons-round" style={{ fontSize: '22px', color: '#d97706', flexShrink: 0, marginTop: '2px' }}>location_on</span>
          <div>
            <div style={{ fontWeight: '700', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
              ZIP Code Redlining Proxy Detected
            </div>
            <div style={{ color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}>
              This dataset includes <strong>zip_code</strong> as an input field. Under HMDA guidelines, zip codes function as proxies for race and neighborhood demographics. Any premium or approval rate variation correlated with zip code may constitute <strong>modern redlining</strong> under Fair Housing Act §36. VectoFair has audited zip code as a sensitive attribute.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Loan Approval Bias Audit Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalApplicants} applicants analyzed · {results.findings.length} findings</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Regulatory risk badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', backgroundColor: '#fef2f2', border: '2px solid #ef4444',
            borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#dc2626'
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444',
              display: 'inline-block', animation: 'pulse-dot 1.4s ease-in-out infinite'
            }} />
            Regulatory Risk: HIGH
          </div>
          <button onClick={loadDemo} style={{
            padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
            border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset Demo
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
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>Equity Score</div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <MetricCard
            label="Black Applicant DI" pulse
            value={(results.blackDI || 0).toFixed(2)}
            sub={`${pct(results.blackApproval)} vs ${pct(results.whiteRate)} White`}
            color={(results.blackDI || 1) < 0.70 ? '#ef4444' : '#f59e0b'}
            icon="groups"
          />
          <MetricCard
            label="Age 55+ DI"
            value={(results.ageDI?.['55+'] || 0).toFixed(2)}
            sub="vs under-55 approval rate"
            color={(results.ageDI?.['55+'] || 1) < 0.70 ? '#ef4444' : '#f59e0b'}
            icon="elderly"
          />
          <MetricCard
            label="Biased Quartiles"
            value={`${results.biasedQuartiles}/4`}
            sub="Income-adjusted bias persists"
            color={results.biasedQuartiles >= 3 ? '#ef4444' : '#f59e0b'}
            icon="bar_chart"
          />
          <MetricCard
            label="Intersectional"
            value={`${pct(results.blackWomenRate)} vs ${pct(results.whiteMenRate)}`}
            sub="Black women vs White men"
            color="#ef4444"
            icon="people"
          />
        </div>
      </div>

      {/* Intersectional callout */}
      {results.blackWomenRate < results.whiteMenRate * 0.60 && (
        <div style={{
          backgroundColor: '#fff', border: '2px solid #fca5a5', borderRadius: '12px',
          padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '20px'
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <span className="material-icons-round" style={{ color: '#ef4444', fontSize: '24px' }}>warning</span>
          </div>
          <div>
            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px', marginBottom: '4px' }}>
              Compound Bias Badge — Intersectional Worst Case
            </div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>
              Black women approved at <strong style={{ color: '#ef4444' }}>{pct(results.blackWomenRate)}</strong> vs White men at <strong style={{ color: '#10b981' }}>{pct(results.whiteMenRate)}</strong> — a <strong style={{ color: '#ef4444' }}>{((results.whiteMenRate - results.blackWomenRate) * 100).toFixed(0)} percentage point gap</strong>.
              This intersectional compound bias exceeds both racial and gender gaps independently.
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Approval Rate by Race/Ethnicity</h3>
          <Chart
            chartType="ColumnChart"
            width="100%" height="220px"
            data={raceChartData}
            options={{
              legend: 'none',
              vAxis: { format: '#\'%\'', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 }, viewWindow: { min: 0, max: 100 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 48, right: 16, top: 8, bottom: 40 },
              backgroundColor: 'transparent',
              annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
              bar: { groupWidth: '60%' },
            }}
          />
          {/* 80% threshold line label */}
          <div style={{ fontSize: '11px', color: '#ef4444', textAlign: 'center', marginTop: '4px' }}>
            — 80% Disparate Impact Threshold (below = ECOA violation)
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Income-Adjusted Approval Rate</h3>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', marginBottom: '12px' }}>
            Bias not explained by income
          </div>
          <Chart
            chartType="LineChart"
            width="100%" height="200px"
            data={incomeChartData}
            options={{
              colors: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
              legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 10 } },
              vAxis: { format: '#\'%\'', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 }, viewWindow: { min: 0, max: 100 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 48, right: 16, top: 32, bottom: 32 },
              backgroundColor: 'transparent',
              pointSize: 6,
              lineWidth: 2,
            }}
          />
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
            <span className="material-icons-round" style={{ fontSize: '40px', color: '#3b82f6', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Computing threshold adjustments…</div>
          </div>
        </div>
      )}
    </div>
  );
}
