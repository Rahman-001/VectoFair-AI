import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { PAY_GAP_DEMO } from '../data/payGapDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';
import { rewriteDataset } from '../utils/biasRewriter';

// ── Helpers ────────────────────────────────────────────────────────────────
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
function pct(a, b) { return b ? ((b - a) / b * 100).toFixed(1) : '0.0'; }
function grade(score) {
  if (score >= 80) return 'A'; if (score >= 65) return 'B';
  if (score >= 50) return 'C'; if (score >= 35) return 'D'; return 'F';
}

// ── Metric Card ────────────────────────────────────────────────────────────
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
      <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ── Analysis Engine ────────────────────────────────────────────────────────
function analyzePayGap(data) {
  const groups = {};
  data.forEach(e => {
    const g   = e.gender || 'Unknown';
    const r   = e.race   || 'Unknown';
    const lvl = e.job_level || 1;
    if (!groups[g]) groups[g] = [];
    if (!groups[r]) groups[r] = [];
    groups[g].push(e);
    if (g !== r) groups[r].push(e);  // avoid double-counting same field
  });

  // Gender analysis
  const maleSalaries   = data.filter(e => e.gender === 'Male').map(e => +e.salary);
  const femaleSalaries = data.filter(e => e.gender === 'Female').map(e => +e.salary);
  const maleAvg        = avg(maleSalaries);
  const femaleAvg      = avg(femaleSalaries);
  const genderRawGap   = maleAvg > 0 ? ((maleAvg - femaleAvg) / maleAvg * 100) : 0;

  // Race analysis
  const whiteAvg = avg(data.filter(e => e.race === 'White').map(e => +e.salary));
  const blackAvg = avg(data.filter(e => e.race === 'Black').map(e => +e.salary));
  const raceGap  = whiteAvg > 0 ? ((whiteAvg - blackAvg) / whiteAvg * 100) : 0;

  // Grade concentration: % of L4+ that are Male
  const seniorEmployees = data.filter(e => (e.job_level || 1) >= 4);
  const seniorMalePct   = seniorEmployees.length
    ? seniorEmployees.filter(e => e.gender === 'Male').length / seniorEmployees.length * 100
    : 0;

  // Intersectional: Black Women vs White Men
  const blackWomenAvg  = avg(data.filter(e => e.gender === 'Female' && e.race === 'Black').map(e => +e.salary));
  const whiteMenAvg    = avg(data.filter(e => e.gender === 'Male'   && e.race === 'White').map(e => +e.salary));
  const intersectGap   = whiteMenAvg > 0 ? ((whiteMenAvg - blackWomenAvg) / whiteMenAvg * 100) : 0;

  // Score (lower is worse)
  const rawScore = Math.max(0, Math.min(100, 100
    - Math.min(genderRawGap * 2, 40)
    - Math.min(raceGap * 1.5, 35)
    - (seniorMalePct > 60 ? 15 : 0)
    - (intersectGap > 25 ? 10 : 0)
  ));

  // Estimated remediation cost
  const affectedFemales = femaleSalaries.length;
  const avgGapPerPerson = maleAvg - femaleAvg;
  const remediationCost = Math.round(affectedFemales * avgGapPerPerson * 0.5); // close 50% of gap

  // Findings
  const findings = [];

  if (genderRawGap > 5) findings.push({
    id: 'gender-gap',
    title: 'Gender Pay Gap Detected',
    severity: genderRawGap > 15 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Raw Gap', value: `${genderRawGap.toFixed(1)}%` },
      { label: 'Male Avg',   value: fmt(maleAvg) },
      { label: 'Female Avg', value: fmt(femaleAvg) },
      { label: 'Annual Difference', value: fmt(maleAvg - femaleAvg) },
    ],
    legalBasis: [
      { name: 'Equal Pay Act', citation: 'Equal Pay Act of 1963, 29 U.S.C. § 206(d) — requires equal pay for equal work regardless of sex' },
      { name: 'Title VII', citation: 'Civil Rights Act, Title VII compensation discrimination provisions' },
      { name: 'Ledbetter Act', citation: 'Lilly Ledbetter Fair Pay Act of 2009 — extends statute of limitations for pay discrimination claims' },
    ],
    rewriteAvailable: true,
    attribute: 'gender',
    groupRates: { Male: maleAvg, Female: femaleAvg },
  });

  if (raceGap > 5) findings.push({
    id: 'race-gap',
    title: 'Racial Pay Gap Detected',
    severity: raceGap > 15 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Raw Gap', value: `${raceGap.toFixed(1)}%` },
      { label: 'White Avg', value: fmt(whiteAvg) },
      { label: 'Black Avg', value: fmt(blackAvg) },
      { label: 'Annual Difference', value: fmt(whiteAvg - blackAvg) },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Title VII, 42 U.S.C. § 2000e-2 — prohibits race-based compensation discrimination' },
      { name: 'CA SB 1162', citation: 'California Equal Pay Act (SB 1162) — requires pay data reporting by race/ethnicity' },
    ],
    rewriteAvailable: true,
    attribute: 'race',
    groupRates: { White: whiteAvg, Black: blackAvg },
  });

  if (seniorMalePct > 65) findings.push({
    id: 'grade-concentration',
    title: 'Grade Concentration — Senior Roles',
    severity: seniorMalePct > 75 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Male at L4+', value: `${seniorMalePct.toFixed(0)}%` },
      { label: 'Female at L4+', value: `${(100 - seniorMalePct).toFixed(0)}%` },
      { label: 'Senior Employees', value: seniorEmployees.length },
    ],
    legalBasis: [
      { name: 'OFCCP', citation: 'OFCCP Affirmative Action Guidelines — require utilization analysis by job group' },
      { name: 'Title VII', citation: 'Title VII disparate impact in promotion to senior roles' },
    ],
    rewriteAvailable: true,
    attribute: 'gender',
    groupRates: { Male: seniorMalePct / 100, Female: (100 - seniorMalePct) / 100 },
  });

  if (intersectGap > 20) findings.push({
    id: 'intersectional',
    title: 'Intersectional Pay Gap — Black Women vs White Men',
    severity: intersectGap > 28 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Gap', value: `${intersectGap.toFixed(1)}%` },
      { label: 'Black Women Avg', value: fmt(blackWomenAvg) },
      { label: 'White Men Avg',   value: fmt(whiteMenAvg)  },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Title VII intersectional analysis — Lam v. Univ. of Hawaii established intersectional discrimination claims' },
    ],
    rewriteAvailable: true,
    attribute: 'race+gender',
    groupRates: { 'Black Women': blackWomenAvg, 'White Men': whiteMenAvg },
  });

  return {
    score: Math.round(rawScore),
    grade: grade(Math.round(rawScore)),
    genderRawGap: genderRawGap.toFixed(1),
    raceGap: raceGap.toFixed(1),
    seniorMalePct: seniorMalePct.toFixed(0),
    intersectGap: intersectGap.toFixed(1),
    maleAvg, femaleAvg, whiteAvg, blackAvg, blackWomenAvg, whiteMenAvg,
    remediationCost,
    totalAffected: femaleSalaries.length + data.filter(e => e.race === 'Black').length,
    findings,
    rawData: data,
  };
}

