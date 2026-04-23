import { useState, useEffect } from 'react';

// ── Difficulty badge config ────────────────────────────────────────────────────
const DIFF = {
  ready:    { label: 'Ready to use',  color: '#16a34a', bg: '#f0fdf4', border: 'rgba(22,163,74,0.2)'   },
  medium:   { label: 'Medium effort', color: '#d97706', bg: '#fffbeb', border: 'rgba(217,119,6,0.2)'   },
  advanced: { label: 'Advanced',      color: '#dc2626', bg: '#fef2f2', border: 'rgba(220,38,38,0.2)'   },
  high:     { label: 'High impact',   color: '#2563eb', bg: '#eff6ff', border: 'rgba(37,99,235,0.2)'   },
};

// ── All category + use-case data ──────────────────────────────────────────────
export const CATEGORIES = [
  {
    id: 'general', icon: 'analytics',
    label: 'General CSV Audit',
    tagline: 'Your own dataset — any domain',
    color: '#4338ca', border: 'rgba(67,56,202,0.2)',
    isPinned: true,
    description: 'The General CSV Audit is your all-purpose fairness scanner. Upload any structured dataset with a binary outcome column and demographic attributes — VectoFair handles the rest. It auto-detects relevant columns, applies all three gold-standard fairness metrics (Demographic Parity, Equal Opportunity, and Disparate Impact), and delivers a plain-English audit report instantly. No domain expertise or configuration required.',
    useCases: [
      {
        id: 'csv-audit', icon: 'table_chart',
        title: 'Universal CSV Bias Auditor',
        desc: 'Upload any CSV with a binary outcome column and demographic attributes. VectoFair auto-detects columns and runs all three fairness metrics — no configuration needed.',
        diff: 'ready', action: 'launch',
      },
    ],
  },
  {
    id: 'hr', icon: 'groups',
    label: 'HR & Recruitment',
    tagline: 'From résumés to pay gaps',
    color: '#2563eb', border: 'rgba(37,99,235,0.2)',
    description: 'Hiring decisions shape careers and livelihoods — and they are among the highest-risk areas for algorithmic bias. The HR & Recruitment domain audits every stage of the talent pipeline: candidate shortlisting, salary benchmarking, promotion rates, and performance appraisals. Detect whether name, zip code, gender, or ethnicity is silently influencing your workforce outcomes, and generate compliance-ready reports for EEOC and pay-transparency regulations.',
    useCases: [
      { id:'resume',    icon:'description',  title:'Resume Screening Bias Detector', desc:'Upload resume files or paste text to detect hidden bias signals — name, address, university, age, gender, disability, and more — before screening begins.',                   diff:'ready',   action:'launch' },
      { id:'pay-gap',   icon:'attach_money',        title:'Pay Gap Analysis',               desc:'Upload payroll CSV — VectoFair identifies unexplained salary gaps by gender, ethnicity, or age across departments.',                 diff:'ready',   action:'soon' },
      { id:'promotion', icon:'trending_up',     title:'Promotion Pipeline Fairness',    desc:'Track promotion rates by demographic group over time and flag statistically unequal advancement paths.',                            diff:'medium',  action:'soon' },
      { id:'perf',      icon:'star',title:'Performance Review Bias',       desc:'Detect if manager ratings correlate with demographic attributes rather than actual output KPIs.',                                   diff:'medium',  action:'soon' },
      { id:'compliance',icon:'gavel',           title:'Compliance Report Generator',    desc:'Auto-generate EEOC/pay-transparency compliance reports from audit results — downloadable PDF per quarter.',                        diff:'ready',   action:'soon' },
    ],
  },
  {
    id: 'banking', icon: 'account_balance',
    label: 'Banking & Finance',
    tagline: 'Loans, credit, fraud & insurance',
    color: '#059669', border: 'rgba(5,150,105,0.2)',
    description: 'Financial algorithms control access to credit, insurance, and economic opportunity. Yet studies show they can systematically disadvantage minority borrowers and low-income communities. The Banking & Finance domain audits loan approval models, credit scoring systems, fraud detection flags, and insurance premiums for disparate impact across protected demographic groups — helping institutions meet Fair Lending Act requirements and rebuild community trust.',
    useCases: [
      { id:'loan',      icon:'account_balance',title:'Loan Approval Bias Audit',  desc:'Detect if zip code, name, or race proxies are affecting credit decisions — the classic fairness use case.',          diff:'ready',   action:'soon' },
      { id:'credit',    icon:'credit_card',     title:'Credit Limit Fairness',     desc:'Analyze whether credit limits are influenced by protected attributes beyond objective risk scores.',                  diff:'medium',  action:'soon' },
      { id:'fraud',     icon:'security',         title:'Fraud Flag Disparity',      desc:'Check if fraud detection algorithms flag transactions from certain demographic groups at disproportionate rates.',    diff:'advanced',action:'soon' },
      { id:'insurance', icon:'shield',           title:'Insurance Premium Bias',    desc:'Upload actuarial datasets and detect whether premium calculations use proxies encoding protected characteristics.',  diff:'advanced',action:'soon' },
    ],
  },
  {
    id: 'healthcare', icon: 'health_and_safety',
    label: 'Healthcare & Medicine',
    tagline: 'Clinical AI, diagnostics & trials',
    color: '#dc2626', border: 'rgba(220,38,38,0.2)',
    description: 'In healthcare, biased algorithms can mean delayed diagnoses, unequal treatment recommendations, and lives at risk. The Healthcare & Medicine domain audits clinical AI systems, diagnostic models, trial enrollment data, and hospital resource allocation for demographic disparities. Whether you are evaluating an imaging AI across skin tones or checking if ICU referral rates differ by patient race, VectoFair gives you the statistical evidence you need.',
    useCases: [
      { id:'treatment', icon:'healing',      title:'Treatment Recommendation Bias',  desc:'Detect if clinical AI systems recommend different treatment pathways based on patient race, gender, or insurance type.',           diff:'advanced',action:'soon' },
      { id:'trials',    icon:'science',       title:'Clinical Trial Diversity Audit', desc:"Analyze trial enrollment data and flag when participant demographics don't represent the target patient population.",              diff:'medium',  action:'soon' },
      { id:'hospital',  icon:'local_hospital',title:'Hospital Resource Allocation',   desc:'Check if ICU beds, specialist referrals, or discharge decisions differ across patient demographic groups.',                        diff:'advanced',action:'soon' },
      { id:'diagnostic',icon:'biotech',       title:'Diagnostic Model Fairness',      desc:'Audit AI diagnostic accuracy across skin tones, ages, and genders — critical for imaging AI models.',                             diff:'advanced',action:'soon' },
    ],
  },
  {
    id: 'education', icon: 'school',
    label: 'Education',
    tagline: 'Admissions, grading & scholarships',
    color: '#7c3aed', border: 'rgba(124,58,237,0.2)',
    description: 'Education is the engine of social mobility — and AI is increasingly shaping who gains access to it. The Education domain audits admissions algorithms, automated grading systems, scholarship awards, and personalized learning recommendations. Detect if race, zip code, or parental education quietly shapes acceptance rates or content quality. VectoFair helps institutions ensure that AI-driven decisions open doors rather than close them.',
    useCases: [
      { id:'admissions', icon:'school',     title:'Admissions Algorithm Audit',        desc:'Upload college/school admissions data and detect if race, zip code, or parent education influence acceptance rates.',         diff:'ready',  action:'soon' },
      { id:'grading',    icon:'check_circle',     title:'AI Grading Fairness',               desc:'Check if automated essay scoring or test grading systems perform differently across student demographic groups.',             diff:'medium', action:'soon' },
      { id:'scholarship',icon:'card_giftcard',          title:'Scholarship Bias Detector',         desc:'Analyze scholarship award patterns to identify if selection criteria inadvertently favor certain demographic groups.',         diff:'ready',  action:'soon' },
      { id:'learning',   icon:'menu_book',      title:'Learning Path Recommendation Bias', desc:'Detect if EdTech personalization engines recommend different quality content based on student demographics.',                 diff:'medium', action:'soon' },
    ],
  },
  {
    id: 'justice', icon: 'balance',
    label: 'Criminal Justice & Gov.',
    tagline: 'Risk scores, benefits & public services',
    color: '#d97706', border: 'rgba(217,119,6,0.2)',
    description: 'Government algorithms make consequential decisions about bail, parole, welfare eligibility, and public service access. Systems like COMPAS have been shown to produce racially disparate risk scores. The Criminal Justice & Government domain audits these high-stakes models for demographic bias, helping public agencies deliver fair, equitable, and transparent outcomes for all citizens — and providing evidence for policy reform where disparities exist.',
    useCases: [
      { id:'recidivism', icon:'history',      title:'Recidivism Model Audit (COMPAS)', desc:'Audit risk scoring tools that predict reoffending — the most famous AI bias case in public policy.',                         diff:'high',   action:'soon' },
      { id:'benefits',   icon:'account_balance_wallet',title:'Government Benefit Allocation',   desc:'Detect if automated welfare, housing, or benefit eligibility decisions treat demographic groups unequally.',                  diff:'medium', action:'soon' },
      { id:'public-svc', icon:'public',       title:'Public Service Access Fairness', desc:'Analyze whether government digital services have unequal approval rates across citizen demographic groups.',                   diff:'medium', action:'soon' },
    ],
  },
];

