import { useEffect, useRef, useState } from 'react';
import BiasCard from './BiasCard';
import { downloadAuditPDF } from '../utils/pdfGenerator';

// ── Beautiful SVG Fairness Gauge ─────────────────────────────────────────────
function GaugeChart({ score }) {
  const [displayed, setDisplayed] = useState(0);

  // Animate needle from 0 → score on mount
  useEffect(() => {
    let start = null;
    const duration = 1400;
    const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplayed(Math.round(ease(progress) * score));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [score]);

  // SVG arc helpers
  const cx = 110, cy = 110, r = 82;
  const startAngle = -210; // degrees
  const totalArc   = 240;  // degrees total sweep

  function polarToXY(deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(fromDeg, toDeg, radius = r) {
    const f = polarToXY(fromDeg);
    const t = polarToXY(toDeg);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${cx + radius * Math.cos(fromDeg * Math.PI / 180)} ${cy + radius * Math.sin(fromDeg * Math.PI / 180)} A ${radius} ${radius} 0 ${large} 1 ${cx + radius * Math.cos(toDeg * Math.PI / 180)} ${cy + radius * Math.sin(toDeg * Math.PI / 180)}`;
  }

  // Colour zones: red 0–40, amber 40–70, green 70–100
  const zones = [
    { from: 0,  to: 40,  color: '#ef4444' },
    { from: 40, to: 70,  color: '#f59e0b' },
    { from: 70, to: 100, color: '#22c55e' },
  ];

  function zoneArc(fromVal, toVal, color) {
    const fDeg = startAngle + (fromVal / 100) * totalArc;
    const tDeg = startAngle + (toVal  / 100) * totalArc;
    return <path key={color} d={arcPath(fDeg, tDeg, r)} stroke={color} strokeWidth="14" fill="none" strokeLinecap="butt" opacity="0.85" />;
  }

  // Needle
  const needleDeg = startAngle + (displayed / 100) * totalArc;
  const needleRad = (needleDeg * Math.PI) / 180;
  const needleLen = 68;
  const needleTailLen = 14;
  const nx  = cx + needleLen * Math.cos(needleRad);
  const ny  = cy + needleLen * Math.sin(needleRad);
  const ntx = cx - needleTailLen * Math.cos(needleRad);
  const nty = cy - needleTailLen * Math.sin(needleRad);

  // Active zone colour for needle
  const needleColor = displayed < 40 ? '#ef4444' : displayed < 70 ? '#f59e0b' : '#22c55e';

  // Tick marks
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10); // 0 10 20 … 100
  function tickCoords(val, innerR, outerR) {
    const deg = startAngle + (val / 100) * totalArc;
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx + innerR * Math.cos(rad), y1: cy + innerR * Math.sin(rad),
      x2: cx + outerR * Math.cos(rad), y2: cy + outerR * Math.sin(rad),
    };
  }

  return (
    <div id="fairness-gauge" className="score-gauge-container svg-gauge-wrap">
      <svg viewBox="0 0 220 145" width="220" height="145" style={{ overflow: 'visible' }}>
        {/* Track background */}
        <path d={arcPath(startAngle, startAngle + totalArc)} stroke="#e2e8f0" strokeWidth="14" fill="none" strokeLinecap="butt" />

        {/* Colour zone arcs */}
        {zones.map((z) => zoneArc(z.from, z.to, z.color))}

        {/* Tick marks */}
        {ticks.map((v) => {
          const major = v % 20 === 0;
          const t = tickCoords(v, major ? r - 20 : r - 14, r - 7);
          return (
            <line key={v} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="#94a3b8" strokeWidth={major ? 2 : 1} strokeLinecap="round" />
          );
        })}

        {/* Labels: 0, 50, 100 */}
        {[
          { val: 0,   label: '0'   },
          { val: 50,  label: '50'  },
          { val: 100, label: '100' },
        ].map(({ val, label }) => {
          const deg = startAngle + (val / 100) * totalArc;
          const rad = (deg * Math.PI) / 180;
          const lx  = cx + (r - 30) * Math.cos(rad);
          const ly  = cy + (r - 30) * Math.sin(rad);
          return (
            <text key={label} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              fontSize="9" fill="#94a3b8" fontFamily="inherit" fontWeight="600">
              {label}
            </text>
          );
        })}

        {/* Needle shadow */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="rgba(0,0,0,0.12)" strokeWidth="6" strokeLinecap="round"
          transform="translate(1,2)" />

        {/* Needle */}
        <line x1={ntx} y1={nty} x2={nx} y2={ny}
          stroke={needleColor} strokeWidth="3.5" strokeLinecap="round"
          style={{ transition: 'all 0.05s linear' }} />

        {/* Centre hub */}
        <circle cx={cx} cy={cy} r="8" fill={needleColor} />
        <circle cx={cx} cy={cy} r="4" fill="#fff" />

        {/* Score in centre */}
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize="22" fontWeight="800"
          fill="#0f172a" fontFamily="inherit">
          {displayed}
        </text>
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize="9" fill="#94a3b8"
          fontFamily="inherit" fontWeight="600" letterSpacing="0.5">
          / 100
        </text>
      </svg>
    </div>
  );
}

function gradeColor(grade) {
  return { A: '#137333', B: '#34a853', C: '#e37400', D: '#ea8600', F: '#ea4335' }[grade] || '#5f6368';
}

function gradeBg(grade) {
  return { A: '#e6f4ea', B: '#e6f4ea', C: '#fef7e0', D: '#fce8e6', F: '#fce8e6' }[grade] || '#f1f3f4';
}

function gradeLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 55) return 'Poor';
  return 'Critical';
}

export default function ResultsDashboard({ results, onReset }) {
  const { findings, explanations, scoreResult, datasetInfo, rawData, decisionCol } = results;

  function handleDownloadPDF() {
    downloadAuditPDF({ datasetInfo, findings, explanations, scoreResult });
  }

  const severeCount = findings.filter((f) => f.overallVerdict === 'SEVERE BIAS').length;
  const mildCount = findings.filter((f) => f.overallVerdict === 'MILD BIAS').length;
  const fairCount = findings.filter((f) => f.overallVerdict === 'FAIR').length;

  return (
    <div className="results-page">
      {/* Header */}
      <div className="results-header">
        <div className="results-title-block">
          <h2>Fairness Audit Results</h2>
          <p>
            {datasetInfo.name} — {datasetInfo.rows.toLocaleString()} records analyzed across {findings.length} attribute{findings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="results-actions">
          <button id="download-pdf-btn" className="btn btn-success" onClick={handleDownloadPDF}>
            <span className="material-icons-round">picture_as_pdf</span>
            Download Audit Report
          </button>
          <button className="btn btn-secondary" onClick={onReset} id="new-analysis-btn">
            <span className="material-icons-round">refresh</span>
            New Analysis
          </button>
        </div>
      </div>

      {/* Score + Stats Grid */}
      <div className="score-grid">
        {/* Gauge Card */}
        <div className="score-card">
          <GaugeChart score={scoreResult.score} />
          <div
            className="score-grade"
            style={{ color: gradeColor(scoreResult.grade) }}
          >
            {scoreResult.grade}
          </div>
          <div className="score-number">{scoreResult.score} / 100</div>
          <div
            className="score-label"
            style={{
              background: gradeBg(scoreResult.grade),
              color: gradeColor(scoreResult.grade),
            }}
          >
            {gradeLabel(scoreResult.score)} — {scoreResult.score < 55 ? 'Immediate action required' : scoreResult.score < 70 ? 'Action recommended' : 'Minor improvements needed'}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 12 }}>
            Overall Fairness Score
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-text)' }}>
                {datasetInfo.rows.toLocaleString()}
              </div>
              <div className="stat-label">Records Analyzed</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-text)' }}>
                {findings.length}
              </div>
              <div className="stat-label">Attributes Audited</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: severeCount > 0 ? 'var(--color-severe)' : 'var(--color-text)' }}>
                {severeCount}
              </div>
              <div className="stat-label">Severe Bias Found</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-text)' }}>
                {(datasetInfo.positiveRate * 100).toFixed(1)}%
              </div>
              <div className="stat-label">Overall Positive Rate</div>
            </div>
          </div>

          {/* Verdict Summary */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Bias Finding Summary</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Severe Bias', count: severeCount, cls: 'severe' },
                { label: 'Mild Bias', count: mildCount, cls: 'mild' },
                { label: 'Fair', count: fairCount, cls: 'fair' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`severity-badge ${item.cls}`} style={{ padding: '4px 10px', fontSize: 12 }}>
                    {item.count} {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {severeCount > 0
                ? `⚠️ ${severeCount} attribute${severeCount > 1 ? 's' : ''} show severe bias. This dataset should not be used for decision-making without significant remediation.`
                : mildCount > 0
                ? `ℹ️ ${mildCount} attribute${mildCount > 1 ? 's' : ''} show mild bias. Review the recommendations below and consider fairness constraints.`
                : '✅ No significant bias detected. Continue monitoring as data grows.'}
            </p>
          </div>

          {/* Dataset details */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Dataset Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Dataset', datasetInfo.name],
                ['Decision Column', datasetInfo.decisionColumn],
                ['Sensitive Attributes', datasetInfo.sensitiveColumns.join(', ')],
                ['Total Columns', datasetInfo.columns],
              ].map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.4px' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bias Findings */}
      <div className="findings-section">
        <h3>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>policy</span>
          Bias Findings ({findings.length})
        </h3>
        <div className="findings-list">
          {findings.map((finding, i) => (
            <BiasCard
              key={finding.attribute}
              finding={finding}
              explanation={explanations[i]}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="card" style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', background: 'linear-gradient(135deg, #e8f0fe, #f3e8fd)' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Ready to share your findings?</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Download a complete PDF audit report to share with your team and stakeholders.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleDownloadPDF} id="download-pdf-bottom-btn">
          <span className="material-icons-round">download</span>
          Download Full Report
        </button>
      </div>
    </div>
  );
}
