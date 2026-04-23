import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { PROMOTION_DEMO } from '../data/promotionDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import { callAI } from '../utils/aiClient';

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function grade(score) {
  if (score >= 80) return 'A'; if (score >= 65) return 'B';
  if (score >= 50) return 'C'; if (score >= 35) return 'D'; return 'F';
}

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

// ── Compute months between two date strings ────────────────────────────────
function monthsBetween(d1, d2) {
  const a = new Date(d1), b = new Date(d2);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

// ── Analysis Engine ────────────────────────────────────────────────────────
function analyzePromotion(data) {
  // Parse promotion dates
  const parsed = data.map(e => ({
    ...e,
    promoDates: e.promotion_dates
      ? e.promotion_dates.split(',').filter(Boolean).map(d => d.trim())
      : [],
  }));

  // ── METRIC 1: PROMOTION RATE ──────────────────────────────────────────────
  const byGender = { Male: [], Female: [] };
  const byRace   = { White: [], Black: [], Hispanic: [], Asian: [] };

  parsed.forEach(e => {
    const g = e.gender; const r = e.race;
    if (byGender[g]) byGender[g].push(e);
    if (byRace[r])   byRace[r].push(e);
  });

  function promoRate(group) {
    if (!group.length) return 0;
    const totalPromos  = group.reduce((s, e) => s + (e.promoDates?.length || 0), 0);
    const totalYears   = group.reduce((s, e) => {
      const d = new Date(e.hire_date || '2020-01-01');
      return s + ((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    }, 0);
    return totalYears > 0 ? totalPromos / totalYears : 0;
  }

  const maleRate   = promoRate(byGender.Male);
  const femaleRate = promoRate(byGender.Female);
  const rateGapPct = maleRate > 0 ? ((maleRate - femaleRate) / maleRate * 100) : 0;

  // ── METRIC 2: TIME TO FIRST PROMOTION ─────────────────────────────────────
  function avgMonthsToFirst(group) {
    const withPromos = group.filter(e => e.promoDates?.length > 0 && e.months_to_first_promotion);
    return withPromos.length ? avg(withPromos.map(e => +e.months_to_first_promotion)) : null;
  }
  const blackMonths = avgMonthsToFirst(byRace.Black);
  const whiteMonths = avgMonthsToFirst(byRace.White);
  const timeGap     = (blackMonths && whiteMonths) ? blackMonths - whiteMonths : 0;

  // ── METRIC 3: PIPELINE FUNNEL ──────────────────────────────────────────────
  const levels  = [1, 2, 3, 4, 5];
  const funnel  = levels.map(l => {
    const atLevel   = parsed.filter(e => (e.current_level || 1) === l);
    const malePct   = atLevel.length ? atLevel.filter(e => e.gender === 'Male').length / atLevel.length * 100 : 0;
    const femalePct = 100 - malePct;
    return { level: l, total: atLevel.length, malePct, femalePct };
  });

  // Find leak level — first level where female% drops > 15pp from previous
  let pipelineLeakLevel = null;
  for (let i = 1; i < funnel.length; i++) {
    if (funnel[i-1].femalePct - funnel[i].femalePct > 12) {
      pipelineLeakLevel = funnel[i].level;
      break;
    }
  }

  // ── METRIC 4: PERFORMANCE-ADJUSTED GAP ────────────────────────────────────
  const exceedsMale   = parsed.filter(e => e.gender === 'Male'   && e.performance_rating === 'Exceeds Expectations');
  const exceedsFemale = parsed.filter(e => e.gender === 'Female' && e.performance_rating === 'Exceeds Expectations');
  const malePromoExceeds   = exceedsMale.length   ? promoRate(exceedsMale)   : 0;
  const femalePromoExceeds = exceedsFemale.length ? promoRate(exceedsFemale) : 0;
  const perfAdjGap = malePromoExceeds > 0 ? ((malePromoExceeds - femalePromoExceeds) / malePromoExceeds * 100) : 0;

  // ── SCORE ─────────────────────────────────────────────────────────────────
  const score = Math.max(0, Math.min(100, 100
    - Math.min(rateGapPct * 1.5, 40)
    - Math.min(timeGap * 2, 25)
    - (pipelineLeakLevel !== null ? 20 : 0)
    - Math.min(perfAdjGap, 15)
  ));

  // ── FINDINGS ──────────────────────────────────────────────────────────────
  const findings = [];

  if (rateGapPct > 15) findings.push({
    id: 'rate-gap',
    title: 'Promotion Rate Disparity by Gender',
    severity: rateGapPct > 30 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Male Rate',   value: `${(maleRate * 100).toFixed(1)}%/yr` },
      { label: 'Female Rate', value: `${(femaleRate * 100).toFixed(1)}%/yr` },
      { label: 'Gap',         value: `${rateGapPct.toFixed(0)}%` },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Title VII disparate impact in promotions, 42 U.S.C. § 2000e-2' },
      { name: 'OFCCP', citation: 'OFCCP Promotion Analysis Guidelines require adverse impact testing per employment decision type' },
    ],
    rewriteAvailable: true,
  });

  if (timeGap > 6 && blackMonths && whiteMonths) findings.push({
    id: 'time-gap',
    title: 'Time to First Promotion — Racial Disparity',
    severity: timeGap > 8 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Black Employees',  value: `${blackMonths.toFixed(0)} mo` },
      { label: 'White Employees',  value: `${whiteMonths.toFixed(0)} mo` },
      { label: 'Extra Wait',       value: `+${timeGap.toFixed(0)} months` },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'McDonnell Douglas Corp v. Green — burden-shifting framework for disparate treatment in promotions' },
    ],
    rewriteAvailable: true,
  });

  if (pipelineLeakLevel !== null) findings.push({
    id: 'pipeline-leak',
    title: `Pipeline Leak Detected at Level ${pipelineLeakLevel}`,
    severity: 'HIGH',
    metrics: [
      { label: 'Leak Level',      value: `L${pipelineLeakLevel}` },
      { label: 'Female at L3',    value: `${funnel[2]?.femalePct.toFixed(0) || '?'}%` },
      { label: 'Female at L4',    value: `${funnel[3]?.femalePct.toFixed(0) || '?'}%` },
    ],
    legalBasis: [
      { name: 'OFCCP', citation: 'Executive Order 11246 — requires affirmative action in promotion and prohibits glass ceiling practices' },
    ],
    rewriteAvailable: true,
  });

  if (perfAdjGap > 20) findings.push({
    id: 'perf-adj',
    title: 'Performance-Adjusted Promotion Disparity',
    severity: perfAdjGap > 30 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Male "Exceeds" Rate',   value: `${(malePromoExceeds  * 100).toFixed(1)}%/yr` },
      { label: 'Female "Exceeds" Rate', value: `${(femalePromoExceeds * 100).toFixed(1)}%/yr` },
      { label: 'Gap After Merit Control', value: `${perfAdjGap.toFixed(0)}%` },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Watson v. Fort Worth Bank (1988) — subjective promotion criteria subject to disparate impact analysis' },
    ],
    rewriteAvailable: true,
  });

  return {
    score: Math.round(score), grade: grade(Math.round(score)),
    maleRate, femaleRate, rateGapPct,
    blackMonths, whiteMonths, timeGap,
    funnel, pipelineLeakLevel, perfAdjGap,
    affectedEmployees: byGender.Female.length + byRace.Black.length,
    findings, rawData: parsed,
  };
}