// ── Difficulty badge ───────────────────────────────────────────────────────────
function DiffBadge({ diff }) {
  const d = DIFF[diff] || DIFF.ready;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 4,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
      color: d.color, background: d.bg, border: `1px solid ${d.border}`,
      whiteSpace: 'nowrap',
    }}>
      {d.label}
    </span>
  );
}

// ── Single large domain card (white, icon 65%) ─────────────────────────────────
function DomainCard({ cat, idx, onClick }) {
  return (
    <button
      className={`domain-card ${cat.isPinned ? 'domain-card-pinned' : ''}`}
      onClick={onClick}
      id={`cat-${cat.id}`}
      style={{ animationDelay: `${idx * 0.07}s` }}
    >
      {/* Icon section — 65% of card */}
      <div className="domain-card-icon-area">
        {cat.isPinned && (
          <span className="domain-card-pinned-badge">
            <span className="material-icons-round" style={{ fontSize: 11 }}>star</span>
            Live Now
          </span>
        )}
        <span className="domain-card-emoji material-icons-round" style={{ color: cat.color }}>{cat.icon}</span>
      </div>

      {/* Text section — 35% of card */}
      <div className="domain-card-body">
        <div className="domain-card-label">{cat.label}</div>
        <div className="domain-card-tagline">{cat.tagline}</div>
        <div className="domain-card-status">
          {cat.isPinned
            ? <span className="status-live"><span className="status-dot" />Live &amp; Ready</span>
            : <span className="status-wip">🚧 In Development</span>
          }
        </div>
      </div>
    </button>
  );
}