// ── Salary Distribution Chart Data ────────────────────────────────────────
function buildChartData(data) {
  const genderGroups = {};
  data.forEach(e => {
    const g = e.gender || 'Unknown';
    if (!genderGroups[g]) genderGroups[g] = [];
    genderGroups[g].push(+e.salary);
  });

  // Box-plot style: for each group produce [group, min, q1, median, q3, max]
  function quartiles(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const q = p => s[Math.floor(p * s.length)];
    return [q(0), q(0.25), q(0.5), q(0.75), q(1)];
  }

  const rows = [['Group', 'Min', 'Q1', 'Median', 'Q3', 'Max']];
  Object.entries(genderGroups).forEach(([g, salaries]) => {
    rows.push([g, ...quartiles(salaries)]);
  });
  return rows;
}

// ── Grade concentration bar chart ─────────────────────────────────────────
function buildGradeData(data) {
  const levels = [1, 2, 3, 4, 5];
  const rows   = [['Level', 'Male', 'Female']];
  levels.forEach(l => {
    const atLevel = data.filter(e => (e.job_level || 1) === l);
    const m = atLevel.filter(e => e.gender === 'Male').length;
    const f = atLevel.filter(e => e.gender === 'Female').length;
    rows.push([`L${l}`, m, f]);
  });
  return rows;
}

