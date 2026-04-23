import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ── Domain & Module Registry ──────────────────────────────────────────────────
const DOMAINS = [
  {
    id: 'HR',
    label: 'Human Resources',
    icon: 'groups',
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    description: 'Audit hiring, pay, promotion, and performance review systems for demographic bias and wage gaps.',
    tags: ['EEOC', 'Title VII', 'NY LL144'],
  },
  {
    id: 'Finance',
    label: 'Finance & Credit',
    icon: 'account_balance',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    description: 'Detect disparate impact in lending, credit scoring, insurance pricing, and fraud detection models.',
    tags: ['ECOA', 'FHA', 'CFPB'],
  },
  {
    id: 'Healthcare',
    label: 'Healthcare AI',
    icon: 'local_hospital',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
    description: 'Surface racial and gender disparities in clinical AI, triage algorithms, and hospital resource allocation.',
    tags: ['ACA §1557', 'FDA AI/ML', 'HIPAA'],
  },
  {
    id: 'Education',
    label: 'Education & EdTech',
    icon: 'school',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    description: 'Ensure fair AI in college admissions, automated grading, scholarship distribution, and adaptive learning.',
    tags: ['Title VI', 'IDEA', 'FERPA'],
  },
  {
    id: 'Justice',
    label: 'Justice & Gov.',
    icon: 'gavel',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    description: 'Audit recidivism scoring models, government benefit allocation, and digital public service access equity.',
    tags: ['14th Amendment', 'Title VI', 'ADA II'],
  },
];

