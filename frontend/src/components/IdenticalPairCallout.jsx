// VectoFair — Identical Pair Callout Component
// The most dramatic demo moment — side-by-side Bertrand effect visualization

import { useState } from 'react';

export default function IdenticalPairCallout({ pairA, pairB, onViewResume }) {
  const [revealed, setRevealed] = useState(false);

  if (!pairA || !pairB) return null;

  const scoreA = pairA.biasVulnerabilityScore ?? pairA.aiAnalysis?.biasScore ?? 19;
  const scoreB = pairB.biasVulnerabilityScore ?? pairB.aiAnalysis?.biasScore ?? 72;

  return (
    <div className="identical-pair-callout">
      {/* Banner */}
      <div className="pair-banner">
        <div className="pair-banner-left">
          <span className="material-icons-round" style={{ fontSize: 20 }}>science</span>
          <div>
            <div className="pair-banner-title">Identical Qualification Pair — Bertrand &amp; Mullainathan Effect</div>
            <div className="pair-banner-sub">
              These two resumes have identical education, experience, skills, and GPA.
              The only difference is the candidate's name.
            </div>
          </div>
        </div>
        <div className="pair-banner-badge">
          <span className="material-icons-round" style={{ fontSize: 13 }}>auto_awesome</span>
          Judge Demo
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="pair-cards">
        {/* Card A — Anglo (LOW) */}
        <div className="pair-card pair-card-low">
          <div className="pair-card-header">
            <div className="pair-risk-badge pair-risk-low">
              <span className="material-icons-round" style={{ fontSize: 14 }}>check_circle</span>
              LOW RISK
            </div>
            <div className="pair-score-circle pair-score-low">{scoreA}</div>
          </div>
          <div className="pair-card-name">
            {pairA.candidateName || 'Brendan Kelly'}
          </div>
          <div className="pair-card-category">Anglo-sounding name</div>
          <div className="pair-card-quals">
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>school</span> Boston College, GPA 3.6</div>
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>work</span> 4 years Business Analysis</div>
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>stars</span> Tableau + SQL Certified</div>
          </div>
          <div className="pair-outcome pair-outcome-good">
            <span className="material-icons-round" style={{ fontSize: 15 }}>thumb_up</span>
            Biased screener: SHORTLISTED
          </div>
          <button className="pair-view-btn pair-view-low" onClick={() => onViewResume && onViewResume(pairA)}>
            View Full Report
          </button>
        </div>

        {/* VS Divider */}
        <div className="pair-vs-divider">
          <div className="pair-vs-line" />
          <div className="pair-vs-circle">VS</div>
          <div className="pair-vs-line" />
          <div className="pair-vs-insight">
            <div className="pair-vs-delta">+{scoreB - scoreA}</div>
            <div className="pair-vs-label">bias score gap</div>
          </div>
          <div className="pair-vs-reveal" onClick={() => setRevealed(!revealed)}>
            {revealed ? 'Hide' : 'Show'} study
          </div>
        </div>

        {/* Card B — African-American (HIGH) */}
        <div className="pair-card pair-card-high">
          <div className="pair-card-header">
            <div className="pair-risk-badge pair-risk-high">
              <span className="material-icons-round" style={{ fontSize: 14 }}>warning</span>
              HIGH RISK
            </div>
            <div className="pair-score-circle pair-score-high">{scoreB}</div>
          </div>
          <div className="pair-card-name">
            {pairB.candidateName || 'Darnell Jackson'}
          </div>
          <div className="pair-card-category">African-American sounding name</div>
          <div className="pair-card-quals">
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>school</span> Boston College, GPA 3.6</div>
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>work</span> 4 years Business Analysis</div>
            <div className="qual-item"><span className="material-icons-round" style={{ fontSize: 13 }}>stars</span> Tableau + SQL Certified</div>
          </div>
          <div className="pair-outcome pair-outcome-bad">
            <span className="material-icons-round" style={{ fontSize: 15 }}>thumb_down</span>
            Biased screener: REJECTED
          </div>
          <button className="pair-view-btn pair-view-high" onClick={() => onViewResume && onViewResume(pairB)}>
            View Full Report
          </button>
        </div>
      </div>

      {/* Bottom callout */}
      <div className="pair-bottom-callout">
        <span className="material-icons-round" style={{ color: '#dc2626', fontSize: 18 }}>error</span>
        <strong>Same qualifications. Different outcome.</strong>
        <span>A biased screener would shortlist Resume 19 and reject Resume 20 based solely on the candidate's name.</span>
      </div>

      {/* Study reveal */}
      {revealed && (
        <div className="pair-study-box">
          <div className="pair-study-header">
            <span className="material-icons-round" style={{ fontSize: 16 }}>menu_book</span>
            Research Basis: Bertrand &amp; Mullainathan (2004)
          </div>
          <p>
            "Are Emily and Greg More Employable than Lakisha and Jamal?" — Researchers sent 5,000 identical resumes to 1,300 job ads,
            varying only the candidate's name. White-sounding names received <strong>50% more callbacks</strong> than Black-sounding names
            on identical resumes. This effect held across all industries, job levels, and company sizes.
          </p>
          <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Source: Bertrand, M., &amp; Mullainathan, S. (2004). Are Emily and Greg More Employable than Lakisha and Jamal?
            A Field Experiment on Labor Market Discrimination. <em>American Economic Review, 94(4)</em>, 991–1013.
          </p>
        </div>
      )}
    </div>
  );
}
