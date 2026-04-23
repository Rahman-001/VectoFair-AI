import React, { useEffect, useState } from 'react';

/**
 * Animated SVG Fairness Gauge
 * Score mapping: Green > 70, Amber 40-70, Red < 40
 */
export default function BiasScoreGauge({ score, grade, size = 220 }) {
  const [displayed, setDisplayed] = useState(0);

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

  const cx = 110, cy = 110, r = 82;
  const startAngle = -210;
  const totalArc   = 240;

  function polarToXY(deg, radius) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(fromDeg, toDeg, radius) {
    radius = radius || r;
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const f = polarToXY(fromDeg, radius);
    const t = polarToXY(toDeg, radius);
    return 'M ' + f.x + ' ' + f.y + ' A ' + radius + ' ' + radius + ' 0 ' + large + ' 1 ' + t.x + ' ' + t.y;
  }

  const zones = [
    { from: 0,  to: 40,  color: '#ef4444' },
    { from: 40, to: 70,  color: '#f59e0b' },
    { from: 70, to: 100, color: '#22c55e' },
  ];

  function zoneArc(fromVal, toVal, color) {
    const fDeg = startAngle + (fromVal / 100) * totalArc;
    const tDeg = startAngle + (toVal  / 100) * totalArc;
    return React.createElement('path', { key: color, d: arcPath(fDeg, tDeg, r), stroke: color, strokeWidth: '14', fill: 'none', strokeLinecap: 'butt', opacity: '0.85' });
  }

  const needleDeg    = startAngle + (displayed / 100) * totalArc;
  const needleRad    = (needleDeg * Math.PI) / 180;
  const needleLen    = 68;
  const needleTailLen= 14;
  const nx  = cx + needleLen * Math.cos(needleRad);
  const ny  = cy + needleLen * Math.sin(needleRad);
  const ntx = cx - needleTailLen * Math.cos(needleRad);
  const nty = cy - needleTailLen * Math.sin(needleRad);

  const needleColor = displayed < 40 ? '#ef4444' : displayed < 70 ? '#f59e0b' : '#22c55e';

  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);
  function tickCoords(val, innerR, outerR) {
    const deg = startAngle + (val / 100) * totalArc;
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx + innerR * Math.cos(rad), y1: cy + innerR * Math.sin(rad),
      x2: cx + outerR * Math.cos(rad), y2: cy + outerR * Math.sin(rad),
    };
  }

  const scaleFactor = size / 220;

  return (
    <div className="bias-score-gauge-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 220 145" width={size} height={size * (145/220)} style={{ overflow: 'visible' }}>
        {/* Track background */}
        <path d={arcPath(startAngle, startAngle + totalArc, r)} stroke="#e2e8f0" strokeWidth="14" fill="none" strokeLinecap="butt" />

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
      {grade && (
        <div style={{
          marginTop: '8px',
          padding: '4px 12px',
          borderRadius: '100px',
          backgroundColor: displayed < 40 ? '#fef2f2' : displayed < 70 ? '#fffbeb' : '#f0fdf4',
          color: needleColor,
          fontWeight: 'bold',
          fontSize: '14px',
          border: '1px solid ' + needleColor + '40',
        }}>
          Grade: {grade}
        </div>
      )}
    </div>
  );
}