const MODULES = [
  // HR
  { id: 'hiring',       route: '/audit/hiring',        title: 'General CSV Audit',             domain: 'HR',         icon: 'upload_file',      desc: 'Upload any structured dataset and run disparate impact, demographic parity, and equal opportunity analysis.', input: 'CSV Upload' },
  { id: 'resume',       route: '/audit/resume',        title: 'Resume Screening Bias',          domain: 'HR',         icon: 'description',      desc: 'Detect name-based, address-based, and credential proxy bias in resume text via multi-modal signals.', input: 'Text / PDF' },
  { id: 'pay-gap',      route: '/audit/pay-gap',       title: 'Pay Gap Analysis',               domain: 'HR',         icon: 'payments',         desc: 'Uncover unexplained compensation disparities across race, gender, and age — controlling for role and seniority.', input: 'CSV Upload' },
  { id: 'promotion',    route: '/audit/promotion',     title: 'Promotion Pipeline Fairness',    domain: 'HR',         icon: 'trending_up',      desc: 'Audit promotion velocity and pipeline leakage patterns by demographic group across seniority levels.', input: 'CSV Upload' },
  { id: 'performance',  route: '/audit/performance',   title: 'Performance Review Bias',        domain: 'HR',         icon: 'rate_review',      desc: 'Detect linguistic bias patterns and rating score gaps in performance review text and numeric assessments.', input: 'CSV Upload' },
  { id: 'compliance',   route: '/audit/compliance',    title: 'Compliance Report Generator',    domain: 'HR',         icon: 'gavel',            desc: 'Generate EEOC, OFCCP, EU AI Act, and NY Local Law 144 ready audit reports from your workforce data.', input: 'CSV Upload' },
  // Finance
  { id: 'loan',         route: '/audit/loan',          title: 'Loan Approval Audit',            domain: 'Finance',    icon: 'account_balance',  desc: 'Audit credit risk models for disparate impact by race, age, income quartile, and intersectional groups.', input: 'CSV Upload' },
  { id: 'credit-limit', route: '/audit/credit-limit',  title: 'Credit Limit Fairness',          domain: 'Finance',    icon: 'credit_card',      desc: 'Test credit limit equity across demographic groups — detect algorithmic anchoring on proxy variables.', input: 'CSV Upload' },
  { id: 'fraud',        route: '/audit/fraud',         title: 'Fraud Detection Fairness',       domain: 'Finance',    icon: 'security',         desc: 'Audit false positive rates in fraud detection models — flag disproportionate impact on minority customers.', input: 'CSV Upload' },
  { id: 'insurance',    route: '/audit/insurance',     title: 'Insurance Premium Bias',         domain: 'Finance',    icon: 'health_and_safety',desc: 'Detect premium pricing disparities against protected classes in auto, home, and health insurance models.', input: 'CSV Upload' },
  // Healthcare
  { id: 'treatment',    route: '/audit/treatment',     title: 'Treatment Recommendation Bias',  domain: 'Healthcare', icon: 'medical_services', desc: 'Analyze racial and gender bias in clinical triage algorithms and treatment recommendation systems.', input: 'CSV Upload' },
  { id: 'clinical-trial', route: '/audit/clinical-trial', title: 'Clinical Trial Diversity',   domain: 'Healthcare', icon: 'science',          desc: 'Audit demographic representation parity in clinical trial enrollment across sites and conditions.', input: 'CSV Upload' },
  { id: 'hospital',     route: '/audit/hospital',      title: 'Hospital Resource Allocation',   domain: 'Healthcare', icon: 'local_hospital',   desc: 'Check ICU admission and specialist referral disparities by race, insurance type, and zip code.', input: 'CSV Upload' },
  { id: 'diagnostics',  route: '/audit/diagnostics',   title: 'Diagnostic Model Fairness',      domain: 'Healthcare', icon: 'biotech',          desc: 'Audit medical imaging AI for performance gaps across skin tone (Fitzpatrick Scale) and patient demographics.', input: 'CSV Upload' },
  // Education
  { id: 'admissions',   route: '/audit/admissions',    title: 'Admissions Algorithm Audit',     domain: 'Education',  icon: 'school',           desc: 'Analyze merit-adjusted equity in holistic admissions — detect legacy, proxy, and zip-code bias patterns.', input: 'CSV Upload' },
  { id: 'ai-grading',   route: '/audit/ai-grading',    title: 'AI Grading Fairness',            domain: 'Education',  icon: 'grading',          desc: 'Detect automated grading bias against AAVE dialect, ESL students, and students with IEPs.', input: 'CSV Upload' },
  { id: 'scholarships', route: '/audit/scholarships',  title: 'Scholarship Bias Detector',      domain: 'Education',  icon: 'workspace_premium',desc: 'Audit scholarship selection for interview score disparities, award amount gaps, and recommendation proxy bias.', input: 'CSV Upload' },
  { id: 'learning-path',route: '/audit/learning-path', title: 'Learning Path Recommendation',   domain: 'Education',  icon: 'auto_graph',       desc: 'Test adaptive learning placement algorithms for remediation over-referral and device-as-SES proxy bias.', input: 'CSV Upload' },
  // Justice
  { id: 'recidivism',   route: '/audit/recidivism',    title: 'Recidivism Risk Score Audit',    domain: 'Justice',    icon: 'policy',           desc: 'Audit algorithmic risk scores using ProPublica methodology — FPR/FNR asymmetry and Fairness Impossibility.', input: 'CSV Upload' },
  { id: 'benefits',     route: '/audit/benefits',      title: 'Government Benefit Allocation',  domain: 'Justice',    icon: 'assured_workload', desc: 'Detect racial and language-based disparities in government benefit approval, processing time, and appeals.', input: 'CSV Upload' },
  { id: 'public-service',route: '/audit/public-service',title: 'Public Service Access Fairness',domain: 'Justice',    icon: 'admin_panel_settings',desc: 'Audit digital government service completion gaps by age, language, device type, and geographic location.', input: 'CSV Upload' },
];