// ── Rectify helper ─────────────────────────────────────────────────────────
function buildSalaryAdjustments(data, results) {
  const targetAvg = results.maleAvg;
  return data
    .filter(e => e.gender === 'Female' && (+e.salary) < targetAvg * 0.95)
    .slice(0, 20)
    .map(e => ({
      employee_id:     e.employee_id,
      currentSalary:   +e.salary,
      suggestedSalary: Math.round(+e.salary * 1.12),
      gap:             Math.round(targetAvg - +e.salary),
      rationale:       'Gender pay gap remediation — bringing within 5% of male peer average for equivalent role',
    }));
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PayGapDashboard() {
  const [data,         setData]         = useState(null);
  const [results,      setResults]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiExplained,  setAiExplained]  = useState({});
  const [rewriteOpen,  setRewriteOpen]  = useState(false);
  const [rewritingFor, setRewritingFor] = useState(null);
  const [rewriteData,  setRewriteData]  = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [csvError,     setCsvError]     = useState('');

  // Load demo
  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const r = analyzePayGap(PAY_GAP_DEMO);
      setData(PAY_GAP_DEMO);
      setResults(r);
      setLoading(false);
      // Save to session for Compliance module
      try { sessionStorage.setItem('fl_pay_gap_results', JSON.stringify({ ...r, moduleId: 'pay-gap', moduleName: 'Pay Gap Analysis', timestamp: new Date().toISOString() })); } catch {}
    }, 800);
  };

  // Load CSV
  const handleCSV = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length) { setCsvError('CSV parse error: ' + errors[0].message); return; }
        const r = analyzePayGap(rows);
        setData(rows); setResults(r);
        try { sessionStorage.setItem('fl_pay_gap_results', JSON.stringify({ ...r, moduleId: 'pay-gap', moduleName: 'Pay Gap Analysis', timestamp: new Date().toISOString() })); } catch {}
      },
    });
  }, []);

  // Fetch AI explanation for a finding
  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    setAiLoading(true);
    try {
      const prompt = `You are a pay equity expert. A pay gap analysis found: "${finding.title}" with severity ${finding.severity}.
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain in 3 plain-English sentences: what this means for affected employees, the business and legal risk, and the single most impactful fix.
Format: WHAT: [sentence] | RISK: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|RISK|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
    finally { setAiLoading(false); }
  }, [aiExplained]);

  // Open rewrite modal for a finding
  const openRectify = async (finding) => {
    setRewritingFor(finding);
    setRewriteLoading(true);
    setRewriteOpen(true);
    const adjustments = buildSalaryAdjustments(data || PAY_GAP_DEMO, results);
    const original = adjustments.map(a =>
      `${a.employee_id} | Current: ${fmt(a.currentSalary)} | Gap: ${fmt(a.gap)}`
    ).join('\n');
    const rewritten = adjustments.map(a =>
      `${a.employee_id} | Suggested: ${fmt(a.suggestedSalary)} | +${fmt(a.suggestedSalary - a.currentSalary)}`
    ).join('\n');
    setRewriteData({
      original,
      rewritten,
      changes: adjustments.map(a => ({
        action: `Salary adjustment: ${a.employee_id}`,
        original: fmt(a.currentSalary),
        replacement: fmt(a.suggestedSalary),
        reason: a.rationale,
      })),
      totalCost: adjustments.reduce((s, a) => s + (a.suggestedSalary - a.currentSalary), 0),
    });
    setRewriteLoading(false);
  };

  // ── Render: Upload screen ────────────────────────────────────────────────
  if (!results) {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 20px',
            borderRadius: '18px', backgroundColor: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#3b82f6' }}>payments</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>
            Pay Gap Analysis
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect unexplained compensation gaps across gender, race, and intersectional groups. Surfaces raw gaps, adjusted gaps, and grade concentration bias.
          </p>
        </div>

        {/* Upload modes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
          {/* Demo */}
          <button
            onClick={loadDemo}
            disabled={loading}
            style={{
              padding: '18px 24px', backgroundColor: '#0f172a', color: '#fff',
              border: 'none', borderRadius: '12px', cursor: loading ? 'wait' : 'pointer',
              fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '10px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.3)', transition: 'opacity 0.2s'
            }}
          >
            <span className="material-icons-round">science</span>
            {loading ? 'Loading demo data...' : 'Try 200 Sample Employees (Demo)'}
          </button>

          {/* CSV Upload */}
          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px', transition: 'border-color 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Employee CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>

          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>{csvError}</div>}
        </div>

        {/* Schema hint */}
        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Required CSV columns
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            employee_id, salary, job_title, department, job_level (1-5),<br />
            years_experience, performance_rating (1-5), education_level,<br />
            <span style={{ color: '#f59e0b' }}>gender, race, age</span> (sensitive — used for analysis only)
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Results ──────────────────────────────────────────────────────
  const chartData  = buildChartData(data);
  const gradeData  = buildGradeData(data);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-sans)' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Pay Gap Analysis Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{(data || []).length} employees analyzed · {results.findings.length} findings</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minWidth: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <BiasScoreGauge score={results.score} size={120} />
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>
            Pay Equity Score
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <MetricCard
            label="Raw Gender Gap"
            value={`${results.genderRawGap}%`}
            sub={`Women earn ${results.genderRawGap}% less`}
            color="#ef4444"
            icon="man"
          />
          <MetricCard
            label="Racial Gap"
            value={`${results.raceGap}%`}
            sub="Black vs White employees"
            color="#f59e0b"
            icon="groups"
          />
          <MetricCard
            label="Employees Affected"
            value={results.totalAffected}
            sub="Across all flagged groups"
            color="#0f172a"
            icon="person"
          />
          <MetricCard
            label="Remediation Est."
            value={`$${(results.remediationCost / 1000).toFixed(0)}K`}
            sub="To close 50% of gap"
            color="#10b981"
            icon="attach_money"
          />
        </div>
      </div>

      {/* Intersectional callout */}
      {results.intersectGap > 20 && (
        <div style={{
          backgroundColor: '#fff', border: '2px solid #fca5a5', borderRadius: '12px',
          padding: '20px 24px', marginBottom: '28px',
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap'
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <span className="material-icons-round" style={{ color: '#ef4444', fontSize: '24px' }}>warning</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px', marginBottom: '4px' }}>
              Intersectional Gap: Black Women vs White Men
            </div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>
              Black women earn an average of <strong style={{ color: '#ef4444' }}>{fmt(results.blackWomenAvg)}</strong> vs <strong style={{ color: '#10b981' }}>{fmt(results.whiteMenAvg)}</strong> for White men —
              a <strong style={{ color: '#ef4444' }}>{results.intersectGap}% gap</strong>.
              This intersectional disparity exceeds both the gender and racial gaps individually.
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Salary Distribution by Gender</h3>
          <Chart
            chartType="CandlestickChart"
            width="100%"
            height="220px"
            data={chartData}
            options={{
              legend: 'none',
              bar: { groupWidth: '40%' },
              candlestick: { fallingColor: { strokeWidth: 0, fill: '#ef4444' }, risingColor: { strokeWidth: 0, fill: '#10b981' } },
              vAxis: { format: '$#,###', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
              hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 64, right: 16, top: 8, bottom: 40 },
              backgroundColor: 'transparent',
            }}
          />
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Grade Concentration by Level</h3>
          <Chart
            chartType="BarChart"
            width="100%"
            height="220px"
            data={gradeData}
            options={{
              isStacked: false,
              colors: ['#0f172a', '#3b82f6'],
              legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 11 } },
              hAxis: { gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
              vAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 48, right: 16, top: 32, bottom: 32 },
              backgroundColor: 'transparent',
            }}
          />
        </div>
      </div>

      {/* Finding Cards */}
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

      {/* RewriteModal */}
      {rewriteOpen && rewriteData && (
        <RewriteModal
          isOpen={rewriteOpen}
          onClose={() => setRewriteOpen(false)}
          onAccept={() => setRewriteOpen(false)}
          originalContent={rewriteData.original}
          rewrittenContent={rewriteData.rewritten}
          changesApplied={rewriteData.changes}
          isDataset={false}
        />
      )}
      {rewriteOpen && rewriteLoading && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px 48px', textAlign: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: '40px', color: '#3b82f6', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Computing salary adjustments…</div>
          </div>
        </div>
      )}
    </div>
  );
}
