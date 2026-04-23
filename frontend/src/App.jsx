import { useState, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';

// ── Existing pages ─────────────────────────────────────────────────────────
import DomainSelector    from './components/DomainSelector';
import UploadStep        from './components/UploadStep';
import AnalysisStep      from './components/AnalysisStep';
import ResultsDashboard  from './components/ResultsDashboard';
import ResumeUploader    from './components/ResumeUploader';
import ResumeDashboard   from './components/ResumeDashboard';

// ── HR modules ───────────────────────────────────────────────────────────────
import PayGapDashboard      from './components/PayGapDashboard';
import PromotionDashboard   from './components/PromotionDashboard';
import PerformanceDashboard from './components/PerformanceDashboard';
import ComplianceDashboard  from './components/ComplianceDashboard';

// ── Finance modules ───────────────────────────────────────────────────────────
import LoanDashboard        from './components/LoanDashboard';
import CreditLimitDashboard from './components/CreditLimitDashboard';
import FraudDashboard       from './components/FraudDashboard';
import InsuranceDashboard   from './components/InsuranceDashboard';

// ── Healthcare modules ────────────────────────────────────────────────────────
import TreatmentDashboard    from './components/TreatmentDashboard';
import ClinicalTrialDashboard from './components/ClinicalTrialDashboard';
import HospitalDashboard     from './components/HospitalDashboard';
import DiagnosticsDashboard  from './components/DiagnosticsDashboard';

// ── Education modules ─────────────────────────────────────────────────────────
import AdmissionsDashboard   from './components/AdmissionsDashboard';
import GradingDashboard      from './components/GradingDashboard';
import ScholarshipDashboard  from './components/ScholarshipDashboard';
import LearningPathDashboard from './components/LearningPathDashboard';

// ── Justice modules ────────────────────────────────────────────────────────────
import RecidivismDashboard    from './components/RecidivismDashboard';
import BenefitsDashboard      from './components/BenefitsDashboard';
import PublicServiceDashboard from './components/PublicServiceDashboard';

// ── Feature modules ────────────────────────────────────────────────────────────
import VectoFairChat       from './components/shared/VectoFairChat';
import DebiasingSimulator from './components/shared/DebiasingSimulator';

// ── Shared ─────────────────────────────────────────────────────────────────
import TestCasePanel from './components/shared/TestCasePanel';


// ── Module name lookup for header ──────────────────────────────────────────
const MODULE_NAMES = {
  '/audit/resume':        'Resume Screening',
  '/audit/hiring':        'Hiring CSV Audit',
  '/audit/loan':          'Loan Approval',
  '/audit/pay-gap':       'Pay Gap Analysis',
  '/audit/promotion':     'Promotion Pipeline',
  '/audit/performance':   'Performance Review Bias',
  '/audit/compliance':    'Compliance Report Generator',
  '/audit/credit-limit':  'Credit Limit Fairness',
  '/audit/fraud':         'Fraud Flag Disparity',
  '/audit/insurance':     'Insurance Premium Bias',
  '/audit/treatment':     'Treatment Recommendation Bias',
  '/audit/clinical-trial':'Clinical Trial Diversity',
  '/audit/hospital':      'Hospital Resource Allocation',
  '/audit/diagnostics':   'Diagnostic Model Fairness',
  '/audit/admissions':    'Admissions Algorithm Audit',
  '/audit/ai-grading':    'AI Grading Fairness',
  '/audit/scholarships':  'Scholarship Bias',
  '/audit/learning-path': 'Learning Path Bias',
  '/audit/recidivism':    'Recidivism Model Audit',
  '/audit/benefits':      'Government Benefit Allocation',
  '/audit/public-service':'Public Service Access',
  '/audit/gemini-chat':   'VectoFair Chat Assistant',
  '/audit/simulator':     'Debiasing Simulator',
};

// ── Coming-Soon placeholder ────────────────────────────────────────────────
function ComingSoon({ title }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '24px',
      textAlign: 'center', padding: '40px 20px'
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '20px',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        <span className="material-icons-round" style={{ fontSize: '36px', color: '#94a3b8' }}>construction</span>
      </div>
      <div>
        <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '24px', fontWeight: '700' }}>
          {title} — Coming Next
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px', maxWidth: '400px' }}>
          This module is in our build queue. The global infrastructure (shared components, AI pipeline, rewrite engine) is active and will power this module when built.
        </p>
      </div>
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          fontWeight: '600', fontSize: '14px'
        }}
      >
        <span className="material-icons-round" style={{ fontSize: '18px' }}>arrow_back</span>
        Back to All Modules
      </button>
    </div>
  );
}