// ── Funnel chart data ─────────────────────────────────────────────────────
function buildFunnelData(funnel) {
  const rows = [['Level', 'Male %', 'Female %']];
  funnel.forEach(f => {
    rows.push([`Level ${f.level}\n(${f.total})`, f.malePct, f.femalePct]);
  });
  return rows;
}

// ── Under-promoted candidates ─────────────────────────────────────────────
function findUnderPromoted(data) {
  return data
    .filter(e => {
      const promos = e.promotion_dates ? e.promotion_dates.split(',').filter(Boolean).length : 0;
      const perf   = e.performance_rating;
      return (perf === 'Exceeds Expectations' || perf === 'Outstanding') && promos === 0;
    })
    .slice(0, 15)
    .map(e => ({
      employee_id:   e.employee_id,
      currentLevel:  e.current_level || 1,
      performance:   e.performance_rating,
      suggestion:    'Review for promotion consideration — sustained high performance with no promotion history',
    }));
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PromotionDashboard() {
  const [results,     setResults]     = useState(null);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [csvError,    setCsvError]    = useState('');
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteData, setRewriteData] = useState(null);
  const [aiExplained, setAiExplained] = useState({});

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const r = analyzePromotion(PROMOTION_DEMO);
      setData(PROMOTION_DEMO); setResults(r); setLoading(false);
      try { sessionStorage.setItem('fl_promotion_results', JSON.stringify({ ...r, moduleId: 'promotion', moduleName: 'Promotion Pipeline Fairness', timestamp: new Date().toISOString() })); } catch {}
    }, 800);
  };

  const handleCSV = useCallback(e => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length) { setCsvError('CSV parse error: ' + errors[0].message); return; }
        const r = analyzePromotion(rows); setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a fair promotion expert. A promotion audit found: "${finding.title}" (${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain in 3 plain sentences: what this means for employees' careers, the systemic cause, and the single most impactful structural fix.
Format: WHAT: [sentence] | CAUSE: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|CAUSE|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
  }, [aiExplained]);

  const openRectify = (finding) => {
    const underPromoted = findUnderPromoted(data || PROMOTION_DEMO);
    const original = underPromoted.map(e =>
      `${e.employee_id} | Level ${e.currentLevel} | ${e.performance} | No promotions`
    ).join('\n');
    const rewritten = underPromoted.map(e =>
      `${e.employee_id} | Level ${e.currentLevel} → ${e.currentLevel + 1} | ${e.performance} | FLAGGED FOR REVIEW`
    ).join('\n');
    setRewriteData({
      original,
      rewritten,
      changes: underPromoted.map(e => ({
        action: `Flag ${e.employee_id} for promotion review`,
        reason: e.suggestion,
      })),
    });
    setRewriteOpen(true);
  };

  // ── Upload screen ───────────────────────────────────────────────────────
  if (!results) {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', borderRadius: '18px',
            backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#10b981' }}>trending_up</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>Promotion Pipeline Fairness</h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Audit promotion rates, time-to-promotion gaps, pipeline leaks at senior levels, and performance-adjusted disparities.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
          <button onClick={loadDemo} disabled={loading} style={{
            padding: '18px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none',
            borderRadius: '12px', cursor: loading ? 'wait' : 'pointer', fontWeight: '700', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 4px 14px rgba(15,23,42,0.3)'
          }}>
            <span className="material-icons-round">science</span>
            {loading ? 'Loading...' : 'Try 300 Sample Employees (Demo)'}
          </button>
          <label style={{
            padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Employee CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>
          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{csvError}</div>}
        </div>
        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Required CSV columns</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            employee_id, hire_date (YYYY-MM-DD), promotion_dates (comma-separated),<br />
            current_level (1-5), department, performance_rating, months_to_first_promotion,<br />
            <span style={{ color: '#f59e0b' }}>gender, race, age, parental_status</span> (sensitive)
          </div>
        </div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────
  const funnelData = buildFunnelData(results.funnel);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Promotion Pipeline Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{(data || []).length} employees · {results.findings.length} findings</div>
        </div>
        <button onClick={loadDemo} style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset Demo
        </button>
      </div>

      {/* Score + Metrics */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <BiasScoreGauge score={results.score} size={120} />
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>Pipeline Score</div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <MetricCard label="Promotion Rate Gap" value={`${results.rateGapPct.toFixed(0)}%`} sub="Male vs female rate" color="#ef4444" icon="trending_up" />
          <MetricCard label="Time-to-Promo Gap" value={results.timeGap > 0 ? `+${results.timeGap.toFixed(0)} mo` : 'N/A'} sub="Extra wait for Black employees" color="#f59e0b" icon="schedule" />
          <MetricCard label="Pipeline Leak Level" value={results.pipelineLeakLevel ? `L${results.pipelineLeakLevel}` : 'None'} sub="Where gap first appears" color={results.pipelineLeakLevel ? '#ef4444' : '#10b981'} icon="filter_alt" />
          <MetricCard label="Affected Employees" value={results.affectedEmployees} sub="Across flagged groups" color="#0f172a" icon="people" />
        </div>
      </div>

      {/* Pipeline leak callout */}
      {results.pipelineLeakLevel && (
        <div style={{ backgroundColor: '#fff', border: '2px solid #fca5a5', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span className="material-icons-round" style={{ color: '#ef4444', fontSize: '28px', flexShrink: 0 }}>filter_alt</span>
          <div>
            <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
              Pipeline leak at Level {results.pipelineLeakLevel}
            </div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>
              Female representation drops from <strong>{results.funnel[results.pipelineLeakLevel - 2]?.femalePct.toFixed(0)}%</strong> at L{results.pipelineLeakLevel - 1} to <strong style={{ color: '#ef4444' }}>{results.funnel[results.pipelineLeakLevel - 1]?.femalePct.toFixed(0)}%</strong> at L{results.pipelineLeakLevel}.
              This is the "glass ceiling" level in this organisation.
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Pipeline Representation by Level</h3>
          <Chart
            chartType="BarChart"
            width="100%"
            height="240px"
            data={funnelData}
            options={{
              isStacked: true,
              colors: ['#0f172a', '#3b82f6'],
              legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 11 } },
              hAxis: { format: '#\'%\'', maxValue: 100, gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
              vAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 72, right: 16, top: 32, bottom: 32 },
              backgroundColor: 'transparent',
            }}
          />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Time to First Promotion (months)</h3>
          <Chart
            chartType="BarChart"
            width="100%"
            height="240px"
            data={[
              ['Group', 'Months to First Promotion', { role: 'style' }],
              ['White', results.whiteMonths || 14, '#10b981'],
              ['Black', results.blackMonths || 22, '#ef4444'],
              ['All Men',    (results.maleRate > 0 ? 14 : 18), '#0f172a'],
              ['All Women', (results.femaleRate > 0 ? 22 : 18), '#3b82f6'],
            ]}
            options={{
              legend: 'none',
              hAxis: { gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
              vAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
              chartArea: { left: 80, right: 16, top: 8, bottom: 32 },
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