// ── Domain detail page ─────────────────────────────────────────────────────────
function DomainDetailPage({ cat, onBack, onLaunch }) {
  function handleLaunch(uc) {
    if (uc.action !== 'launch') return;
    onLaunch({ category: cat.label, useCaseId: uc.id, useCaseTitle: uc.title, categoryId: cat.id });
  }

  const liveCount = cat.useCases.filter(u => u.action === 'launch').length;

  return (
    <div className="domain-detail-page">

      {/* ── Back button ── */}
      <button className="domain-back-btn" onClick={onBack}>
        <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_back</span>
        All Domains
      </button>

      {/* ── Domain hero header ── */}
      <div className="domain-detail-hero">
        <div className="domain-detail-icon-wrap">
          <span className="material-icons-round" style={{ fontSize: 52, lineHeight: 1, color: cat.color }}>{cat.icon}</span>
        </div>
        <div className="domain-detail-hero-text">
          <div className="domain-detail-meta">
            {cat.isPinned
              ? <span className="status-live"><span className="status-dot" />Live &amp; Ready</span>
              : <span className="status-wip">🚧 In Development</span>
            }
            <span className="cat-count-chip">{cat.useCases.length} use cases</span>
          </div>
          <h2 className="domain-detail-title">{cat.label}</h2>
          <p className="domain-detail-tagline">{cat.tagline}</p>
        </div>
      </div>

      {/* ── Domain description ── */}
      <div className="domain-description-card">
        <div className="domain-description-label">
          <span className="material-icons-round" style={{ fontSize: 14 }}>info</span>
          About this domain
        </div>
        <p className="domain-description-text">{cat.description}</p>
      </div>

      {/* ── Use cases heading ── */}
      <div className="uc-section-heading">
        <h3 className="uc-section-title">Available Use Cases</h3>
        <p className="uc-section-sub">
          {liveCount > 0
            ? `${liveCount} ready to launch · ${cat.useCases.length - liveCount} in development`
            : `All ${cat.useCases.length} use cases coming soon — we're working hard on them`
          }
        </p>
      </div>

      {/* ── Use-case cards ── */}
      <div className="uc-grid">
        {cat.useCases.map((uc, i) => {
          const isSoon = uc.action !== 'launch';
          return (
            <div
              key={uc.id}
              className={`uc-card ${isSoon ? 'uc-soon' : 'uc-ready'}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="uc-card-top">
                <span className="uc-card-emoji material-icons-round" style={{ color: cat.color }}>{uc.icon}</span>
                <DiffBadge diff={uc.diff} />
              </div>
              <h4 className="uc-card-title">{uc.title}</h4>
              <p className="uc-card-desc">{uc.desc}</p>
              <button
                className={`uc-btn ${isSoon ? 'uc-btn-soon' : 'uc-btn-go'}`}
                onClick={() => handleLaunch(uc)}
                disabled={isSoon}
              >
                {isSoon ? (
                  <>
                    <span className="material-icons-round" style={{ fontSize: 14 }}>hourglass_empty</span>
                    Coming Soon
                  </>
                ) : (
                  <>
                    <span className="material-icons-round" style={{ fontSize: 14 }}>bolt</span>
                    Launch Audit →
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main HomeScreen ────────────────────────────────────────────────────────────
export default function HomeScreen({ onLaunch }) {
  const [selectedDomain, setSelectedDomain] = useState(null);

  // Sync state from hash on mount and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#domain-')) {
        const id = hash.replace('#domain-', '');
        const cat = CATEGORIES.find(c => c.id === id);
        setSelectedDomain(cat || null);
      } else {
        setSelectedDomain(null);
      }
    };

    // Run once on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when a domain is selected manually
  const selectDomain = (cat) => {
    if (cat) {
      window.location.hash = `domain-${cat.id}`;
    } else {
      // clear the hash cleanly without scrolling
      window.history.pushState('', document.title, window.location.pathname + window.location.search);
      setSelectedDomain(null);
    }
  };

  const totalUC = CATEGORIES.reduce((s, c) => s + c.useCases.length, 0);

  // ── If a domain is selected, show detail page ──
  if (selectedDomain) {
    return (
      <DomainDetailPage
        cat={selectedDomain}
        onBack={() => selectDomain(null)}
        onLaunch={onLaunch}
      />
    );
  }

  // ── Home grid ──
  return (
    <div className="home-page">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-eyebrow">
          <span className="material-icons-round" style={{ fontSize: 13 }}>hub</span>
          Bias Audit Platform
        </div>
        <h1 className="home-title">
          Choose Your <span className="highlight">Bias Test</span>
        </h1>
        <p className="home-subtitle">
          Select a domain below to explore available fairness audits. Each uses rigorous statistical metrics — Demographic Parity, Equal Opportunity &amp; Disparate Impact.
        </p>

        {/* Stats */}
        <div className="home-stats-row">
          <div className="home-stat">
            <span className="home-stat-n">{CATEGORIES.length}</span>
            <span className="home-stat-l">Domains</span>
          </div>
          <div className="home-stat-div" />
          <div className="home-stat">
            <span className="home-stat-n">{totalUC}</span>
            <span className="home-stat-l">Use Cases</span>
          </div>
          <div className="home-stat-div" />
          <div className="home-stat">
            <span className="home-stat-n" style={{ color: '#d97706' }}>🚧</span>
            <span className="home-stat-l">Building More</span>
          </div>
        </div>
      </div>

      {/* ── Domain Cards Grid ── */}
      <div className="domain-grid">
        {CATEGORIES.map((cat, idx) => (
          <DomainCard
            key={cat.id}
            cat={cat}
            idx={idx}
            onClick={() => selectDomain(cat)}
          />
        ))}
      </div>

      {/* Build notice */}
      <div className="build-notice">
        <span className="material-icons-round" style={{ fontSize: 16, color: '#d97706' }}>construction</span>
        <span>We are actively building more domains and use cases — check back soon for updates.</span>
      </div>
    </div>
  );
}