// ── Hiring / CSV wizard wrapper (stateful sub-flow) ────────────────────────
function HiringWizard() {
  const [wizardStep, setWizardStep]       = useState('upload');
  const [uploadData, setUploadData]       = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [useCaseContext] = useState({ useCaseId: 'hiring', category: 'HR', label: 'Hiring CSV Audit' });

  const handleBack = () => setWizardStep('upload');

  if (wizardStep === 'upload') {
    return (
      <UploadStep
        onDataReady={(data) => { setUploadData(data); setWizardStep('analyze'); }}
        context={useCaseContext}
        onBack={handleBack}
      />
    );
  }
  if (wizardStep === 'analyze') {
    return <AnalysisStep uploadData={uploadData} onComplete={(r) => { setAnalysisResults(r); setWizardStep('results'); }} />;
  }
  return <ResultsDashboard results={analysisResults} onReset={() => setWizardStep('upload')} context={useCaseContext} />;
}

// ── Loan wizard wrapper (legacy — now delegates to LoanDashboard) ─────────

// ── Resume wrapper ─────────────────────────────────────────────────────────
function ResumeWizard() {
  const [step, setStep]               = useState('upload');
  const [resumeResults, setResumeResults] = useState(null);
  const ctx = { useCaseId: 'resume', category: 'HR', label: 'Resume Screening' };

  if (step === 'upload') {
    return (
      <ResumeUploader
        onAnalysisComplete={(r) => { setResumeResults(r); setStep('results'); }}
        context={ctx}
        onBack={() => setStep('upload')}
      />
    );
  }
  return (
    <ResumeDashboard
      analyzedResumes={resumeResults.resumes}
      isBatch={resumeResults.isBatch}
      onReset={() => setStep('upload')}
    />
  );
}

