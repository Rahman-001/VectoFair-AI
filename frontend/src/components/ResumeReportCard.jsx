// VectoFair — Resume Report Card Component
// Single resume detailed analysis with AI rewrite capability

import { useState } from 'react';
import { rewriteResumeForBlindScreening } from '../utils/aiClient';

const SIGNAL_ICONS = {
  NAME_BIAS: 'badge',
  ADDRESS_SIGNAL: 'home',
  HBCU_SIGNAL: 'school',
  AGE_PROXY: 'cake',
  EMPLOYMENT_GAP: 'schedule',
  GENDER_SIGNAL: 'record_voice_over',
  SOCIOECONOMIC_SIGNAL: 'account_balance_wallet',
  NATIONAL_ORIGIN_SIGNAL: 'public',
  VISA_STATUS_SIGNAL: 'flight',
  DISABILITY_SIGNAL: 'accessibility',
};

const SIGNAL_LABELS = {
  NAME_BIAS: 'Name-Based Bias',
  ADDRESS_SIGNAL: 'Address Signal',
  HBCU_SIGNAL: 'HBCU Institution',
  AGE_PROXY: 'Age Proxy (ADEA)',
  EMPLOYMENT_GAP: 'Employment Gap',
  GENDER_SIGNAL: 'Gender Signal',
  SOCIOECONOMIC_SIGNAL: 'Socioeconomic Signal',
  NATIONAL_ORIGIN_SIGNAL: 'National Origin',
  VISA_STATUS_SIGNAL: 'Visa/Auth Status',
  DISABILITY_SIGNAL: 'Disability Disclosure',
};