// ── Domain Card — Icon 65% / Name 35% layout ────────────────────────────────
function DomainCard({ domain, moduleCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#fff',
        borderRadius: '20px',
        border: `2px solid ${hovered ? domain.color : '#e2e8f0'}`,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 20px 40px ${domain.color}22, 0 0 0 1px ${domain.color}33`
          : '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        minHeight: '220px',
      }}
    >
      {/* 65% — Icon area */}
      <div style={{
        flex: '0 0 65%',
        backgroundColor: hovered ? domain.color : domain.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.25s',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative ring */}
        <div style={{
          position: 'absolute',
          width: '120px', height: '120px',
          borderRadius: '50%',
          border: `2px solid ${hovered ? 'rgba(255,255,255,0.2)' : domain.border}`,
          transition: 'all 0.3s',
          transform: hovered ? 'scale(1.15)' : 'scale(1)',
        }} />
        <span
          className="material-icons-round"
          style={{
            fontSize: hovered ? '60px' : '52px',
            color: hovered ? '#fff' : domain.color,
            transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {domain.icon}
        </span>
        {/* Module count badge */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          backgroundColor: hovered ? 'rgba(255,255,255,0.25)' : domain.bg,
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.4)' : domain.border}`,
          color: hovered ? '#fff' : domain.color,
          fontSize: '11px',
          fontWeight: '700',
          padding: '3px 9px',
          borderRadius: '12px',
          transition: 'all 0.2s',
        }}>
          {moduleCount}
        </div>
      </div>

      {/* 35% — Name area */}
      <div style={{
        flex: '0 0 35%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 16px',
        backgroundColor: '#fff',
        gap: '4px',
      }}>
        <div style={{
          fontSize: '15px',
          fontWeight: '800',
          color: '#0f172a',
          textAlign: 'center',
          lineHeight: 1.2,
          letterSpacing: '-0.2px',
        }}>
          {domain.label}
        </div>
        <div style={{
          fontSize: '11px',
          color: hovered ? domain.color : '#94a3b8',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          transition: 'color 0.2s',
        }}>
          <span className="material-icons-round" style={{ fontSize: '12px' }}>arrow_forward</span>
          View {moduleCount} modules
        </div>
      </div>
    </div>
  );
}