// ── Wizard step indicator ──────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 'upload',  label: 'Upload',  icon: 'upload_file' },
  { id: 'analyze', label: 'Analyze', icon: 'analytics'   },
  { id: 'results', label: 'Results', icon: 'dashboard'   },
];

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const isHome    = location.pathname === '/';
  const isAudit   = location.pathname.startsWith('/audit/');
  const moduleName = MODULE_NAMES[location.pathname] || '';

  // Detect Android native app
  const isAndroid = typeof window !== 'undefined' && window.__ANDROID_APP__ === true;

  // Audit context: full context on audit pages, general mode on home
  const auditContext = isAudit
    ? { moduleName, score: null, grade: null, findingsCount: 0, findings: [], metrics: {} }
    : { moduleName: 'VectoFair AI Assistant', score: null, grade: null, findingsCount: 0, findings: [], metrics: {}, isHome: true };

  return (
    <>
      {/* ── Persistent Header ─────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="header-brand" style={{ textDecoration: 'none' }}>
            <img src="/logo.png" alt="VectoFair AI" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
            <div>
              <div className="brand-name">VectoFair AI</div>
              <div className="brand-tagline">Bias Audit Platform</div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Current module name */}
            {isAudit && moduleName && (
              <div style={{
                fontSize: '13px', color: '#64748b', fontWeight: '500',
                padding: '4px 12px', backgroundColor: '#f1f5f9',
                borderRadius: '20px', border: '1px solid #e2e8f0'
              }}>
                {moduleName}
              </div>
            )}

            {/* Back to modules */}
            {isAudit && (
              <button
                onClick={() => navigate('/')}
                className="header-back-btn"
              >
                <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                All Modules
              </button>
            )}

            {/* Run Tests */}
            <button
              onClick={() => setTestPanelOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', backgroundColor: '#0f172a', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600'
              }}
            >
              <span className="material-icons-round" style={{ fontSize: 15 }}>science</span>
              Run Tests
            </button>

            <div className="header-badge">
              <span className="material-icons-round" style={{ fontSize: 13 }}>hub</span>
              Multi-Model AI
            </div>
            <div className="header-badge">
              <span className="material-icons-round" style={{ fontSize: 13 }}>workspace_premium</span>
              Solution Challenge 2025
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="app-main">
        <Routes>
          {/* Home */}
          <Route path="/"                     element={<DomainSelector />} />

          {/* Existing modules */}
          <Route path="/audit/resume"         element={<ResumeWizard />} />
          <Route path="/audit/hiring"         element={<HiringWizard />} />
          <Route path="/audit/loan"           element={<LoanDashboard />} />

          {/* HR Modules 2–5 */}
          <Route path="/audit/pay-gap"        element={<PayGapDashboard />} />
          <Route path="/audit/promotion"      element={<PromotionDashboard />} />
          <Route path="/audit/performance"    element={<PerformanceDashboard />} />
          <Route path="/audit/compliance"     element={<ComplianceDashboard />} />

          {/* Remaining — Coming Soon */}
          <Route path="/audit/credit-limit"   element={<CreditLimitDashboard />} />
          <Route path="/audit/fraud"          element={<FraudDashboard />} />
          <Route path="/audit/insurance"      element={<InsuranceDashboard />} />
          <Route path="/audit/treatment"      element={<TreatmentDashboard />} />
          <Route path="/audit/clinical-trial" element={<ClinicalTrialDashboard />} />
          <Route path="/audit/hospital"       element={<HospitalDashboard />} />
          <Route path="/audit/diagnostics"    element={<DiagnosticsDashboard />} />
          <Route path="/audit/admissions"     element={<AdmissionsDashboard />} />
          <Route path="/audit/ai-grading"     element={<GradingDashboard />} />
          <Route path="/audit/scholarships"   element={<ScholarshipDashboard />} />
          <Route path="/audit/learning-path"  element={<LearningPathDashboard />} />
          <Route path="/audit/recidivism"     element={<RecidivismDashboard />} />
          <Route path="/audit/benefits"       element={<BenefitsDashboard />} />
          <Route path="/audit/public-service" element={<PublicServiceDashboard />} />
          <Route path="/audit/gemini-chat"    element={<ComingSoon title="VectoFair Chat — use the button on any audit results page" />} />
          <Route path="/audit/simulator"      element={<ComingSoon title="Simulator — use the button on any audit results page" />} />

          {/* 404 */}
          <Route path="*" element={<ComingSoon title="Page Not Found" />} />
        </Routes>
      </main>

      {/* ── Persistent Footer ─────────────────────────────────────────── */}
      <footer className="app-footer">
        <div className="footer-inner">
          <p className="footer-text">
            © 2025 VectoFair AI — Google Solution Challenge. Bias metrics computed client-side.
          </p>
          <div className="footer-badges">
            {[
              { icon: 'hub',                  label: 'Multi-Model AI'    },
              { icon: 'local_fire_department', label: 'Firebase'         },
              { icon: 'bar_chart',             label: 'Google Charts'    },
              { icon: 'gavel',                 label: 'EU AI Act Aligned' },
            ].map((b) => (
              <div key={b.label} className="footer-badge">
                <span className="material-icons-round" style={{ fontSize: 12 }}>{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* ── Android Native Bottom Navigation Bar ──────────────────────── */}
      <nav className="android-bottom-nav">
        <button
          className={`android-nav-item${isHome ? ' active' : ''}`}
          onClick={() => navigate('/')}
        >
          <span className="material-icons-round">{isHome ? 'home' : 'home'}</span>
          <span>Home</span>
        </button>
        <button
          className={`android-nav-item${isAudit ? ' active' : ''}`}
          onClick={() => navigate('/')}
        >
          <span className="material-icons-round">{isAudit ? 'analytics' : 'analytics'}</span>
          <span>Audit</span>
        </button>
        <button
          className="android-nav-item"
          onClick={() => setChatOpen(true)}
        >
          <span className="material-icons-round">smart_toy</span>
          <span>AI Chat</span>
        </button>
        <button
          className="android-nav-item"
          onClick={() => setTestPanelOpen(true)}
        >
          <span className="material-icons-round">science</span>
          <span>Tests</span>
        </button>
      </nav>

      {/* ── Global Test Panel ─────────────────────────────────────────── */}
      <TestCasePanel
        isOpen={testPanelOpen}
        onClose={() => setTestPanelOpen(false)}
        moduleId={location.pathname.replace('/audit/', '') || 'home'}
      />

      {/* ── Persistent Chat Button — visible on ALL pages ──────────── */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 900
      }}>
        {/* Simulator — only on audit pages */}
        {isAudit && (
          <button onClick={() => setSimulatorOpen(p => !p)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 18px', backgroundColor: '#1e293b', color: '#fff',
            border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer',
            fontWeight: '700', fontSize: '13px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)'
          }}>
            <span className="material-icons-round" style={{ fontSize: '18px', color: '#6366f1' }}>science</span>
            Simulate Fix
          </button>
        )}

        {/* Ask VectoFair — always visible */}
        <button onClick={() => setChatOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '13px 20px', backgroundColor: '#4f46e5', color: '#fff',
          border: 'none', borderRadius: '12px', cursor: 'pointer',
          fontWeight: '700', fontSize: '13px',
          boxShadow: '0 4px 20px rgba(79,70,229,0.5)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(79,70,229,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(79,70,229,0.5)'; }}
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>smart_toy</span>
          Ask VectoFair AI
        </button>
      </div>

      {/* Simulator inline container — audit only */}
      {isAudit && simulatorOpen && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 40px' }}>
          <DebiasingSimulator isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} auditContext={auditContext} />
        </div>
      )}

      {/* Chat — always mounted when open */}
      <VectoFairChat isOpen={chatOpen} onClose={() => setChatOpen(false)} auditContext={auditContext} />
    </>
  );
}