function SeverityBadge({ severity }) {
  const cfg = {
    HIGH:   { color: '#dc2626', bg: '#fef2f2', label: 'HIGH RISK' },
    MEDIUM: { color: '#d97706', bg: '#fffbeb', label: 'MEDIUM RISK' },
    LOW:    { color: '#2563eb', bg: '#eff6ff', label: 'LOW RISK' },
  }[severity] || { color: '#64748b', bg: '#f1f5f9', label: severity };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function SignalCard({ signal, idx }) {
  const [expanded, setExpanded] = useState(false);
  const icon = SIGNAL_ICONS[signal.type] || 'warning';
  const label = SIGNAL_LABELS[signal.type] || signal.type;

  const sevColor = {
    HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#2563eb',
  }[signal.severity] || '#64748b';

  return (
    <div
      className="signal-card"
      style={{ borderLeft: `3px solid ${sevColor}` }}
    >
      <div className="signal-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="signal-card-left">
          <div className="signal-icon" style={{ background: `${sevColor}18`, color: sevColor }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>{icon}</span>
          </div>
          <div>
            <div className="signal-label">{label}</div>
            <div className="signal-excerpt">"{signal.excerpt}"</div>
          </div>
        </div>
        <div className="signal-card-right">
          <SeverityBadge severity={signal.severity} />
          <span className="material-icons-round" style={{ fontSize: 18, color: '#94a3b8', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </div>
      </div>

      {expanded && (
        <div className="signal-card-body">
          <div className="signal-detail-row">
            <span className="material-icons-round" style={{ fontSize: 14, color: '#64748b' }}>info</span>
            <div>
              <div className="signal-detail-label">Explanation</div>
              <div className="signal-detail-text">{signal.explanation}</div>
            </div>
          </div>
          <div className="signal-detail-row">
            <span className="material-icons-round" style={{ fontSize: 14, color: '#4338ca' }}>gavel</span>
            <div>
              <div className="signal-detail-label">Legal Basis</div>
              <div className="signal-detail-text signal-legal">{signal.legalBasis}</div>
            </div>
          </div>
          <div className="signal-detail-row">
            <span className="material-icons-round" style={{ fontSize: 14, color: '#16a34a' }}>build</span>
            <div>
              <div className="signal-detail-label">Recommendation</div>
              <div className="signal-detail-text">{signal.recommendation}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bias Gauge (inline SVG) ───────────────────────────────────────────────────
function BiasGauge({ score }) {
  const pct  = Math.min(100, Math.max(0, score));
  const color = pct >= 60 ? '#dc2626' : pct >= 35 ? '#d97706' : '#16a34a';
  const circumference = 2 * Math.PI * 36;
  const dashoffset = circumference * (1 - pct / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="36" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="20" fontWeight="800" fill={color} fontFamily="inherit">{pct}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="inherit">/ 100</text>
      </svg>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        Bias Vulnerability
      </div>
    </div>
  );
}

// ── AI Rewriter Modal ─────────────────────────────────────────────────────────
function RewriteModal({ resumeText, signals, onClose }) {
  const [rewriting, setRewriting]     = useState(false);
  const [rewritten, setRewritten]     = useState('');
  const [rewriteSource, setRewriteSource] = useState('');
  const [copied, setCopied]           = useState(false);

  async function handleRewrite() {
    setRewriting(true);
    try {
      const result = await rewriteResumeForBlindScreening(resumeText, signals);
      setRewritten(result.rewrittenText);
      setRewriteSource(result.source);
    } catch (err) {
      setRewritten('Error generating rewrite: ' + err.message);
    } finally {
      setRewriting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(rewritten).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([rewritten], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'resume-blind-screened.txt' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="material-icons-round" style={{ color: '#4338ca', fontSize: 22 }}>auto_fix_high</span>
            <h3>AI Bias Rewriter</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="rewrite-info">
            <span className="material-icons-round" style={{ fontSize: 16, color: '#2563eb' }}>info</span>
            <p>
              VectoFair AI will anonymize this resume for blind screening — removing name, address, graduation years,
              and other identity signals while preserving all qualifications, experience, and skills intact.
            </p>
          </div>

          {!rewritten && (
            <div className="rewrite-signals-preview">
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                Signals to be removed ({signals?.length || 0}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(signals || []).slice(0, 6).map((s, i) => (
                  <span key={i} className="chip" style={{ fontSize: 11.5 }}>
                    {SIGNAL_LABELS[s.type] || s.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!rewritten && !rewriting && (
            <button className="btn btn-primary" onClick={handleRewrite} style={{ width: '100%', justifyContent: 'center' }}>
              <span className="material-icons-round">auto_fix_high</span>
              Generate Bias-Free Version
            </button>
          )}

          {rewriting && (
            <div className="rewrite-loading">
              <div className="analysis-spinner" />
              <span>AI is neutralizing bias signals while preserving qualifications…</span>
            </div>
          )}

          {rewritten && (
            <div className="rewrite-result">
              <div className="rewrite-result-header">
                <div className="rewrite-result-badge">
                  <span className="material-icons-round" style={{ fontSize: 14, color: '#16a34a' }}>check_circle</span>
                  Bias-Free Version Ready
                  {rewriteSource === 'fallback' && <span style={{ fontSize: 10.5 }}> (offline mode)</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleCopy}>
                    <span className="material-icons-round" style={{ fontSize: 15 }}>{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleDownload}>
                    <span className="material-icons-round" style={{ fontSize: 15 }}>download</span>
                    Download .txt
                  </button>
                </div>
              </div>
              <pre className="rewrite-text">{rewritten}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ResumeReportCard ─────────────────────────────────────────────────────
export default function ResumeReportCard({ resume, index, defaultExpanded = false }) {
  const [expanded,     setExpanded]     = useState(defaultExpanded);
  const [anonymized,   setAnonymized]   = useState(false);
  const [showRewriter, setShowRewriter] = useState(false);

  const score    = resume.biasVulnerabilityScore ?? 0;
  const risk     = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  const riskColor = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' }[risk];
  const riskBg   = { HIGH: '#fef2f2', MEDIUM: '#fffbeb', LOW: '#f0fdf4' }[risk];

  const displayName = anonymized
    ? `Candidate ${String.fromCharCode(65 + index)}`
    : (resume.candidateName || `Resume ${index + 1}`);

  const aiAnalysis = resume.aiAnalysis;
  const signals    = resume.signals || [];

  return (
    <>
      <div className={`resume-report-card ${resume.isPairA ? 'pair-a-glow' : resume.isPairB ? 'pair-b-glow' : ''}`}>
        {/* Card header — always visible */}
        <div className="rrc-header" onClick={() => setExpanded(!expanded)}>
          <div className="rrc-header-left">
            <div
              className="rrc-rank-badge"
              style={{ background: riskBg, color: riskColor, border: `1.5px solid ${riskColor}30` }}
            >
              #{index + 1}
            </div>
            <div>
              <div className="rrc-name">
                {displayName}
                {resume.isPairA && <span className="pair-tag pair-tag-a">Pair A</span>}
                {resume.isPairB && <span className="pair-tag pair-tag-b">Pair B</span>}
              </div>
              <div className="rrc-meta">
                <span>{resume.nameCategory || 'Unknown'} name</span>
                <span>·</span>
                <span>{signals.length} signal{signals.length !== 1 ? 's' : ''} detected</span>
              </div>
            </div>
          </div>

          <div className="rrc-header-right">
            <div className="rrc-score-chip" style={{ background: riskBg, color: riskColor }}>
              <span className="rrc-score-num">{score}</span>
              <span className="rrc-score-label">Bias Score</span>
            </div>
            <div className="rrc-risk-badge" style={{ background: riskBg, color: riskColor }}>
              <span className="material-icons-round" style={{ fontSize: 13 }}>
                {risk === 'HIGH' ? 'warning' : risk === 'MEDIUM' ? 'info' : 'check_circle'}
              </span>
              {risk}
            </div>
            <span
              className="material-icons-round"
              style={{ fontSize: 20, color: '#94a3b8', transition: 'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              expand_more
            </span>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="rrc-body">
            {/* Top row: gauge + AI summary */}
            <div className="rrc-top-row">
              <BiasGauge score={score} />

              <div className="rrc-summary-block">
                <div className="rrc-summary-actions">
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => setAnonymized(!anonymized)}
                  >
                    <span className="material-icons-round" style={{ fontSize: 15 }}>{anonymized ? 'visibility' : 'visibility_off'}</span>
                    {anonymized ? 'Show Name' : 'Anonymize'}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => setShowRewriter(true)}
                  >
                    <span className="material-icons-round" style={{ fontSize: 15 }}>auto_fix_high</span>
                    AI Rewrite (Bias-Free)
                  </button>
                </div>

                {aiAnalysis?.overallSummary && (
                  <div className="rrc-ai-summary">
                    <div className="rrc-ai-label">
                      <span className="material-icons-round" style={{ fontSize: 13, color: '#4338ca' }}>hub</span>
                      Multi-Model AI Summary
                    </div>
                    <p>{aiAnalysis.overallSummary}</p>
                  </div>
                )}

                {aiAnalysis?.legalRisks && aiAnalysis.legalRisks.length > 0 && (
                  <div className="rrc-legal-risks">
                    <div className="rrc-legal-label">
                      <span className="material-icons-round" style={{ fontSize: 13, color: '#dc2626' }}>gavel</span>
                      Legal Risk Flags
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {aiAnalysis.legalRisks.map((r, i) => (
                        <span key={i} className="chip" style={{ fontSize: 11, borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626', background: '#fef2f2' }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Signals */}
            {signals.length > 0 && (
              <div className="rrc-signals-section">
                <div className="rrc-section-label">
                  <span className="material-icons-round" style={{ fontSize: 15, color: '#4338ca' }}>radar</span>
                  Detected Bias Signals ({signals.length})
                </div>
                <div className="rrc-signals-list">
                  {signals.map((signal, i) => (
                    <SignalCard key={i} signal={signal} idx={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Blind screening recommendations */}
            {aiAnalysis?.blindScreeningRecommendations && (
              <div className="rrc-blind-recs">
                <div className="rrc-section-label">
                  <span className="material-icons-round" style={{ fontSize: 15, color: '#16a34a' }}>visibility_off</span>
                  Blind Screening Recommendations
                </div>
                <ul className="blind-recs-list">
                  {aiAnalysis.blindScreeningRecommendations.map((rec, i) => (
                    <li key={i} className="blind-rec-item">
                      <span className="material-icons-round" style={{ fontSize: 14, color: '#16a34a' }}>check</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {showRewriter && (
        <RewriteModal
          resumeText={resume.originalText || ''}
          signals={signals}
          onClose={() => setShowRewriter(false)}
        />
      )}
    </>
  );
}
