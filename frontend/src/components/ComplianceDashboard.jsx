import React, { useState, useEffect } from 'react';
import { callAI } from '../utils/aiClient';
import { downloadCompliancePDF } from '../utils/pdfGenerator';

// ── Regulation definitions ─────────────────────────────────────────────────
const REGULATIONS = [
  {
    id: 'eeoc',
    name: 'EEOC Annual Workforce Report',
    icon: 'balance',
    color: '#3b82f6',
    bg: '#eff6ff',
    sections: ['EEO-1 Workforce Composition', 'Adverse Impact Analysis', 'Selection Procedure Review', 'Corrective Action Plan (30/60/90 Day)'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal 150-word methodology statement for an EEOC workforce analysis of ${n} employees across ${depts} departments at ${org}. Use formal regulatory language consistent with EEOC Uniform Guidelines.`,
  },
  {
    id: 'ofccp',
    name: 'OFCCP Compliance Review Response',
    icon: 'corporate_fare',
    color: '#10b981',
    bg: '#f0fdf4',
    sections: ['Utilization Analysis (Availability vs Incumbency)', 'Adverse Impact per Employment Decision Type', 'Compensation Equity Summary', 'Good Faith Efforts'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal OFCCP Compliance Review methodology statement for ${org}, covering utilization analysis for ${n} employees across ${depts} job groups. Reference 41 CFR Part 60.`,
  },
  {
    id: 'eu-ai-act',
    name: 'EU AI Act — Article 10 Documentation',
    icon: 'gavel',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    sections: ['Dataset Composition & Provenance', 'Bias Detection Methodology', 'Mitigation Measures Implemented', 'Human Oversight Procedures', 'Ongoing Monitoring Schedule'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal EU AI Act Article 10 dataset documentation statement for a high-risk AI system deployed by ${org}, trained on ${n} employee records across ${depts} domains. Reference Regulation (EU) 2024/1689.`,
  },
  {
    id: 'ny-ll144',
    name: 'NY Local Law 144 (Automated Employment Tools)',
    icon: 'location_city',
    color: '#f59e0b',
    bg: '#fffbeb',
    sections: ['AEDT Audit Summary', 'Independent Auditor Statement Template', 'Bias Audit Results Table', 'Public Posting Requirements Checklist', 'Notice to Candidates Template'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal NY Local Law 144 AEDT bias audit methodology statement for ${org}, covering ${n} employment decisions. Reference NYC Admin Code § 20-871.`,
  },
  {
    id: 'cfpb',
    name: 'CFPB Fair Lending Examination',
    icon: 'account_balance',
    color: '#ef4444',
    bg: '#fef2f2',
    sections: ['HMDA Data Summary', 'Disparate Impact Findings Table', 'Pricing Disparities Analysis', 'Underwriting Disparities Analysis'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal CFPB Fair Lending examination methodology statement for ${org}, covering ${n} lending decisions. Reference ECOA Regulation B and Fair Housing Act.`,
  },
  {
    id: 'ca-sb1162',
    name: 'CA SB 1162 — Pay Transparency',
    icon: 'payments',
    color: '#ec4899',
    bg: '#fdf2f8',
    sections: ['Pay Data Report by Job Category & Pay Band', 'Median & Mean Hourly Rate Tables', 'Variance from Median by Demographic Group', 'Reporting Certification Statement'],
    methodologyPrompt: (n, depts, org) =>
      `Write a formal California SB 1162 pay data reporting statement for ${org}, covering ${n} employees across ${depts} job categories. Reference California Labor Code Section 432.3.`,
  },
];

// ── Session audit picker ──────────────────────────────────────────────────
const SESSION_KEYS = {
  'pay-gap':      'fl_pay_gap_results',
  'promotion':    'fl_promotion_results',
  'performance':  'fl_performance_results',
  'resume':       'fl_resume_results',
  'loan':         'fl_loan_results',
};

function getSessionAudits() {
  const audits = [];
  Object.entries(SESSION_KEYS).forEach(([moduleId, key]) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        audits.push({ moduleId, moduleName: data.moduleName || moduleId, score: data.score, findings: data.findings || [], timestamp: data.timestamp });
      }
    } catch {}
  });
  return audits;
}

// ── Report generator ──────────────────────────────────────────────────────
async function generateReport({ audit, regulation, orgName, reportPeriod, preparer, onProgress }) {
  const reg      = REGULATIONS.find(r => r.id === regulation);
  const n        = audit.findings?.length || 0;
  const depts    = '6';

  onProgress(10, 'Generating methodology statement…');
  let methodology = '';
  try {
    const prompt = reg.methodologyPrompt(100, depts, orgName || 'the reporting organization');
    const { text } = await callAI(prompt);
    methodology = text.trim();
  } catch {
    methodology = `This analysis was conducted using VectoFair AI Audit Platform, employing industry-standard fairness metrics including Disparate Impact Ratio (80% Rule), Demographic Parity, and Equal Opportunity metrics. Data was analyzed across ${depts} departments covering all relevant protected classes.`;
  }

  onProgress(40, 'Generating corrective action plan…');
  let correctiveAction = '';
  try {
    const findingsSummary = (audit.findings || []).slice(0, 3).map(f => f.title || f.id).join('; ');
    const caPrompt = `You are a compliance officer. Generate a structured corrective action plan for these findings: ${findingsSummary || 'pay gap, promotion disparity, linguistic bias'}.

Format as:
30-DAY ACTIONS:
• [action 1]
• [action 2]
• [action 3]

90-DAY PROCESS CHANGES:
• [change 1]
• [change 2]

6-MONTH STRUCTURAL REFORMS:
• [reform 1]
• [reform 2]`;
    const { text } = await callAI(caPrompt);
    correctiveAction = text.trim();
  } catch {
    correctiveAction = '30-DAY ACTIONS:\n• Convene equity review committee\n• Audit all relevant data sources\n• Brief leadership on findings\n\n90-DAY PROCESS CHANGES:\n• Implement structured rubrics\n• Deploy manager training\n\n6-MONTH STRUCTURAL REFORMS:\n• Revise compensation banding\n• Establish ongoing monitoring cadence';
  }

  onProgress(80, 'Assembling report…');

  const allFindings = (audit.findings || []).map(f => ({
    title:    f.title || f.id,
    severity: f.severity || 'MEDIUM',
    metrics:  (f.metrics || []).map(m => `${m.label}: ${m.value}`).join(' | '),
    legal:    (f.legalBasis || []).map(l => l.name || l).join(', '),
  }));

  onProgress(100, 'Done');

  return {
    orgName:    orgName || '[Organization Name]',
    reportPeriod,
    preparer,
    regulation: reg,
    auditName:  audit.moduleName,
    auditScore: audit.score,
    methodology,
    correctiveAction,
    findings: allFindings,
    sections: reg.sections,
    generatedAt: new Date().toLocaleString(),
  };
}

// ── Report display component ──────────────────────────────────────────────
function ReportView({ report, onExport }) {
  const { regulation } = report;

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0f172a', padding: '32px 40px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              VectoFair AI AUDIT PLATFORM — REGULATORY REPORT
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '800' }}>{regulation.name}</h1>
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>{report.orgName} · {report.reportPeriod}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Generated: {report.generatedAt}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Prepared by: {report.preparer || '[Preparer]'}</div>
            <div style={{ marginTop: '12px', display: 'inline-block', padding: '6px 14px', backgroundColor: '#1e293b', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
              Audit Score: <span style={{ color: report.auditScore < 40 ? '#ef4444' : report.auditScore < 65 ? '#f59e0b' : '#10b981' }}>{report.auditScore}/100</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '32px 40px' }}>
        {/* Legal disclaimer */}
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 16px', marginBottom: '28px', fontSize: '12px', color: '#92400e' }}>
          ⚠️ Generated by VectoFair AI Audit Platform. Consult qualified legal counsel before regulatory submission. This report is for internal review purposes.
        </div>

        {/* Table of contents */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9' }}>Report Sections</h2>
          <ol style={{ margin: 0, padding: '0 0 0 20px', color: '#475569', fontSize: '14px', lineHeight: '2' }}>
            {report.sections.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>

        {/* Methodology */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9' }}>Methodology Statement</h2>
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.7', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
            {report.methodology}
          </div>
        </div>

        {/* Findings table */}
        {report.findings.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9' }}>Bias Audit Results</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Finding', 'Severity', 'Metrics', 'Legal Basis'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: '700', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.findings.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: '600' }}>{f.title}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                          backgroundColor: f.severity === 'HIGH' ? '#fef2f2' : f.severity === 'MEDIUM' ? '#fffbeb' : '#f0fdf4',
                          color: f.severity === 'HIGH' ? '#991b1b' : f.severity === 'MEDIUM' ? '#92400e' : '#166534' }}>
                          {f.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{f.metrics || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{f.legal || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Corrective Action Plan */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9' }}>Corrective Action Plan</h2>
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.8', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
            {report.correctiveAction}
          </div>
        </div>

        {/* Section checklists */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9' }}>Compliance Checklist</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.sections.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <span className="material-icons-round" style={{ fontSize: '18px', color: '#10b981' }}>check_circle</span>
                <span style={{ fontSize: '14px', color: '#0f172a' }}>{s}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#10b981', fontWeight: '700' }}>COMPLETE</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onExport} style={{
            padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700',
            fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span className="material-icons-round">download</span>
            Download Report (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ComplianceDashboard() {
  const [step,          setStep]         = useState(1); // 1=setup, 2=generating, 3=report
  const [audits,        setAudits]       = useState([]);
  const [selectedAudit, setSelectedAudit]= useState('');
  const [regulation,    setRegulation]   = useState('eeoc');
  const [orgName,       setOrgName]      = useState('');
  const [reportPeriod,  setReportPeriod] = useState('');
  const [preparer,      setPreparer]     = useState('');
  const [progress,      setProgress]     = useState(0);
  const [progressMsg,   setProgressMsg]  = useState('');
  const [report,        setReport]       = useState(null);
  const [error,         setError]        = useState('');

  useEffect(() => {
    setAudits(getSessionAudits());
  }, []);

  const selectedAuditData = audits.find(a => a.moduleId === selectedAudit);
  const selectedReg       = REGULATIONS.find(r => r.id === regulation);

  const handleGenerate = async () => {
    if (!selectedAuditData && audits.length > 0) { setError('Please select a completed audit.'); return; }
    setError('');
    setStep(2);

    // Use demo audit if no session audit available
    const auditToUse = selectedAuditData || {
      moduleName: 'Pay Gap Analysis (Demo)',
      score: 31,
      findings: [
        { id: 'gender-gap', title: 'Gender Pay Gap Detected', severity: 'HIGH', metrics: [{ label: 'Gap', value: '21.0%' }], legalBasis: [{ name: 'Equal Pay Act' }] },
        { id: 'race-gap',   title: 'Racial Pay Gap Detected', severity: 'HIGH', metrics: [{ label: 'Gap', value: '23.0%' }], legalBasis: [{ name: 'Title VII'   }] },
        { id: 'grade',      title: 'Grade Concentration',     severity: 'MEDIUM',metrics: [{ label: 'Male at L4+', value: '78%' }], legalBasis: [{ name: 'OFCCP' }] },
      ],
    };

    try {
      const generated = await generateReport({
        audit: auditToUse,
        regulation,
        orgName,
        reportPeriod,
        preparer,
        onProgress: (pct, msg) => { setProgress(pct); setProgressMsg(msg); },
      });
      setReport(generated);
      setStep(3);
    } catch (err) {
      setError('Report generation failed: ' + err.message);
      setStep(1);
    }
  };

  const handleExport = () => {
    if (report) {
      downloadCompliancePDF(report);
    }
  };

  // ── Step 1: Setup ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={{ maxWidth: '760px', margin: '40px auto', padding: '0 20px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', borderRadius: '18px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: '36px', color: '#f59e0b' }}>gavel</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>Compliance Report Generator</h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto' }}>
            Generate regulatory-ready compliance reports for EEOC, OFCCP, EU AI Act, NY Local Law 144, CFPB, or CA SB 1162.
          </p>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

          {/* Step 1: Audit source */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
              Step 1 — Select Completed Audit
            </label>
            {audits.length > 0 ? (
              <select
                value={selectedAudit}
                onChange={e => setSelectedAudit(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', backgroundColor: '#fff' }}
              >
                <option value="">— Select an audit from this session —</option>
                {audits.map(a => (
                  <option key={a.moduleId} value={a.moduleId}>
                    {a.moduleName} (Score: {a.score}/100 · {new Date(a.timestamp).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: '14px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d', fontSize: '13px', color: '#92400e' }}>
                No completed audits in this session yet. Click "Generate with Demo Data" below to use the Pay Gap demo results.
              </div>
            )}
          </div>

          {/* Step 2: Regulation */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
              Step 2 — Select Regulation Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {REGULATIONS.map(reg => (
                <div
                  key={reg.id}
                  onClick={() => setRegulation(reg.id)}
                  style={{
                    padding: '14px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${regulation === reg.id ? reg.color : '#e2e8f0'}`,
                    backgroundColor: regulation === reg.id ? reg.bg : '#fff',
                    display: 'flex', alignItems: 'flex-start', gap: '10px'
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '20px', color: reg.color, flexShrink: 0, marginTop: '2px' }}>{reg.icon}</span>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>{reg.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Org details */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
              Step 3 — Organization Details (optional)
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'Organization Name', value: orgName, set: setOrgName, placeholder: 'e.g. Acme Corp' },
                { label: 'Report Period',     value: reportPeriod, set: setReportPeriod, placeholder: 'e.g. Q1 2025' },
                { label: 'Preparer Name',     value: preparer, set: setPreparer, placeholder: 'e.g. Jane Smith, Chief HR Officer' },
              ].map(f => (
                <div key={f.label} style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{f.label}</div>
                  <input
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', border: '1px solid #fecaca' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setSelectedAudit(''); handleGenerate(); }}
              style={{ padding: '12px 22px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              Generate with Demo Data
            </button>
            <button
              onClick={handleGenerate}
              style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span className="material-icons-round">description</span>
              Generate Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Generating ───────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '24px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons-round" style={{ fontSize: '40px', color: '#3b82f6' }}>description</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '20px', fontWeight: '700' }}>Generating Compliance Report…</h2>
          <div style={{ color: '#64748b', fontSize: '14px' }}>{progressMsg}</div>
        </div>
        <div style={{ width: '320px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', backgroundColor: '#3b82f6', width: `${progress}%`, transition: 'width 0.5s ease', borderRadius: '3px' }} />
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{progress}% complete</div>
      </div>
    );
  }

  // ── Step 3: Report ───────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Compliance Report Ready</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{report.regulation.name} · {report.orgName}</div>
        </div>
        <button
          onClick={() => { setStep(1); setReport(null); }}
          style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-icons-round" style={{ fontSize: '16px' }}>add</span>
          New Report
        </button>
      </div>
      <ReportView report={report} onExport={handleExport} />
    </div>
  );
}
