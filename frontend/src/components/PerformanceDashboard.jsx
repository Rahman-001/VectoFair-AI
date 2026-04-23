import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import Papa from 'papaparse';
import { PERFORMANCE_DEMO } from '../data/performanceDemoData';
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
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px 24px', border: '1px solid #e2e8f0', flex: 1, minWidth: '160px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {icon && <span className="material-icons-round" style={{ fontSize: '18px', color: '#64748b' }}>{icon}</span>}
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ── Agentic/Communal word lists ────────────────────────────────────────────
const AGENTIC_WORDS    = ['drove','led','owned','spearheaded','executed','delivered','championed','commanded','transformed','accelerated','won'];
const COMMUNAL_WORDS   = ['supportive','helped','assisted','collaborative','team player','cooperative','pleasant','willing to help','morale','dependable'];
const PERSONALITY_WORDS= ['difficult','attitude','abrasive','aggressive','interpersonal','struggles','dynamics'];

function detectLinguisticBias(reviews) {
  const agenticPhrases    = [], communalPhrases = [], personalityCritiques = [];
  reviews.forEach(({ text, gender, race }) => {
    if (!text) return;
    const lower = text.toLowerCase();
    AGENTIC_WORDS.forEach(w => { if (lower.includes(w)) agenticPhrases.push({ word: w, gender, race, excerpt: text.slice(0, 60) }); });
    COMMUNAL_WORDS.forEach(w => { if (lower.includes(w)) communalPhrases.push({ word: w, gender, race, excerpt: text.slice(0, 60) }); });
    PERSONALITY_WORDS.forEach(w => { if (lower.includes(w)) personalityCritiques.push({ word: w, gender, race, excerpt: text.slice(0, 60) }); });
  });
  return { agenticPhrases, communalPhrases, personalityCritiques };
}

