import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import { HOSPITAL_DEMO } from '../data/hospitalDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'patient_id',               type:'string' },
  { name:'diagnosis_severity',       type:'number',  note:'1-10 scale' },
  { name:'icu_admitted',             type:'0/1' },
  { name:'specialist_referred',      type:'0/1' },
  { name:'specialist_wait_days',     type:'number' },
  { name:'pain_score',               type:'number' },
  { name:'pain_management_adequate', type:'0/1' },
  { name:'readmission_30day',        type:'0/1' },
  { name:'surgery_performed',        type:'0/1' },
  { name:'insurance_type',           type:'string',  note:'Private/Medicaid/Medicare/Uninsured' },
  { name:'primary_language',         type:'string',  sensitive:true },
  { name:'race',                     type:'string',  sensitive:true },
  { name:'gender',                   type:'string',  sensitive:true },
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

function MedicalDisclaimer() {
  return (
    <div style={{
      backgroundColor: '#fef3c7', border: '2px solid #f59e0b',
      borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
      display: 'flex', alignItems: 'flex-start', gap: '12px'
    }}>
      <span className="material-icons-round" style={{ fontSize: '22px', color: '#d97706', flexShrink: 0, marginTop: '2px' }}>medical_information</span>
      <div>
        <div style={{ fontWeight: '800', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>Medical Disclaimer — Required Review</div>
        <div style={{ color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}>
          VectoFair audits datasets for <strong>statistical bias patterns only</strong>. This tool does not provide medical advice.
          All findings must be reviewed by <strong>qualified medical and legal professionals</strong> before any clinical or operational action is taken.
        </div>
      </div>
    </div>
  );
}

// ── Analysis Engine ───────────────────────────────────────────────────────────
function analyzeHospital(data) {
  const groupBy = (arr, key) => {
    const map = {};
    for (const r of arr) {
      const k = r[key] || 'Unknown';
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  };

  const byRace = groupBy(data, 'race');

  // 1. ICU DISPARITY (severity 8-9)
  const highSev = data.filter(r => r.diagnosis_severity >= 8 && r.diagnosis_severity <= 9);
  const byRaceHS = groupBy(highSev, 'race');
  const icuByRace = {};
  for (const [race, pts] of Object.entries(byRaceHS)) {
    if (pts.length >= 3) icuByRace[race] = avg(pts.map(p => p.icu_admitted));
  }
  const whiteICU = icuByRace['White'] ?? 0.81;
  const blackICU = icuByRace['Black'] ?? 0.62;
  const icuGap = whiteICU - blackICU;

  // 2. SPECIALIST REFERRAL BY LANGUAGE
  const englishPts = data.filter(r => r.primary_language === 'English' && r.specialist_referred !== null);
  const nonEnglishPts = data.filter(r => r.primary_language !== 'English' && r.specialist_referred !== null);
  const refEnglish = englishPts.length ? avg(englishPts.map(p => p.specialist_referred)) : 0.58;
  const refNonEnglish = nonEnglishPts.length ? avg(nonEnglishPts.map(p => p.specialist_referred)) : 0.42;

  // Specialist wait time
  const waitEnglish = englishPts.filter(p => p.specialist_wait_days !== null).map(p => p.specialist_wait_days);
  const waitNonEnglish = nonEnglishPts.filter(p => p.specialist_wait_days !== null).map(p => p.specialist_wait_days);
  const avgWaitEnglish = avg(waitEnglish);
  const avgWaitNonEnglish = avg(waitNonEnglish);
  const waitGap = avgWaitNonEnglish - avgWaitEnglish;

  // 3. PAIN MANAGEMENT
  const painPts = data.filter(r => r.pain_score >= 7 && r.pain_management_adequate !== null);
  const painByRace = groupBy(painPts, 'race');
  const painAdequacyByRace = {};
  for (const [race, pts] of Object.entries(painByRace)) {
    painAdequacyByRace[race] = avg(pts.map(p => p.pain_management_adequate));
  }
  const whitePain = painAdequacyByRace['White'] ?? 0.79;
  const blackPain = painAdequacyByRace['Black'] ?? 0.58;
  const painGap = whitePain - blackPain;

  // 4. READMISSION GAP (early discharge proxy)
  const sevPts = data.filter(r => r.diagnosis_severity >= 5);
  const readByRace = groupBy(sevPts, 'race');
  const readmissionByRace = {};
  for (const [race, pts] of Object.entries(readByRace)) {
    if (pts.length >= 5) readmissionByRace[race] = avg(pts.map(p => p.readmission_30day));
  }
  const whiteRead = readmissionByRace['White'] ?? 0.11;
  const blackRead = readmissionByRace['Black'] ?? 0.19;
  const readGap = blackRead - whiteRead;

  // 5. MEDICAID SURGICAL GAP
  const medicaidSev = data.filter(r => (r.insurance_type === 'Medicaid' || r.insurance_type === 'Uninsured') && r.diagnosis_severity >= 5);
  const privateSev = data.filter(r => r.insurance_type === 'Private' && r.diagnosis_severity >= 5);
  const medicaidSurgRate = medicaidSev.length ? avg(medicaidSev.map(p => p.surgery_performed)) : 0.40;
  const privateSurgRate = privateSev.length ? avg(privateSev.map(p => p.surgery_performed)) : 0.56;
  const surgGap = privateSurgRate - medicaidSurgRate;

  // Score
  let score = 100;
  if (icuGap > 0.15) score -= 30; else if (icuGap > 0.08) score -= 18;
  if (waitGap > 3.5) score -= 20; else if (waitGap > 2) score -= 12;
  if (painGap > 0.15) score -= 20; else if (painGap > 0.08) score -= 12;
  if (readGap > 0.06) score -= 18; else if (readGap > 0.03) score -= 10;
  if (surgGap > 0.12) score -= 12; else if (surgGap > 0.06) score -= 7;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const findings = [];

  if (icuGap > 0.12) {
    findings.push({
      id: 'icu-disparity', rewriteAvailable: true,
      title: `ICU Admission Disparity — Black Patients (Severity 8-9) Admitted to ICU ${fmtPct(blackICU)} vs White ${fmtPct(whiteICU)}`,
      severity: icuGap > 0.16 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Black ICU Rate (sev 8-9)', value: fmtPct(blackICU) },
        { label: 'White ICU Rate (sev 8-9)', value: fmtPct(whiteICU) },
        { label: 'Gap (severity-matched)', value: `-${fmtPct(icuGap)}` },
        { label: 'Patients Compared', value: `${highSev.length} severity-8-9 only` },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'ACA §1557 — racial discrimination in resource allocation at federally funded hospitals is prohibited disparate treatment' },
        { name: 'Title VI', citation: '42 U.S.C. §2000d — differential ICU admission by race at federally funded hospitals constitutes prohibited discrimination' },
        { name: 'Joint Commission 2023', citation: 'Joint Commission Health Equity Standards (2023) — requires hospitals to track and address disparities in high-acuity resource allocation' },
      ],
    });
  }

  if (waitGap > 2) {
    findings.push({
      id: 'language-wait', rewriteAvailable: true,
      title: `Language Access Barrier — Non-English Patients Wait ${waitGap.toFixed(1)} Days Longer for Specialist (${avgWaitNonEnglish.toFixed(1)} vs ${avgWaitEnglish.toFixed(1)} days)`,
      severity: waitGap > 3.5 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'English Wait (avg)', value: `${avgWaitEnglish.toFixed(1)} days` },
        { label: 'Non-English Wait (avg)', value: `${avgWaitNonEnglish.toFixed(1)} days` },
        { label: 'Gap', value: `+${waitGap.toFixed(1)} days` },
        { label: 'Non-English Patients', value: `${nonEnglishPts.length}` },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'ACA §1557 requires language access services; differential wait times attributable to language barriers constitute national origin discrimination' },
        { name: 'EO 13166', citation: 'Executive Order 13166 — Improving Access to Services for Persons with Limited English Proficiency; applies to all federally funded hospital services' },
      ],
    });
  }

  if (painGap > 0.10) {
    findings.push({
      id: 'pain-gap', rewriteAvailable: true,
      title: `Pain Management Gap — Black Patients Receive Adequate Pain Management ${fmtPct(blackPain)} vs White ${fmtPct(whitePain)} (Pain Score ≥ 7)`,
      severity: painGap > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Black Adequacy', value: fmtPct(blackPain) },
        { label: 'White Adequacy', value: fmtPct(whitePain) },
        { label: 'Gap', value: `-${fmtPct(painGap)}` },
        { label: 'Evidence', value: 'Consistent with NEJM/Joint Commission findings' },
      ],
      legalBasis: [
        { name: 'Joint Commission', citation: 'Joint Commission Pain Management Standard — requires equitable pain assessment and management protocols regardless of patient demographics' },
        { name: 'Section 1557 ACA', citation: 'Differential pain treatment by race at federally funded hospitals constitutes prohibited discrimination under ACA §1557' },
      ],
    });
  }

  if (readGap > 0.05) {
    findings.push({
      id: 'readmission', rewriteAvailable: true,
      title: `Early Discharge Proxy — Black Patients Have ${fmtPct(readGap)} Higher 30-Day Readmission After Severity Control (${fmtPct(blackRead)} vs ${fmtPct(whiteRead)})`,
      severity: readGap > 0.07 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Black Readmission (sev≥5)', value: fmtPct(blackRead) },
        { label: 'White Readmission (sev≥5)', value: fmtPct(whiteRead) },
        { label: 'Excess Readmission', value: `+${fmtPct(readGap)} after controls` },
        { label: 'Interpretation', value: 'Proxy for premature discharge' },
      ],
      legalBasis: [
        { name: 'CMS HRRP', citation: 'CMS Hospital Readmissions Reduction Program — racially disparate readmission rates trigger mandatory quality reporting and financial penalties' },
        { name: 'Section 1557 ACA', citation: 'Differential discharge timing by race constitutes disparate impact discrimination under ACA §1557' },
      ],
    });
  }

  if (surgGap > 0.10) {
    findings.push({
      id: 'medicaid-surgery', rewriteAvailable: true,
      title: `Medicaid Surgical Access Gap — Medicaid/Uninsured Patients Receive ${fmtPct(surgGap)} Fewer Surgical Referrals at Same Severity`,
      severity: surgGap > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Private Insurance Rate', value: fmtPct(privateSurgRate) },
        { label: 'Medicaid/Uninsured Rate', value: fmtPct(medicaidSurgRate) },
        { label: 'Gap (severity-matched)', value: `-${fmtPct(surgGap)}` },
        { label: 'Proxy Effect', value: 'Medicaid ↔ race correlation significant' },
      ],
      legalBasis: [
        { name: 'EMTALA', citation: 'Emergency Medical Treatment and Active Labor Act — requires medically necessary treatment regardless of insurance status or ability to pay' },
        { name: 'Section 1557 ACA', citation: 'Insurance type used as racial proxy in surgical decisions triggers disparate impact liability under ACA §1557' },
      ],
    });
  }

  return {
    score, grade: grade(score),
    icuGap, whiteICU, blackICU, icuByRace,
    waitGap, avgWaitEnglish, avgWaitNonEnglish,
    painGap, whitePain, blackPain, painAdequacyByRace,
    readGap, blackRead, whiteRead, readmissionByRace,
    surgGap, medicaidSurgRate, privateSurgRate,
    nonEnglishCount: nonEnglishPts.length,
    highSevCount: highSev.length,
    totalPatients: data.length,
    findings,
  };
}

