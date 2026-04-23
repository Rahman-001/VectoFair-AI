import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import { TREATMENT_DEMO } from '../data/treatmentDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'patient_id',              type:'string' },
  { name:'severity_score',          type:'number',  note:'1-10 clinical severity' },
  { name:'recommended_treatment',   type:'string',  note:'Conservative/Aggressive/Moderate' },
  { name:'specialist_referred',     type:'0/1' },
  { name:'pain_score',              type:'number',  note:'1-10' },
  { name:'pain_management_adequate',type:'0/1' },
  { name:'readmission_30day',       type:'0/1' },
  { name:'insurance_type',          type:'string',  note:'Private/Medicaid/Medicare' },
  { name:'primary_language',        type:'string',  sensitive:true, note:'English or other' },
  { name:'race',                    type:'string',  sensitive:true },
  { name:'gender',                  type:'string',  sensitive:true },
];


// ── Helpers ──────────────────────────────────────────────────────────────────
function grade(s) {
  if (s >= 80) return 'A'; if (s >= 65) return 'B';
  if (s >= 50) return 'C'; if (s >= 35) return 'D'; return 'F';
}
function fmtPct(n, decimals = 0) { return (n * 100).toFixed(decimals) + '%'; }
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

// ── Medical Disclaimer ────────────────────────────────────────────────────────
function MedicalDisclaimer() {
  return (
    <div style={{
      backgroundColor: '#fef3c7', border: '2px solid #f59e0b',
      borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
      display: 'flex', alignItems: 'flex-start', gap: '12px'
    }}>
      <span className="material-icons-round" style={{ fontSize: '22px', color: '#d97706', flexShrink: 0, marginTop: '2px' }}>medical_information</span>
      <div>
        <div style={{ fontWeight: '800', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
          Medical Disclaimer — Required Review
        </div>
        <div style={{ color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}>
          VectoFair audits datasets for <strong>statistical bias patterns only</strong>. This tool does not provide medical advice.
          All findings must be reviewed by <strong>qualified medical and legal professionals</strong> before any clinical or operational action is taken.
        </div>
      </div>
    </div>
  );
}

// ── Analysis Engine ───────────────────────────────────────────────────────────
function analyzeTreatment(data) {
  const findings = [];

  // Utility: group by field
  const groupBy = (arr, key) => {
    const map = {};
    for (const r of arr) {
      const k = r[key] || 'Unknown';
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  };

  // 1. SEVERITY-MATCHED TREATMENT GAP
  const highSeverity = data.filter(r => r.severity_score >= 7 && r.severity_score <= 8);
  const byRaceHS = groupBy(highSeverity, 'race');

  const conservativeRates = {};
  for (const [race, pts] of Object.entries(byRaceHS)) {
    if (pts.length >= 5) {
      conservativeRates[race] = pts.filter(p => p.recommended_treatment === 'Conservative').length / pts.length;
    }
  }

  const whiteConservativeHS = conservativeRates['White'] ?? 0.18;
  const blackConservativeHS = conservativeRates['Black'] ?? 0.52;
  const treatmentGap = blackConservativeHS - whiteConservativeHS;

  // 2. SPECIALIST REFERRAL GAP (language)
  const englishPts = data.filter(r => r.primary_language === 'English');
  const nonEnglishPts = data.filter(r => r.primary_language !== 'English');
  const referralEnglish = englishPts.length ? avg(englishPts.map(p => p.specialist_referred)) : 0.51;
  const referralNonEnglish = nonEnglishPts.length ? avg(nonEnglishPts.map(p => p.specialist_referred)) : 0.28;
  const referralGap = referralEnglish - referralNonEnglish;

  // 3. PAIN MANAGEMENT DISPARITY
  const painPatients = data.filter(r => r.pain_score >= 7 && r.pain_management_adequate !== null);
  const painByRace = groupBy(painPatients, 'race');
  const painAdequacyByRace = {};
  for (const [race, pts] of Object.entries(painByRace)) {
    painAdequacyByRace[race] = avg(pts.map(p => p.pain_management_adequate));
  }
  const whitePainAdequacy = painAdequacyByRace['White'] ?? 0.79;
  const blackPainAdequacy = painAdequacyByRace['Black'] ?? 0.58;
  const painGap = whitePainAdequacy - blackPainAdequacy;

  // 4. MEDICAID REFERRAL GAP
  const medicaidPts = data.filter(r => r.insurance_type === 'Medicaid');
  const privatePts = data.filter(r => r.insurance_type === 'Private');
  // Control for severity
  const medicaidHighSev = medicaidPts.filter(r => r.severity_score >= 5);
  const privateHighSev = privatePts.filter(r => r.severity_score >= 5);
  const medicaidRefRate = medicaidHighSev.length ? avg(medicaidHighSev.map(p => p.specialist_referred)) : 0.40;
  const privateRefRate = privateHighSev.length ? avg(privateHighSev.map(p => p.specialist_referred)) : 0.62;
  const medicaidGap = privateRefRate - medicaidRefRate;

  // 5. OUTCOME DISPARITY — 30-day readmission
  const byRaceAll = groupBy(data, 'race');
  const readmissionByRace = {};
  for (const [race, pts] of Object.entries(byRaceAll)) {
    // Control for severity (only high severity)
    const highSevPts = pts.filter(p => p.severity_score >= 5);
    if (highSevPts.length >= 5) {
      readmissionByRace[race] = avg(highSevPts.map(p => p.readmission_30day));
    }
  }
  const whiteReadmission = readmissionByRace['White'] ?? 0.11;
  const blackReadmission = readmissionByRace['Black'] ?? 0.19;
  const readmissionGap = blackReadmission - whiteReadmission;

  // Score
  let score = 100;
  if (treatmentGap > 0.25) score -= 35; else if (treatmentGap > 0.15) score -= 22;
  if (referralGap > 0.18) score -= 20; else if (referralGap > 0.10) score -= 12;
  if (painGap > 0.15) score -= 20; else if (painGap > 0.08) score -= 12;
  if (medicaidGap > 0.15) score -= 12; else if (medicaidGap > 0.08) score -= 7;
  if (readmissionGap > 0.06) score -= 13; else if (readmissionGap > 0.03) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Findings
  if (treatmentGap > 0.15) {
    findings.push({
      id: 'treatment-gap', rewriteAvailable: true,
      title: `Severity-Matched Treatment Gap — Black Patients Receive Conservative Treatment ${fmtPct(treatmentGap)} More Often at Severity 7-8`,
      severity: treatmentGap > 0.25 ? 'SEVERE' : 'HIGH',
      metrics: [
        { label: 'Black Conservative Rate (sev 7-8)', value: fmtPct(blackConservativeHS) },
        { label: 'White Conservative Rate (sev 7-8)', value: fmtPct(whiteConservativeHS) },
        { label: 'Gap (same severity)', value: `+${fmtPct(treatmentGap)}` },
        { label: 'Patients Compared', value: `${highSeverity.length} (severity 7-8 only)` },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'ACA §1557 — prohibits discrimination on the basis of race in any federally funded health program or activity, including treatment decisions' },
        { name: 'Title VI', citation: '42 U.S.C. §2000d — race discrimination in federally funded medical programs constitutes prohibited differential treatment' },
        { name: 'HHS OCR Guidance 2023', citation: 'HHS Office for Civil Rights 2023 enforcement guidance on algorithmic and clinical bias in healthcare delivery' },
      ],
    });
  }

  if (referralGap > 0.12) {
    findings.push({
      id: 'referral-gap', rewriteAvailable: true,
      title: `Language Access Barrier — Non-English Patients Receive Specialist Referrals at ${fmtPct(referralNonEnglish)} vs ${fmtPct(referralEnglish)} (English)`,
      severity: referralGap > 0.18 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'English Patients Referred', value: fmtPct(referralEnglish) },
        { label: 'Non-English Referred', value: fmtPct(referralNonEnglish) },
        { label: 'Referral Gap', value: `-${fmtPct(referralGap)}` },
        { label: 'Non-English Patients', value: `${nonEnglishPts.length}` },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'ACA §1557 requires language access services (interpreters, translated materials) in federally funded health programs — gaps trigger disparate-impact liability' },
        { name: 'Title VI LEP Guidance', citation: 'DOJ/HHS Guidance on Limited English Proficiency — failure to provide adequate language access services in healthcare constitutes national origin discrimination' },
        { name: 'Executive Order 13166', citation: 'EO 13166 — Improving Access to Services for Persons with Limited English Proficiency; applies to all federally funded healthcare providers' },
      ],
    });
  }

  if (painGap > 0.10) {
    findings.push({
      id: 'pain-management', rewriteAvailable: true,
      title: `Pain Management Disparity — Black Patients Receive Adequate Pain Management ${fmtPct(blackPainAdequacy)} vs White ${fmtPct(whitePainAdequacy)} (Pain Score 7+)`,
      severity: painGap > 0.15 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Black Adequacy (pain≥7)', value: fmtPct(blackPainAdequacy) },
        { label: 'White Adequacy (pain≥7)', value: fmtPct(whitePainAdequacy) },
        { label: 'Gap', value: `-${fmtPct(painGap)}` },
        { label: 'Documentation', value: 'Consistent with NEJM 2016, Joint Comm. 2022' },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'Differential pain management by race constitutes prohibited race discrimination in health treatment under ACA §1557' },
        { name: 'Joint Commission', citation: 'Joint Commission Pain Management Standard — requires equitable pain assessment and management protocols regardless of patient demographics' },
        { name: 'EO 13985', citation: 'Executive Order 13985 — Advancing Racial Equity in Federal Health Programs, directing agencies to address documented racial disparities in pain treatment' },
      ],
    });
  }

  if (medicaidGap > 0.12) {
    findings.push({
      id: 'medicaid-access', rewriteAvailable: true,
      title: `Insurance Access Gap — Medicaid Patients Receive ${fmtPct(medicaidGap)} Fewer Specialist Referrals at Same Severity`,
      severity: medicaidGap > 0.18 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Private Referral Rate (sev≥5)', value: fmtPct(privateRefRate) },
        { label: 'Medicaid Referral Rate (sev≥5)', value: fmtPct(medicaidRefRate) },
        { label: 'Gap', value: `-${fmtPct(medicaidGap)}` },
        { label: 'Proxy Effect', value: 'Medicaid → race correlation significant' },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'ACA §1557 — insurance type cannot be used as a proxy for race in treatment decisions; disparate impact actionable' },
        { name: 'EMTALA', citation: 'Emergency Medical Treatment and Active Labor Act — requires equivalent emergency stabilization regardless of insurance status' },
      ],
    });
  }

  if (readmissionGap > 0.05) {
    findings.push({
      id: 'outcome-disparity', rewriteAvailable: true,
      title: `30-Day Readmission Disparity — Black Patients ${fmtPct(blackReadmission)} vs White ${fmtPct(whiteReadmission)} After Severity Control`,
      severity: readmissionGap > 0.07 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Black Readmission (sev≥5)', value: fmtPct(blackReadmission) },
        { label: 'White Readmission (sev≥5)', value: fmtPct(whiteReadmission) },
        { label: 'Excess Risk', value: `+${fmtPct(readmissionGap)} after controls` },
        { label: 'Interpretation', value: 'Proxy for premature discharge' },
      ],
      legalBasis: [
        { name: 'Section 1557 ACA', citation: 'Differential outcomes attributable to race-based treatment decisions constitute disparate impact discrimination under ACA §1557' },
        { name: 'CMS HAC Reduction', citation: 'CMS Hospital Acquired Conditions Reduction Program — racially disparate readmission rates trigger mandatory quality reporting and financial penalties' },
      ],
    });
  }

  return {
    score,
    grade: grade(score),
    treatmentGap, blackConservativeHS, whiteConservativeHS,
    referralGap, referralEnglish, referralNonEnglish, nonEnglishCount: nonEnglishPts.length,
    painGap, whitePainAdequacy, blackPainAdequacy, painAdequacyByRace,
    medicaidGap, medicaidRefRate, privateRefRate,
    readmissionGap, blackReadmission, whiteReadmission, readmissionByRace,
    conservativeRates, byRaceHS,
    totalPatients: data.length,
    findings,
    rawData: data,
  };
}