// ── Module Card (Phase 2) ─────────────────────────────────────────────────────
function ModuleCard({ mod, domain, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#fff',
        borderRadius: '14px',
        border: `1px solid ${hovered ? domain.color : '#e2e8f0'}`,
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? `0 12px 28px ${domain.color}18` : '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        backgroundColor: domain.color,
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.18s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '4px' }}>
        <div style={{
          width: '44px', height: '44px', flexShrink: 0, borderRadius: '12px',
          backgroundColor: hovered ? domain.color : domain.bg,
          border: `1px solid ${hovered ? domain.color : domain.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.18s',
        }}>
          <span className="material-icons-round" style={{
            fontSize: '22px',
            color: hovered ? '#fff' : domain.color,
            transition: 'color 0.18s',
          }}>
            {mod.icon}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a', fontWeight: '700', lineHeight: 1.3 }}>
            {mod.title}
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '12px', lineHeight: '1.5' }}>{mod.desc}</p>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: '700',
        color: hovered ? domain.color : '#94a3b8',
        transition: 'color 0.18s',
      }}>
        <span className="material-icons-round" style={{ fontSize: '14px' }}>play_circle</span>
        Start Audit
        <span className="material-icons-round" style={{
          fontSize: '14px', marginLeft: 'auto',
          transform: hovered ? 'translateX(3px)' : 'translateX(0)',
          transition: 'transform 0.18s',
        }}>arrow_forward</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DomainSelector() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const activeDomain = searchParams.get('domain');

  const setActiveDomain = (id) => {
    if (id) {
      setSearchParams({ domain: id });
    } else {
      setSearchParams({});
    }
  };

  const totalModules = MODULES.length;
  const domainObj = activeDomain ? DOMAINS.find(d => d.id === activeDomain) : null;
  const domainModules = activeDomain
    ? MODULES.filter(m => m.domain === activeDomain)
    : [];

  const searchActive = search.trim().length > 1;
  const searchResults = searchActive
    ? MODULES.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.domain.toLowerCase().includes(search.toLowerCase()) ||
        m.desc.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', fontFamily: 'var(--font-sans)' }}>

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      {!activeDomain && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>

            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 44px)', color: '#0f172a',
              margin: '0 0 16px', fontWeight: '800', letterSpacing: '-0.5px', lineHeight: 1.2
            }}>
              VectoFair AI <span style={{ color: '#4f46e5' }}>Bias Audit</span> Platform
            </h1>
            <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '580px', margin: '0 auto 32px', lineHeight: 1.6 }}>
              Select a domain to explore specialized bias detection modules aligned with global regulatory standards.
            </p>

            {/* Search */}
            <div style={{ maxWidth: '460px', margin: '0 auto', position: 'relative' }}>
              <span className="material-icons-round" style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: '#94a3b8', fontSize: '20px', pointerEvents: 'none'
              }}>search</span>
              <input
                type="text"
                placeholder="Search across all 21 modules…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px',
                  border: '2px solid #e2e8f0', fontSize: '14px', color: '#0f172a',
                  outline: 'none', boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#4f46e5')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          </div>

          {/* Stats bar */}
          {!searchActive && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Audit Modules',    value: totalModules, icon: 'grid_view',    color: '#4f46e5' },
                { label: 'Domains Covered',  value: DOMAINS.length, icon: 'category',  color: '#10b981' },
                { label: 'Legal Standards',  value: '12+',        icon: 'gavel',        color: '#8b5cf6' },
                { label: 'AI Models Active', value: '6',          icon: 'hub',          color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{
                  flex: '1', minWidth: '140px', maxWidth: '200px',
                  backgroundColor: '#fff', borderRadius: '12px',
                  border: '1px solid #e2e8f0', padding: '20px',
                  textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <span className="material-icons-round" style={{ fontSize: '22px', color: s.color, display: 'block', marginBottom: '8px' }}>{s.icon}</span>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Search results ────────────────────────────── */}
          {searchActive ? (
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', fontWeight: '600' }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
              </div>
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 40px', color: '#94a3b8' }}>
                  <span className="material-icons-round" style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>search_off</span>
                  No modules match "{search}"
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {searchResults.map(mod => {
                    const dom = DOMAINS.find(d => d.id === mod.domain) || DOMAINS[0];
                    return (
                      <ModuleCard key={mod.id} mod={mod} domain={dom} onClick={() => navigate(mod.route)} />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Domain Cards Grid — Icon 65% / Name 35% ─────────────────────── */
            <>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px' }}>
                Choose a Domain
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '20px',
              }}>
                {DOMAINS.map(domain => (
                  <DomainCard
                    key={domain.id}
                    domain={domain}
                    moduleCount={MODULES.filter(m => m.domain === domain.id).length}
                    onClick={() => setActiveDomain(domain.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Domain View (Phase 2) ────────────────────────────────────── */}
      {activeDomain && domainObj && (
        <>
          {/* Back + Domain header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveDomain(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#0f172a',
                border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
                fontWeight: '600', fontSize: '13px'
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>arrow_back</span>
              All Domains
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                backgroundColor: domainObj.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-icons-round" style={{ fontSize: '24px', color: '#fff' }}>{domainObj.icon}</span>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{domainObj.label}</h1>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{domainObj.description}</p>
              </div>
            </div>
          </div>

          {/* Tags row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {domainObj.tags.map(tag => (
              <span key={tag} style={{
                fontSize: '11px', fontWeight: '700',
                padding: '4px 12px', borderRadius: '20px',
                backgroundColor: domainObj.bg, color: domainObj.color, border: `1px solid ${domainObj.border}`,
              }}>{tag}</span>
            ))}
            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-round" style={{ fontSize: '14px' }}>check_circle</span>
              {domainModules.length} modules — all live
            </span>
          </div>

          {/* Module Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {domainModules.map(mod => (
              <ModuleCard key={mod.id} mod={mod} domain={domainObj} onClick={() => navigate(mod.route)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
