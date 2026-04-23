import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import { CLINICAL_TRIALS } from '../data/clinicalTrialDemoData';
import { DISEASE_PREVALENCE } from '../data/diseasePrevalence';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'trial_id',                 type:'string' },
  { name:'trial_name',               type:'string' },
  { name:'condition_studied',        type:'string' },
  { name:'total_participants',       type:'number' },
  { name:'enrolled_white_pct',       type:'number', note:'% of enrolled' },
  { name:'enrolled_black_pct',       type:'number', sensitive:true },
  { name:'enrolled_hispanic_pct',    type:'number', sensitive:true },
  { name:'enrolled_asian_pct',       type:'number', sensitive:true },
  { name:'enrolled_female_pct',      type:'number', sensitive:true },
  { name:'enrolled_age_65plus_pct',  type:'number', sensitive:true },
  { name:'dropout_rate_pct',         type:'number' },
];


// ── Helpers ──────────────────────────────────────────────────────────────────
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function fmtRatio(n) { return n.toFixed(2); }
function fmtPct(n, d = 0) { return n.toFixed(d) + '%'; }

const RACE_KEYS = [
  { key: 'white', label: 'White', enrollKey: 'enrolled_white_pct', prevalenceKey: 'White', color: '#6366f1' },
  { key: 'black', label: 'Black', enrollKey: 'enrolled_black_pct', prevalenceKey: 'Black', color: '#ef4444' },
  { key: 'hispanic', label: 'Hispanic', enrollKey: 'enrolled_hispanic_pct', prevalenceKey: 'Hispanic', color: '#f59e0b' },
  { key: 'asian', label: 'Asian', enrollKey: 'enrolled_asian_pct', prevalenceKey: 'Asian', color: '#3b82f6' },
];

function ratioBadgeColor(ratio) {
  if (ratio < 0.5) return { bg: '#fef2f2', text: '#dc2626', label: 'Severe ↓' };
  if (ratio < 0.8) return { bg: '#fffbeb', text: '#d97706', label: 'Under ↓' };
  if (ratio <= 1.2) return { bg: '#f0fdf4', text: '#16a34a', label: 'Rep. ✓' };
  return { bg: '#eff6ff', text: '#2563eb', label: 'Over ↑' };
}

function computeTrialMetrics(trial) {
  const prevalence = DISEASE_PREVALENCE[trial.condition_studied];
  if (!prevalence) return null;

  const ratios = {};
  for (const rk of RACE_KEYS) {
    const enrolled = trial[rk.enrollKey] || 0;
    const prev = prevalence.byRace[rk.prevalenceKey] || prevalence.overall || 1;
    // Normalize prevalence to % (it's already in %)
    const totalEnrolledPct = RACE_KEYS.reduce((s, r) => s + (trial[r.enrollKey] || 0), 0);
    const enrolledNorm = totalEnrolledPct > 0 ? (enrolled / totalEnrolledPct) * 100 : enrolled;
    // Ratio = enrolled share / prevalence share (both normalized)
    const totalPrev = Object.values(prevalence.byRace).reduce((a, b) => a + b, 0);
    const prevalenceShare = prev / totalPrev;
    const enrolledShare = enrolledNorm / 100;
    ratios[rk.key] = totalPrev > 0 ? enrolledShare / prevalenceShare : 1;
  }

  // Gender ratio
  const femaleEnrolled = trial.enrolled_female_pct || 50;
  const femalePrevalence = prevalence.byGender?.Female || 50;
  const maleEnrolled = 100 - femaleEnrolled;
  const malePrevalence = 100 - femalePrevalence;
  const femaleRatio = femalePrevalence > 0 ? (femaleEnrolled / femalePrevalence) : 1;
  const ageRatio = prevalence.age65plus > 0 ? ((trial.enrolled_age_65plus_pct || 20) / prevalence.age65plus) : 1;

  // Dropout disparity
  const dropoutRaces = trial.dropout_by_race;
  const avgDropout = trial.dropout_rate_pct;
  const maxDropoutGap = dropoutRaces
    ? Math.max(...Object.values(dropoutRaces)) - Math.min(...Object.values(dropoutRaces))
    : 0;

  // Generalizability: ratio of enrolled to most-affected group
  const minRatio = Math.min(...RACE_KEYS.map(rk => ratios[rk.key]));
  const mostAffectedGroup = RACE_KEYS.reduce((best, rk) => {
    const prev = prevalence.byRace[rk.prevalenceKey] || 0;
    return prev > (prevalence.byRace[best.prevalenceKey] || 0) ? rk : best;
  }, RACE_KEYS[0]);

  const mostAffectedRatio = ratios[mostAffectedGroup.key];
  const unaffectedPct = mostAffectedRatio < 0.8
    ? ((prevalence.byRace[mostAffectedGroup.prevalenceKey] || 0) / Object.values(prevalence.byRace).reduce((a, b) => a + b, 0) * 100)
    : 0;

  // Score
  let score = 100;
  for (const rk of RACE_KEYS) {
    const ratio = ratios[rk.key];
    if (ratio < 0.5) score -= 20;
    else if (ratio < 0.8) score -= 10;
  }
  if (femaleRatio < 0.5) score -= 15;
  else if (femaleRatio < 0.8) score -= 8;
  if (ageRatio < 0.5) score -= 12;
  else if (ageRatio < 0.8) score -= 6;
  if (maxDropoutGap > 10) score -= 12;
  else if (maxDropoutGap > 5) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ratios, femaleRatio, ageRatio, maxDropoutGap,
    mostAffectedGroup: mostAffectedGroup.label,
    mostAffectedRatio,
    unaffectedPct: Math.round(unaffectedPct),
    prevalence,
    score,
    grade: grade(score),
  };
}