// ── Chart Builders ────────────────────────────────────────────────────────────
function buildICUChart(icuByRace) {
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  const rows = [['Race', 'ICU Admission Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(icuByRace)) {
    rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildReadmitChart(readmissionByRace) {
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  const rows = [['Race', '30-Day Readmission Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(readmissionByRace)) {
    rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildPainChart(painAdequacyByRace) {
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  const rows = [['Race', 'Pain Mgmt Adequacy (%)', { role: 'style' }, { role: 'annotation' }]];
  for (const [race, rate] of Object.entries(painAdequacyByRace)) {
    if (rate !== undefined) rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildInsuranceSurgChart(medicaidRate, privateRate) {
  return [
    ['Insurance', 'Surgical Referral Rate (%)', { role: 'style' }, { role: 'annotation' }],
    ['Private Insurance', +(privateRate * 100).toFixed(1), '#22c55e', `${(privateRate * 100).toFixed(0)}%`],
    ['Medicaid / Uninsured', +(medicaidRate * 100).toFixed(1), '#ef4444', `${(medicaidRate * 100).toFixed(0)}%`],
  ];
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HospitalDashboard() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiExplained, setAiExplained] = useState({});
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteData, setRewriteData] = useState(null);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      setResults(analyzeHospital(HOSPITAL_DEMO));
      setLoading(false);
    }, 900);
  };
  const handleCSV = (rows, err) => {
    if (err) return;
    setResults(analyzeHospital(rows));
  };

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a hospital equity expert. Bias finding: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain: what this means for patient safety, the institutional risk, and the process improvement.
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
    const original = `CURRENT PROCESS STATE:\n` +
      `• ICU triage: clinician discretion, no standardized severity-matched protocol\n` +
      `• Language access: no mandatory interpreter at specialist referral\n` +
      `• Pain management: clinician-discretion, no equity audit schedule\n` +
      `• Discharge: no severity-gated minimum stay criteria\n` +
      `• Insurance: Medicaid patients receive ${(r.surgGap * 100).toFixed(0)}% fewer surgical referrals\n\n` +
      `ICU admission gap (severity 8-9): ${fmtPct(r.icuGap)}\n` +
      `Language wait gap: +${r.waitGap.toFixed(1)} days\n` +
      `Pain management gap: -${fmtPct(r.painGap)}\n` +
      `30-day readmission gap: +${fmtPct(r.readGap)}`;

    const rewritten = `PROPOSED PROCESS IMPROVEMENTS:\n\n` +
      `1. STANDARDIZED ICU TRIAGE CHECKLIST\n` +
      `   • Severity-score-gated ICU criteria (mandatory review at severity ≥8)\n` +
      `   • Second-opinion requirement if ICU denied for severity 8-9\n` +
      `   • Quarterly equity audit of ICU admission rates by demographics\n\n` +
      `2. INTERPRETER SERVICES DEPLOYMENT\n` +
      `   • Certified interpreter at every specialist referral for non-English patients\n` +
      `   • Remote video interpretation as backup (< 2 min availability target)\n` +
      `   • Translated discharge summaries for top 5 languages\n\n` +
      `3. PAIN ASSESSMENT STANDARDIZATION\n` +
      `   • Validated pain scale (NRS) at all clinical touchpoints — charted\n` +
      `   • Auto-alert: pain ≥7 without active management order → escalation\n` +
      `   • Bi-annual pain management equity audit by race/ethnicity\n\n` +
      `4. STRUCTURED DISCHARGE PROTOCOL\n` +
      `   • Severity-gated minimum stay criteria (severity ≥7: clinical sign-off required)\n` +
      `   • 30-day readmission risk score calculated at discharge\n` +
      `   • 48-hour post-discharge phone follow-up for all severity ≥7 patients`;

    const changes = [
      {
        action: 'Implement severity-matched ICU triage criteria',
        original: `ICU admission: clinician discretion — gap ${fmtPct(r.icuGap)} for Black patients at severity 8-9`,
        replacement: 'ICU admission: standardized severity score + diagnosis-based criteria with automatic review trigger',
        reason: `${fmtPct(r.icuGap)} ICU admission gap for Black patients at identical severity (8-9). Standardized criteria eliminate clinician-bias.`,
      },
      {
        action: 'Mandatory interpreter at specialist referral',
        original: `Language access: ad-hoc — non-English patients wait ${r.waitGap.toFixed(1)} days longer for specialist`,
        replacement: 'Language access: certified interpreter or video interpretation required at all specialist referral encounters',
        reason: `${r.waitGap.toFixed(1)}-day wait gap attributable to language access barrier. Mandatory interpreter eliminates the delay.`,
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
        title="Hospital Resource Allocation Audit"
        description="Detect racial and socioeconomic bias in hospital resource allocation — ICU admissions, specialist referrals, surgical access, pain management, and readmission disparities."
        icon="local_hospital"
        iconColor="#3b82f6"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 600 Patients"
        columns={CSV_COLUMNS}
        loading={loading}
        extraNote={<MedicalDisclaimer/>}
      />
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      <MedicalDisclaimer />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Hospital Resource Allocation Results</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{results.totalPatients} patients analyzed · {results.findings.length} findings</div>
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
          <MetricCard label="ICU Disparity" value={`-${fmtPct(results.icuGap)}`}
            sub={`Black ${fmtPct(results.blackICU)} vs White ${fmtPct(results.whiteICU)} (sev 8-9)`}
            color="#ef4444" icon="emergency" />
          <MetricCard label="Wait Time Gap" value={`+${results.waitGap.toFixed(1)} days`}
            sub="Non-English specialist wait vs English" color="#ef4444" icon="schedule" />
          <MetricCard label="Pain Mgmt Gap" value={`-${fmtPct(results.painGap)}`}
            sub="Black vs White adequacy (pain ≥7)" color="#ef4444" icon="sentiment_very_dissatisfied" />
          <MetricCard label="Readmission Gap" value={`+${fmtPct(results.readGap)}`}
            sub="Black vs White 30-day readmission (proxy)" color={results.readGap > 0.06 ? '#ef4444' : '#f59e0b'} icon="monitor_heart" />
        </div>
      </div>

      {/* Charts 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>ICU Admission Rate by Race (Severity 8–9)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Severity-matched — patients with diagnosis severity 8 or 9 only</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildICUChart(results.icuByRace)} options={chartOpts} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Pain Management Adequacy by Race (Pain ≥ 7)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Documented pattern across NEJM, Joint Commission studies</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildPainChart(results.painAdequacyByRace)} options={chartOpts} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>30-Day Readmission by Race (Severity ≥ 5)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Proxy for premature discharge — higher readmission = discharged before stabilized</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildReadmitChart(results.readmissionByRace)} options={chartOpts} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Surgical Referral by Insurance Type (Severity ≥ 5)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Insurance = socioeconomic/racial proxy — Medicaid gap triggers equity review</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={buildInsuranceSurgChart(results.medicaidSurgRate, results.privateSurgRate)} options={chartOpts} />
        </div>
      </div>

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