// ── Analysis Engine ───────────────────────────────────────────────────────
function analyzePerformance(data) {
  // Gender rating gap
  const maleRatings    = data.filter(e => e.gender === 'Male').map(e => +e.rating);
  const femaleRatings  = data.filter(e => e.gender === 'Female').map(e => +e.rating);
  const maleAvg        = avg(maleRatings);
  const femaleAvg      = avg(femaleRatings);
  const ratingGap      = maleAvg - femaleAvg;

  // KPI-adjusted gap: within same KPI band, compare ratings by gender
  const kpiBands = [[0,60],[60,75],[75,90],[90,100]];
  const kpiAdjGaps = kpiBands.map(([lo,hi]) => {
    const band     = data.filter(e => e.kpi_score >= lo && e.kpi_score < hi);
    const mAdj     = avg(band.filter(e => e.gender === 'Male').map(e => +e.rating));
    const fAdj     = avg(band.filter(e => e.gender === 'Female').map(e => +e.rating));
    return { band: `${lo}-${hi}`, gap: mAdj - fAdj, malAvg: mAdj, femAvg: fAdj };
  }).filter(b => !isNaN(b.gap));
  const avgKpiAdjGap = avg(kpiAdjGaps.map(b => b.gap));

  // Manager bias
  const managerStats = {};
  data.forEach(e => {
    const mgr = e.manager_id || 'UNKNOWN';
    if (!managerStats[mgr]) managerStats[mgr] = { White: [], Other: [] };
    if (e.race === 'White') managerStats[mgr].White.push(+e.rating);
    else managerStats[mgr].Other.push(+e.rating);
  });
  const biasedManagers = Object.entries(managerStats)
    .map(([mgr, g]) => ({
      mgr,
      whiteAvg:   avg(g.White),
      otherAvg:   avg(g.Other),
      gap:        avg(g.White) - avg(g.Other),
      whiteCount: g.White.length,
      otherCount: g.Other.length,
    }))
    .filter(m => m.gap > 0.7 && m.whiteCount >= 3 && m.otherCount >= 3);

  // Linguistic bias
  const reviews = data.map(e => ({ text: e.review_text, gender: e.gender, race: e.race }));
  const linguisticBias = detectLinguisticBias(reviews);

  // Post-leave rating drop
  const postLeaveEmp = data.filter(e => e.on_parental_leave);
  const femaleDrops  = postLeaveEmp.filter(e => e.gender === 'Female' && e.pre_leave_rating)
    .map(e => +e.pre_leave_rating - +e.rating);
  const maleDrops    = postLeaveEmp.filter(e => e.gender === 'Male' && e.pre_leave_rating)
    .map(e => +e.pre_leave_rating - +e.rating);
  const avgFemDrop   = avg(femaleDrops);
  const avgMaleDrop  = avg(maleDrops);

  // Score
  const score = Math.max(0, Math.min(100, 100
    - Math.min(ratingGap * 18, 30)
    - Math.min(avgKpiAdjGap * 15, 25)
    - (biasedManagers.length > 0 ? 20 : 0)
    - (linguisticBias.agenticPhrases.length > 5 && linguisticBias.communalPhrases.length > 5 ? 15 : 0)
    - (avgFemDrop > 0.3 ? 10 : 0)
  ));

  const findings = [];

  if (ratingGap > 0.3) findings.push({
    id: 'rating-gap',
    title: 'Gender Rating Distribution Gap',
    severity: ratingGap > 0.5 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Male Avg Rating',   value: maleAvg.toFixed(2)   },
      { label: 'Female Avg Rating', value: femaleAvg.toFixed(2) },
      { label: 'Gap',               value: ratingGap.toFixed(2) },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Watson v. Fort Worth Bank (1988) — subjective evaluations subject to Title VII disparate impact analysis' },
      { name: 'EEOC', citation: 'EEOC Uniform Guidelines on Employee Selection Procedures — evaluation processes are selection procedures' },
    ],
    rewriteAvailable: true,
  });

  if (avgKpiAdjGap > 0.2) findings.push({
    id: 'kpi-adj',
    title: 'KPI-Adjusted Rating Disparity',
    severity: avgKpiAdjGap > 0.4 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'KPI-Adjusted Gap', value: avgKpiAdjGap.toFixed(2) },
      { label: 'KPI Bands Analyzed', value: kpiAdjGaps.length },
      { label: 'Verdict', value: 'Merit alone does not explain ratings' },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Equal outcomes required when controlling for legitimate business criteria — disparate impact analysis' },
    ],
    rewriteAvailable: true,
  });

  if (biasedManagers.length > 0) findings.push({
    id: 'manager-bias',
    title: `Manager Bias Profile Detected (${biasedManagers.length} manager${biasedManagers.length > 1 ? 's' : ''})`,
    severity: biasedManagers[0].gap > 0.8 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Biased Managers', value: biasedManagers.length },
      { label: 'Max Gap', value: Math.max(...biasedManagers.map(m => m.gap)).toFixed(2) },
      { label: 'Employees Affected', value: data.filter(e => biasedManagers.map(m => m.mgr).includes(e.manager_id)).length },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Individual manager discretion that produces racial disparity constitutes actionable disparate impact' },
    ],
    rewriteAvailable: true,
  });

  const hasLinguistic = linguisticBias.agenticPhrases.length > 3 || linguisticBias.communalPhrases.length > 3;
  if (hasLinguistic) findings.push({
    id: 'linguistic-bias',
    title: 'Linguistic Bias in Review Text',
    severity: (linguisticBias.agenticPhrases.length + linguisticBias.communalPhrases.length) > 10 ? 'HIGH' : 'MEDIUM',
    metrics: [
      { label: 'Agentic Phrases', value: linguisticBias.agenticPhrases.length },
      { label: 'Communal Phrases', value: linguisticBias.communalPhrases.length },
      { label: 'Personality Critiques', value: linguisticBias.personalityCritiques.length },
    ],
    legalBasis: [
      { name: 'Title VII', citation: 'Language in evaluations can constitute evidence of bias — gender-correlated language is actionable' },
      { name: 'ADA', citation: 'Personality critiques may constitute evidence of disability-related discrimination under ADA' },
    ],
    rewriteAvailable: true,
  });

  if (avgFemDrop > 0.3) findings.push({
    id: 'post-leave',
    title: 'Post-Parental-Leave Rating Drop',
    severity: avgFemDrop > 0.5 ? 'MEDIUM' : 'LOW',
    metrics: [
      { label: 'Female Drop',  value: `-${avgFemDrop.toFixed(2)} pts` },
      { label: 'Male Drop',    value: `-${avgMaleDrop.toFixed(2)} pts` },
      { label: 'Employees on Leave', value: postLeaveEmp.length },
    ],
    legalBasis: [
      { name: 'FMLA', citation: 'Family and Medical Leave Act — post-leave retaliation in ratings constitutes actionable retaliation' },
      { name: 'Title VII', citation: 'Pregnancy Discrimination Act prohibits adverse treatment associated with parental leave' },
    ],
    rewriteAvailable: true,
  });

  return {
    score: Math.round(score), grade: grade(Math.round(score)),
    maleAvg, femaleAvg, ratingGap,
    avgKpiAdjGap, kpiAdjGaps,
    biasedManagers,
    linguisticBias,
    avgFemDrop, avgMaleDrop,
    affectedEmployees: femaleRatings.length + data.filter(e => e.race !== 'White').length,
    findings, rawData: data,
  };
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  const [results,      setResults]      = useState(null);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [csvError,     setCsvError]     = useState('');
  const [rewriteOpen,  setRewriteOpen]  = useState(false);
  const [rewriteData,  setRewriteData]  = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [aiExplained,  setAiExplained]  = useState({});

  const loadDemo = () => {
    setLoading(true);
    // Use a minimal tick so the loading state renders before the (synchronous) analysis runs
    setTimeout(() => {
      const r = analyzePerformance(PERFORMANCE_DEMO);
      setData(PERFORMANCE_DEMO); setResults(r); setLoading(false);
      try { sessionStorage.setItem('fl_performance_results', JSON.stringify({ ...r, moduleId: 'performance', moduleName: 'Performance Review Bias', timestamp: new Date().toISOString() })); } catch {}
    }, 50);
  };

  const handleCSV = useCallback(e => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length) { setCsvError('Parse error: ' + errors[0].message); return; }
        const r = analyzePerformance(rows); setData(rows); setResults(r);
      },
    });
  }, []);

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a performance review fairness expert. A bias audit found: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
In 3 plain sentences, explain: what this pattern means for employees, what systemic force causes it, and the most concrete managerial fix.
Format: WHAT: [sentence] | CAUSE: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|CAUSE|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
  }, [aiExplained]);

  const openRectify = async (finding) => {
    setRewriteLoading(true); setRewriteOpen(true);
    try {
      // For linguistic bias — rewrite a sample review using AI
      const sampleReview = (data || PERFORMANCE_DEMO).find(e => e.review_text && e.gender === 'Female')?.review_text || '';
      const prompt = `Rewrite this performance review to remove all gender-coded language and replace communal phrases with achievement-focused, agentic language that reflects the actual work accomplished. Keep every factual statement exactly as written.

Original: "${sampleReview}"

Return JSON only:
{"rewrittenText":"...","changesApplied":[{"original":"...","replacement":"...","reason":"..."}],"biasSignalsRemoved":3}`;
      const { text } = await callAI(prompt);
      let parsed;
      try {
        const clean = text.replace(/^```json\s*/i,'').replace(/```\s*$/,'');
        parsed = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      } catch { parsed = { rewrittenText: 'Rewrite unavailable — AI provider busy.', changesApplied: [], biasSignalsRemoved: 0 }; }
      setRewriteData({
        original: sampleReview,
        rewritten: parsed.rewrittenText,
        changes: (parsed.changesApplied || []).map(c => ({ action: `Replace: "${c.original}" → "${c.replacement}"`, reason: c.reason })),
      });
    } catch {
      setRewriteData({ original: 'Sample review text', rewritten: 'Rewrite unavailable.', changes: [] });
    }
    setRewriteLoading(false);
  };

  // ── Upload screen ──────────────────────────────────────────────────────
  if (!results) {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', borderRadius: '18px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#8b5cf6' }}>rate_review</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>Performance Review Bias</h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Detect rating gaps, linguistic bias (agentic vs communal language), manager-level bias profiles, and post-leave rating drops.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
          <button onClick={loadDemo} disabled={loading} style={{ padding: '18px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', cursor: loading ? 'wait' : 'pointer', fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(15,23,42,0.3)' }}>
            <span className="material-icons-round">science</span>
            {loading ? 'Loading...' : 'Try 150 Sample Employees (Demo)'}
          </button>
          <label style={{ padding: '18px 24px', backgroundColor: '#fff', color: '#0f172a', border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span className="material-icons-round" style={{ color: '#64748b' }}>upload_file</span>
            Upload Employee CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
          </label>
          {csvError && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{csvError}</div>}
        </div>
        <div style={{ marginTop: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Required CSV columns</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.8', fontFamily: 'monospace' }}>
            employee_id, manager_id, rating (1-5), department, tenure_years,<br />
            kpi_score (optional), review_text (optional), on_parental_leave (0/1),<br />
            pre_leave_rating (optional), <span style={{ color: '#f59e0b' }}>gender, race, age</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────
  const ratingDistData = [
    ['Group', 'Male Average', 'Female Average'],
    ['All Employees', results.maleAvg, results.femaleAvg],
    ...results.kpiAdjGaps.map(b => [`KPI ${b.band}`, b.malAvg || 0, b.femAvg || 0]),
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Performance Review Bias Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{(data || []).length} employees · {results.findings.length} findings · {results.linguisticBias.agenticPhrases.length + results.linguisticBias.communalPhrases.length} biased phrases</div>
        </div>
        <button onClick={loadDemo} style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset Demo
        </button>
      </div>

      {/* Score + Metrics */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <BiasScoreGauge score={results.score} size={120} />
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>Review Equity Score</div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <MetricCard label="Rating Gap" value={results.ratingGap.toFixed(2)} sub="Male minus female avg" color="#ef4444" icon="star" />
          <MetricCard label="KPI-Adjusted Gap" value={results.avgKpiAdjGap.toFixed(2)} sub="After merit control" color="#f59e0b" icon="analytics" />
          <MetricCard label="Biased Managers" value={results.biasedManagers.length} sub="Above 0.7pt disparity" color={results.biasedManagers.length > 0 ? '#ef4444' : '#10b981'} icon="manage_accounts" />
          <MetricCard label="Biased Phrases" value={results.linguisticBias.agenticPhrases.length + results.linguisticBias.communalPhrases.length} sub="In review texts" color="#8b5cf6" icon="text_snippet" />
        </div>
      </div>

      {/* Linguistic bias section */}
      {(results.linguisticBias.agenticPhrases.length > 0 || results.linguisticBias.communalPhrases.length > 0) && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Linguistic Bias Patterns Detected</h3>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agentic (Men's Reviews)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[...new Set(results.linguisticBias.agenticPhrases.map(p => p.word))].slice(0, 8).map(w => (
                  <span key={w} style={{ padding: '4px 10px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid #bfdbfe' }}>{w}</span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#ec4899', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Communal (Women's Reviews)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[...new Set(results.linguisticBias.communalPhrases.map(p => p.word))].slice(0, 8).map(w => (
                  <span key={w} style={{ padding: '4px 10px', backgroundColor: '#fdf2f8', color: '#9d174d', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid #fbcfe8' }}>{w}</span>
                ))}
              </div>
            </div>
            {results.linguisticBias.personalityCritiques.length > 0 && (
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personality Critiques</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[...new Set(results.linguisticBias.personalityCritiques.map(p => p.word))].slice(0, 6).map(w => (
                    <span key={w} style={{ padding: '4px 10px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid #fca5a5' }}>{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Biased manager callout */}
      {results.biasedManagers.length > 0 && (
        <div style={{ backgroundColor: '#fff', border: '2px solid #fca5a5', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: '#ef4444' }}>warning</span>
            Manager Bias Profiles Flagged (anonymized)
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {results.biasedManagers.map((m, i) => (
              <div key={m.mgr} style={{ backgroundColor: '#fef2f2', borderRadius: '8px', padding: '12px 16px', border: '1px solid #fecaca', minWidth: '180px' }}>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Manager {String.fromCharCode(65 + i)}</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>White avg: <strong>{m.whiteAvg.toFixed(2)}</strong></div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Minority avg: <strong style={{ color: '#ef4444' }}>{m.otherAvg.toFixed(2)}</strong></div>
                <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '700' }}>Gap: {m.gap.toFixed(2)} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Rating Comparison by Gender (All Bands)</h3>
        <Chart
          chartType="BarChart"
          width="100%"
          height="240px"
          data={ratingDistData}
          options={{
            colors: ['#0f172a', '#3b82f6'],
            legend: { position: 'top', textStyle: { color: '#64748b', fontSize: 11 } },
            hAxis: { minValue: 1, maxValue: 5, gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 11 } },
            vAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
            chartArea: { left: 80, right: 16, top: 32, bottom: 32 },
            backgroundColor: 'transparent',
          }}
        />
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

      {rewriteOpen && (
        <>
          {rewriteLoading && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px 48px', textAlign: 'center' }}>
                <span className="material-icons-round" style={{ fontSize: '40px', color: '#8b5cf6', display: 'block', marginBottom: '12px' }}>hourglass_empty</span>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>Rewriting review with AI…</div>
              </div>
            </div>
          )}
          {!rewriteLoading && rewriteData && (
            <RewriteModal
              isOpen={rewriteOpen}
              onClose={() => setRewriteOpen(false)}
              onAccept={() => setRewriteOpen(false)}
              originalContent={rewriteData.original}
              rewrittenContent={rewriteData.rewritten}
              changesApplied={rewriteData.changes}
            />
          )}
        </>
      )}
    </div>
  );
}