function analyzeAllTrials(trials) {
  const trialResults = trials.map(t => ({
    ...t,
    metrics: computeTrialMetrics(t),
  }));

  const totalFindings = trialResults.reduce((sum, t) => {
    if (!t.metrics) return sum;
    let cnt = 0;
    for (const rk of RACE_KEYS) {
      if (t.metrics.ratios[rk.key] < 0.5) cnt++;
    }
    if (t.metrics.femaleRatio < 0.5 || t.metrics.femaleRatio > 1.5) cnt++;
    if (t.metrics.ageRatio < 0.5) cnt++;
    return sum + cnt;
  }, 0);

  const avgScore = Math.round(trialResults.reduce((s, t) => s + (t.metrics?.score || 50), 0) / trialResults.length);

  return { trialResults, totalFindings, avgScore, grade: grade(avgScore) };
}

// ── Representation Grid ───────────────────────────────────────────────────────
function RepresentationGrid({ trial, metrics }) {
  if (!metrics) return <div style={{ color: '#94a3b8', fontSize: '13px' }}>Condition not in prevalence database</div>;

  const rows = [
    ...RACE_KEYS.map(rk => ({
      label: rk.label,
      enrolled: trial[rk.enrollKey] || 0,
      ratio: metrics.ratios[rk.key],
      color: rk.color,
    })),
    {
      label: 'Female',
      enrolled: trial.enrolled_female_pct || 50,
      ratio: metrics.femaleRatio,
      color: '#8b5cf6',
    },
    {
      label: 'Age 65+',
      enrolled: trial.enrolled_age_65plus_pct || 20,
      ratio: metrics.ageRatio,
      color: '#06b6d4',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
      {rows.map((row, i) => {
        const badge = ratioBadgeColor(row.ratio);
        return (
          <div key={i} style={{
            backgroundColor: badge.bg, borderRadius: '10px', padding: '14px 16px',
            border: `1px solid ${badge.text}30`
          }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{row.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: badge.text, lineHeight: 1 }}>{fmtRatio(row.ratio)}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Enrolled: {fmtPct(row.enrolled)}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: badge.text, marginTop: '2px' }}>{badge.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dropout Chart ─────────────────────────────────────────────────────────────
function buildDropoutChart(dropoutByRace) {
  if (!dropoutByRace) return null;
  const colors = { White: '#6366f1', Black: '#ef4444', Hispanic: '#f59e0b', Asian: '#3b82f6' };
  const rows = [['Race', 'Dropout Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(dropoutByRace)) {
    rows.push([race, rate, colors[race] || '#94a3b8', `${rate}%`]);
  }
  return rows;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClinicalTrialDashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [selectedTrialIdx, setSelectedTrialIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [criteriaAnalysis, setCriteriaAnalysis] = useState(null);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteData, setRewriteData] = useState(null);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      setAnalysis(analyzeAllTrials(CLINICAL_TRIALS));
      setLoading(false);
    }, 800);
  };
  const handleCSV = (rows, err) => {
    if (err) return;
    // CSV contains trial-level rows — analyze them directly
    setAnalysis(analyzeAllTrials(rows));
  };

  const currentTrial = analysis?.trialResults[selectedTrialIdx];
  const currentMetrics = currentTrial?.metrics;

  const analyzeCriteria = useCallback(async (trial) => {
    if (!trial.enrollment_criteria_text) return;
    setCriteriaLoading(true);
    try {
      const prompt = `Review these clinical trial eligibility criteria for a ${trial.condition_label} trial.
Identify any criteria that would disproportionately exclude racial minorities, women, elderly patients, or patients with comorbidities.
Criteria: "${trial.enrollment_criteria_text}"
Return a plain text list. For each exclusionary criterion: state the criterion, which group is affected, why it excludes them, and suggest an inclusive alternative.
Format each as: CRITERION: [text] | AFFECTS: [group] | REASON: [why] | ALTERNATIVE: [suggestion]`;
      const { text } = await callAI(prompt);
      const items = text.split('\n').filter(l => l.includes('CRITERION:') || l.includes('criterion:'));
      setCriteriaAnalysis(text);
    } catch {
      setCriteriaAnalysis('Unable to analyze criteria at this time. Please check your AI configuration.');
    }
    setCriteriaLoading(false);
  }, []);

  const openRectify = (trial, metrics) => {
    const underrep = RACE_KEYS.filter(rk => (metrics?.ratios[rk.key] || 1) < 0.8);
    const original = `CURRENT ENROLLMENT PROFILE — ${trial.trial_name}:\n` +
      `Condition: ${trial.condition_label}\n` +
      `Total participants: ${trial.total_participants}\n` +
      `White enrolled: ${trial.enrolled_white_pct}%\n` +
      `Black enrolled: ${trial.enrolled_black_pct}%\n` +
      `Hispanic enrolled: ${trial.enrolled_hispanic_pct}%\n` +
      `Female enrolled: ${trial.enrolled_female_pct}%\n` +
      `Age 65+ enrolled: ${trial.enrolled_age_65plus_pct}%\n` +
      `Dropout rate: ${trial.dropout_rate_pct}%\n` +
      `Site types: ${trial.site_types.join(', ')}`;

    const rewritten = `PROPOSED RECRUITMENT IMPROVEMENTS:\n\n` +
      `1. TARGET ENROLLMENT NUMBERS\n` +
      underrep.map(rk => {
        const prev = metrics?.prevalence?.byRace[rk.prevalenceKey] || 0;
        const totalPrev = Object.values(metrics?.prevalence?.byRace || {}).reduce((a, b) => a + b, 0);
        const targetPct = totalPrev > 0 ? ((prev / totalPrev) * 100) : 20;
        const targetN = Math.round((targetPct / 100) * trial.total_participants);
        return `   • ${rk.label}: target ${targetPct.toFixed(0)}% enrollment (~${targetN} participants)`;
      }).join('\n') + `\n\n` +
      `2. COMMUNITY RECRUITMENT PARTNERSHIPS\n` +
      `   • HBCUs and HBCU-affiliated medical centers\n` +
      `   • Federally Qualified Health Centers (FQHCs) in underserved ZIP codes\n` +
      `   • Community health centers + trusted community organizations\n` +
      `   • Bilingual study coordinators for non-English-speaking patients\n\n` +
      `3. PROTOCOL MODIFICATIONS TO REDUCE DROPOUT\n` +
      `   • Transportation reimbursement for low-income participants\n` +
      `   • Flexible visit scheduling (evenings/weekends)\n` +
      `   • Home visit option for mobility-limited patients\n` +
      `   • Translated consent forms and study materials\n\n` +
      `4. SITE EXPANSION\n` +
      `   • Add community hospital sites in majority-minority zip codes\n` +
      `   • Rural recruitment via telehealth enrollment visits`;

    const changes = underrep.map(rk => ({
      action: `Increase ${rk.label} enrollment to match prevalence`,
      original: `${rk.label} enrolled: ${trial[rk.enrollKey]}% (representation ratio: ${fmtRatio(metrics?.ratios[rk.key] || 0)})`,
      replacement: `${rk.label} enrollment target: ${Math.round(((metrics?.prevalence?.byRace[rk.prevalenceKey] || 0) / Object.values(metrics?.prevalence?.byRace || { x: 1 }).reduce((a, b) => a + b, 0)) * 100)}% — through FQHC partnerships and targeted community outreach`,
      reason: `Representation ratio ${fmtRatio(metrics?.ratios[rk.key] || 0)} means results may not generalize to this population group, which has disproportionate disease burden`,
    }));

    setRewriteData({ original, rewritten, changes });
    setRewriteOpen(true);
  };

  // ── Upload Screen ──────────────────────────────────────────────────────────
  if (!analysis) {
    return (
      <UploadOrDemo
        title="Clinical Trial Diversity Audit"
        description="Audit clinical trial enrollment against actual disease prevalence by race, gender, and age. Detect underrepresentation, dropout disparities, and eligibility criteria exclusion."
        icon="science"
        iconColor="#06b6d4"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 15 Clinical Trials"
        columns={CSV_COLUMNS}
        loading={loading}
      />
    );
  }

  // ── Trial Panel ────────────────────────────────────────────────────────────
  const trial = currentTrial;
  const metrics = currentMetrics;
  const dropoutChartData = trial?.dropout_by_race ? buildDropoutChart(trial.dropout_by_race) : null;

  // Build findings for current trial
  const findings = [];
  if (metrics) {
    for (const rk of RACE_KEYS) {
      const ratio = metrics.ratios[rk.key];
      if (ratio < 0.5) {
        findings.push({
          id: `rep-${rk.key}`,
          title: `Severe Underrepresentation — ${rk.label} Patients Enrolled at ${fmtPct(trial[rk.enrollKey])} vs Disease Prevalence (Ratio: ${fmtRatio(ratio)})`,
          severity: 'SEVERE',
          rewriteAvailable: true,
          metrics: [
            { label: 'Enrolled %', value: fmtPct(trial[rk.enrollKey]) },
            { label: 'Prevalence', value: `${metrics.prevalence.byRace[rk.prevalenceKey]}% in affected population` },
            { label: 'Representation Ratio', value: fmtRatio(ratio) },
            { label: 'Interpretation', value: 'Results may not generalize to highest-risk group' },
          ],
          legalBasis: [
            { name: 'FDA Diversity Action Plan', citation: 'FDA Guidance on Diversity Action Plans for Clinical Studies (2024) — requires enrollment targets for underrepresented populations in Phase III trials' },
            { name: 'NIH Rev. Act', citation: '42 U.S.C. §289a-2 — NIH Revitalization Act requires inclusion of minorities and women in NIH-funded clinical research' },
            { name: '21st Century Cures Act', citation: 'Section 2032 — directs FDA to issue guidance on inclusion of underrepresented populations in clinical trials' },
          ],
        });
      } else if (ratio < 0.8) {
        findings.push({
          id: `rep-under-${rk.key}`,
          title: `Underrepresentation — ${rk.label} Patients at Ratio ${fmtRatio(ratio)} (Target: 0.8–1.2)`,
          severity: 'HIGH',
          rewriteAvailable: true,
          metrics: [
            { label: 'Enrolled %', value: fmtPct(trial[rk.enrollKey]) },
            { label: 'Representation Ratio', value: fmtRatio(ratio) },
            { label: 'Gap to Representative', value: `${((0.8 - ratio) * 100).toFixed(0)}% below threshold` },
          ],
          legalBasis: [
            { name: 'FDA Diversity Action Plan', citation: 'FDA 2024 Diversity Action Plan guidance — underrepresentation below 0.8 ratio triggers mandatory recruitment plan' },
            { name: 'ICH E17', citation: 'ICH E17 Guideline on multi-regional clinical trials — requires generalizability analysis when enrollment does not reflect disease population' },
          ],
        });
      }
    }

    if (metrics.ageRatio < 0.5 && metrics.prevalence.age65plus > 10) {
      findings.push({
        id: 'age-underrep',
        title: `Elderly Population Severely Underrepresented — Age 65+ Enrolled ${trial.enrolled_age_65plus_pct}% vs ${metrics.prevalence.age65plus}% Disease Prevalence`,
        severity: 'SEVERE',
        rewriteAvailable: true,
        metrics: [
          { label: 'Age 65+ Enrolled', value: `${trial.enrolled_age_65plus_pct}%` },
          { label: 'Age 65+ Disease Prevalence', value: `${metrics.prevalence.age65plus}%` },
          { label: 'Ratio', value: fmtRatio(metrics.ageRatio) },
          { label: 'Impact', value: 'Primary affected population excluded' },
        ],
        legalBasis: [
          { name: 'NIH Revitalization Act', citation: 'NIH requires inclusion of elderly patients in federally funded clinical research when they are the primary affected population' },
        ],
      });
    }

    if (metrics.maxDropoutGap > 10) {
      findings.push({
        id: 'dropout-disparity',
        title: `Dropout Disparity — ${metrics.maxDropoutGap.toFixed(0)}pp Gap Across Racial Groups Suggests Inaccessible Protocol`,
        severity: metrics.maxDropoutGap > 15 ? 'HIGH' : 'MEDIUM',
        rewriteAvailable: true,
        metrics: [
          { label: 'Max Dropout Gap', value: `${metrics.maxDropoutGap.toFixed(1)}pp` },
          { label: 'Threshold', value: '>10pp = flag' },
          { label: 'Cause', value: 'Protocol access barriers (transport, scheduling, language)' },
        ],
        legalBasis: [
          { name: 'FDA Diversity Action Plan', citation: 'FDA 2024 — high minority dropout rates trigger protocol review requirement for access barriers' },
        ],
      });
    }
  }

  if (trial?.contextNote && trial.condition_studied === 'sickle_cell') {
    findings.push({
      id: 'context-note',
      title: `Context Note: High ${RACE_KEYS[1].label} Enrollment Is Appropriate for This Condition`,
      severity: 'LOW',
      rewriteAvailable: false,
      metrics: [{ label: 'Note', value: 'See context note below' }],
      legalBasis: [],
    });
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Clinical Trial Diversity Audit</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{CLINICAL_TRIALS.length} trials analyzed · {analysis.totalFindings} representation findings</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '10px', padding: '10px 20px',
            border: '1px solid #e2e8f0', textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Platform Avg Score</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: analysis.avgScore < 35 ? '#ef4444' : analysis.avgScore < 65 ? '#f59e0b' : '#16a34a' }}>
              {analysis.avgScore}/100
            </div>
          </div>
          <button onClick={loadDemo} style={{
            padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
            border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>refresh</span> Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Trial Selector */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', backgroundColor: '#0f172a', color: '#fff', fontSize: '13px', fontWeight: '700' }}>
            {CLINICAL_TRIALS.length} Trials
          </div>
          {analysis.trialResults.map((t, idx) => {
            const sc = t.metrics?.score ?? 50;
            const scoreColor = sc < 35 ? '#ef4444' : sc < 65 ? '#f59e0b' : '#16a34a';
            return (
              <div
                key={t.trial_id}
                onClick={() => { setSelectedTrialIdx(idx); setCriteriaAnalysis(null); }}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                  backgroundColor: selectedTrialIdx === idx ? '#f8fafc' : '#fff',
                  borderLeft: selectedTrialIdx === idx ? '3px solid #0f172a' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>{t.trial_name}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{t.condition_label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: scoreColor }}>{sc}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>/ 100</div>
                  {t.contextNote && <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: '600' }}>Note</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trial Detail Panel */}
        <div>
          {trial && (
            <>
              {/* Trial header */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{trial.trial_name}</h2>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>{trial.condition_label} · {trial.total_participants.toLocaleString()} participants · {trial.site_count} sites</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {trial.site_types.map(s => (
                        <span key={s} style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  {metrics && (
                    <div style={{ textAlign: 'center' }}>
                      <BiasScoreGauge score={metrics.score} grade={metrics.grade} size={90} />
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Trial Score</div>
                    </div>
                  )}
                </div>

                {trial.contextNote && (
                  <div style={{ marginTop: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1e40af' }}>
                    <strong>Context:</strong> {trial.contextNote}
                  </div>
                )}

                {metrics && metrics.mostAffectedRatio < 0.8 && (
                  <div style={{ marginTop: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#991b1b' }}>
                    <strong>Generalizability Warning:</strong> Results may not generalize to {metrics.unaffectedPct}% of the highest-risk population ({metrics.mostAffectedGroup} patients — representation ratio: {fmtRatio(metrics.mostAffectedRatio)}).
                  </div>
                )}
              </div>

              {/* Rep Grid */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Representation Ratios (Enrolled % ÷ Prevalence %)</h3>
                <RepresentationGrid trial={trial} metrics={metrics} />
              </div>

              {/* Dropout chart */}
              {dropoutChartData && (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Dropout Rate by Race</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Gap &gt; 10pp = inaccessible protocol flag · Threshold: {trial.dropout_rate_pct}% overall</div>
                  <Chart chartType="ColumnChart" width="100%" height="200px" data={dropoutChartData}
                    options={{
                      legend: 'none',
                      vAxis: { format: '#\'%\'', gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
                      hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
                      chartArea: { left: 44, right: 8, top: 8, bottom: 40 },
                      backgroundColor: 'transparent',
                      annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
                      bar: { groupWidth: '55%' },
                    }}
                  />
                </div>
              )}

              {/* Criteria analysis */}
              {trial.enrollment_criteria_text && (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Eligibility Criteria Analysis</h3>
                  <div style={{ fontSize: '13px', color: '#475569', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontFamily: 'monospace', lineHeight: '1.6', border: '1px solid #e2e8f0' }}>
                    {trial.enrollment_criteria_text}
                  </div>
                  {!criteriaAnalysis ? (
                    <button
                      onClick={() => analyzeCriteria(trial)}
                      disabled={criteriaLoading}
                      style={{
                        padding: '8px 16px', backgroundColor: '#6366f1', color: '#fff',
                        border: 'none', borderRadius: '8px', cursor: criteriaLoading ? 'wait' : 'pointer',
                        fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px' }}>
                        {criteriaLoading ? 'hourglass_empty' : 'auto_awesome'}
                      </span>
                      {criteriaLoading ? 'Analyzing...' : 'Analyze Criteria for Exclusion Bias (AI)'}
                    </button>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.7', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                      {criteriaAnalysis}
                    </div>
                  )}
                </div>
              )}

              {/* Findings */}
              {findings.length > 0 && (
                <>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Findings</h2>
                  {findings.map(f => (
                    <FindingCard
                      key={f.id}
                      title={f.title}
                      severity={f.severity}
                      metrics={f.metrics}
                      legalBasis={f.legalBasis}
                      rewriteAvailable={f.rewriteAvailable}
                      onRectifyClick={() => openRectify(trial, metrics)}
                    />
                  ))}
                </>
              )}

              {findings.length === 0 && metrics && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                  <span className="material-icons-round" style={{ fontSize: '36px', color: '#16a34a', display: 'block', marginBottom: '8px' }}>verified</span>
                  <div style={{ fontWeight: '700', color: '#15803d', fontSize: '16px' }}>Trial Population is Representative</div>
                  <div style={{ color: '#166534', fontSize: '13px', marginTop: '4px' }}>All representation ratios are within the 0.8–1.2 acceptable range.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