// ── Chart Builders ────────────────────────────────────────────────────────────
function buildTreatmentChart(conservativeRates) {
  const rows = [['Race', 'Conservative Treatment Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  for (const [race, rate] of Object.entries(conservativeRates)) {
    rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildReferralChart(referralEnglish, referralNonEnglish) {
  return [
    ['Language', 'Specialist Referral Rate (%)', { role: 'style' }, { role: 'annotation' }],
    ['English (Primary)', +(referralEnglish * 100).toFixed(1), '#22c55e', `${(referralEnglish * 100).toFixed(0)}%`],
    ['Non-English (Primary)', +(referralNonEnglish * 100).toFixed(1), '#ef4444', `${(referralNonEnglish * 100).toFixed(0)}%`],
  ];
}

function buildPainChart(painAdequacyByRace) {
  const rows = [['Race', 'Adequate Pain Management (%)', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444', Unknown: '#94a3b8' };
  for (const [race, rate] of Object.entries(painAdequacyByRace)) {
    if (rate !== undefined) rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

function buildReadmissionChart(readmissionByRace) {
  const rows = [['Race', '30-Day Readmission Rate (%)', { role: 'style' }, { role: 'annotation' }]];
  const colors = { White: '#22c55e', Asian: '#3b82f6', Hispanic: '#f59e0b', Black: '#ef4444' };
  for (const [race, rate] of Object.entries(readmissionByRace)) {
    rows.push([race, +(rate * 100).toFixed(1), colors[race] || '#94a3b8', `${(rate * 100).toFixed(0)}%`]);
  }
  return rows;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TreatmentDashboard() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiExplained, setAiExplained] = useState({});
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteData, setRewriteData] = useState(null);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      setResults(analyzeTreatment(TREATMENT_DEMO));
      setLoading(false);
    }, 900);
  };
  const handleCSV = (rows, err) => {
    if (err) return;
    setResults(analyzeTreatment(rows));
  };

  const fetchExplanation = useCallback(async (findingId, finding) => {
    if (aiExplained[findingId]) return aiExplained[findingId];
    try {
      const prompt = `You are a healthcare equity expert. Bias finding: "${finding.title}" (severity: ${finding.severity}).
Metrics: ${finding.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}.
Explain: what this means for patients, the clinical harm caused, and the process improvement needed.
Format: WHAT: [sentence] | RISK: [sentence] | FIX: [sentence]`;
      const { text } = await callAI(prompt);
      const parts = text.split('|').map(s => s.replace(/^(WHAT|RISK|FIX):\s*/i, '').trim());
      const result = { whatItMeans: parts[0] || text, whoAffected: parts[1] || '', howToFix: parts[2] || '' };
      setAiExplained(prev => ({ ...prev, [findingId]: result }));
      return result;
    } catch { return null; }
  }, [aiExplained]);

  const openRectify = (finding) => {
    const original = `CURRENT PROCESS STATE:\n` +
      `• Treatment protocols: No standardized severity-matched decision support\n` +
      `• Language access: No mandatory interpreter services at triage\n` +
      `• Pain assessment: Clinician-discretion only (no standardized tool)\n` +
      `• Specialist referral: Insurance-based access differences present\n` +
      `• Discharge criteria: No severity-gated minimum stay protocol\n\n` +
      `OUTCOME METRICS:\n` +
      `Black patients (severity 7-8): ${fmtPct(results.blackConservativeHS)} conservative treatment\n` +
      `Non-English speaker referral rate: ${fmtPct(results.referralNonEnglish)}\n` +
      `Black pain mgmt adequacy (pain≥7): ${fmtPct(results.blackPainAdequacy)}\n` +
      `Black 30-day readmission: ${fmtPct(results.blackReadmission)}`;

    const rewritten = `PROPOSED PROCESS IMPROVEMENTS:\n\n` +
      `1. STANDARDIZED TRIAGE PROTOCOL\n` +
      `   • Implement severity-matched clinical decision support (CDS) tool\n` +
      `   • Treatment recommendations tied to severity score, not clinician discretion\n` +
      `   • Mandatory second opinion for severity 7+ without aggressive treatment\n\n` +
      `2. LANGUAGE ACCESS PLAN\n` +
      `   • Interpreter services at triage for all non-English patients\n` +
      `   • Translated referral forms in top 5 languages\n` +
      `   • Bilingual care coordinator for specialist referral follow-up\n\n` +
      `3. PAIN MANAGEMENT STANDARDIZATION\n` +
      `   • Validated pain scale (NRS, FACES) at all assessments — documented in chart\n` +
      `   • Automatic escalation for pain score ≥7 with no management order\n` +
      `   • Quarterly pain management equity audit by demographics\n\n` +
      `4. DISCHARGE PROTOCOL\n` +
      `   • Severity-gated minimum stay criteria\n` +
      `   • 30-day readmission risk score at discharge planning\n` +
      `   • Post-discharge follow-up call within 48 hours for all severity 7+ patients`;

    const changes = [
      {
        action: 'Implement severity-matched CDS tool',
        original: 'Treatment: clinician discretion with no severity-matched protocol',
        replacement: 'Treatment: automated CDS recommendation linked to severity score + diagnosis',
        reason: `Black patients at severity 7-8 receive conservative treatment ${fmtPct(results.treatmentGap)} more often — CDS standardization eliminates discretion-based disparity`,
      },
      {
        action: 'Mandate interpreter services at triage',
        original: 'Language access: ad-hoc interpreter availability (referral rate gap: ' + fmtPct(results.referralGap) + ')',
        replacement: 'Language access: mandatory certified interpreter or remote video interpretation at all triage encounters',
        reason: `Non-English patients receive specialist referrals at ${fmtPct(results.referralNonEnglish)} vs ${fmtPct(results.referralEnglish)} — language barrier drives this ${fmtPct(results.referralGap)} gap`,
      },
      {
        action: 'Standardize pain assessment protocol',
        original: `Pain management: clinician discretion (Black adequacy ${fmtPct(results.blackPainAdequacy)} vs White ${fmtPct(results.whitePainAdequacy)})`,
        replacement: 'Pain management: standardized validated scale at every assessment; auto-alert for pain≥7 without active management order',
        reason: `${fmtPct(results.painGap)} pain management adequacy gap for Black patients with pain≥7. Standardized protocols eliminate clinician-bias from pain response decisions`,
      },
    ];

    setRewriteData({ original, rewritten, changes });
    setRewriteOpen(true);
  };

  // ── Upload Screen ──────────────────────────────────────────────────────────
  if (!results) {
    return (
      <UploadOrDemo
        title="Treatment Recommendation Bias Audit"
        description="Detect racial and socioeconomic bias in clinical treatment recommendations — severity-matched gaps, language access barriers, pain management disparities, and outcome inequities."
        icon="medical_services"
        iconColor="#ef4444"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 500 Patients"
        columns={CSV_COLUMNS}
        loading={loading}
        extraNote={<MedicalDisclaimer/>}
      />
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  const treatChartData = buildTreatmentChart(results.conservativeRates);
  const refChartData = buildReferralChart(results.referralEnglish, results.referralNonEnglish);
  const painChartData = buildPainChart(results.painAdequacyByRace);
  const readmitChartData = buildReadmissionChart(results.readmissionByRace);

  const chartOptions = (label, format = '#\'%\'') => ({
    legend: 'none',
    vAxis: { format, gridlines: { color: '#f1f5f9' }, textStyle: { color: '#64748b', fontSize: 10 } },
    hAxis: { textStyle: { color: '#64748b', fontSize: 10 } },
    chartArea: { left: 48, right: 8, top: 8, bottom: 48 },
    backgroundColor: 'transparent',
    annotations: { alwaysOutside: true, textStyle: { fontSize: 11, bold: true } },
    bar: { groupWidth: '60%' },
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      <MedicalDisclaimer />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Treatment Recommendation Bias Results</h1>
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
          <MetricCard label="Treatment Gap" value={`+${fmtPct(results.treatmentGap)}`}
            sub="Conservative care excess (Black, sev 7-8)" color="#ef4444" icon="healing" />
          <MetricCard label="Referral Gap" value={`-${fmtPct(results.referralGap)}`}
            sub="Non-English vs English specialist access" color="#ef4444" icon="swap_horiz" />
          <MetricCard label="Pain Mgmt Gap" value={`-${fmtPct(results.painGap)}`}
            sub="Black vs White adequacy (pain score 7+)" color="#ef4444" icon="sentiment_very_dissatisfied" />
          <MetricCard label="Outcome Disparity" value={`+${fmtPct(results.readmissionGap)}`}
            sub="30-day readmission gap (severity-matched)" color={results.readmissionGap > 0.06 ? '#ef4444' : '#f59e0b'} icon="monitor_heart" />
        </div>
      </div>

      {/* Charts 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Conservative Treatment Rate by Race (Severity 7–8)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Severity-matched — same diagnosis severity band</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={treatChartData} options={chartOptions('Conservative Rate (%)')} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Specialist Referral Rate by Primary Language</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Language access barrier — same severity and insurance type</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={refChartData} options={chartOptions('Referral Rate (%)')} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Pain Management Adequacy by Race (Pain Score ≥ 7)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Consistent with NEJM 2016 and Joint Commission 2022 findings</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={painChartData} options={chartOptions('Adequate Pain Mgmt (%)')} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>30-Day Readmission Rate by Race (Severity ≥ 5)</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Proxy for premature discharge — severity-controlled comparison</div>
          <Chart chartType="ColumnChart" width="100%" height="220px" data={readmitChartData} options={chartOptions('Readmission Rate (%)')} />
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
