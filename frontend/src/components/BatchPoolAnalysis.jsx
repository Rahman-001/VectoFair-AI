// VectoFair — Batch Pool Analysis Component
// Google Charts: bar chart + pie chart + screening equity simulation

import { useEffect, useRef } from 'react';

function loadGoogleCharts() {
  return new Promise((resolve) => {
    if (window.google?.visualization) { resolve(); return; }
    const existing = document.getElementById('google-charts-script');
    if (existing) { existing.addEventListener('load', resolve); return; }
    const script = Object.assign(document.createElement('script'), {
      id: 'google-charts-script',
      src: 'https://www.gstatic.com/charts/loader.js',
    });
    script.onload = () => {
      window.google.charts.load('current', { packages: ['corechart', 'bar'] });
      window.google.charts.setOnLoadCallback(resolve);
    };
    document.head.appendChild(script);
  });
}

function BarChart({ data, title }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!data || data.length < 2) return;
    loadGoogleCharts().then(() => {
      if (!ref.current || !window.google?.visualization) return;
      const dt = window.google.visualization.arrayToDataTable(data);
      const chart = new window.google.visualization.ColumnChart(ref.current);
      chart.draw(dt, {
        title,
        titleTextStyle: { color: '#0f172a', fontSize: 13, bold: true, fontName: 'Inter' },
        backgroundColor: 'transparent',
        chartArea: { width: '80%', height: '65%' },
        legend: { position: 'none' },
        vAxis: {
          title: 'Avg Bias Score (0–100)',
          minValue: 0, maxValue: 100,
          titleTextStyle: { color: '#64748b', fontSize: 11 },
          gridlines: { color: '#e2e8f0' },
          textStyle: { color: '#64748b', fontSize: 11 },
        },
        hAxis: { textStyle: { color: '#374151', fontSize: 11 } },
        animation: { startup: true, duration: 800, easing: 'out' },
        tooltip: { isHtml: false },
      });
    });
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}

function PieChart({ data, title }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!data || data.length < 2) return;
    loadGoogleCharts().then(() => {
      if (!ref.current || !window.google?.visualization) return;
      const dt = window.google.visualization.arrayToDataTable(data);
      const chart = new window.google.visualization.PieChart(ref.current);
      chart.draw(dt, {
        title,
        titleTextStyle: { color: '#0f172a', fontSize: 13, bold: true, fontName: 'Inter' },
        backgroundColor: 'transparent',
        chartArea: { width: '85%', height: '75%' },
        colors: ['#22c55e', '#dc2626', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'],
        legend: { position: 'right', textStyle: { color: '#374151', fontSize: 11 } },
        pieHole: 0.4,
        animation: { startup: true, duration: 800, easing: 'out' },
      });
    });
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height: 260 }} />;
}

export default function BatchPoolAnalysis({ batchStats }) {
  if (!batchStats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <span className="material-icons-round" style={{ fontSize: 40, marginBottom: 12 }}>bar_chart</span>
        <p>Pool analysis will appear after resumes are analyzed.</p>
      </div>
    );
  }

  const {
    poolFairnessScore, demographicBreakdown,
    biasedShortlist, angloAvgScore, minorityAvgScore,
    angloInBiasedShortlist, minorityInBiasedShortlist,
    keyInsight, barChartData, pieChartData, riskSummary,
  } = batchStats;

  const poolGradeColor = poolFairnessScore >= 70 ? '#16a34a' : poolFairnessScore >= 45 ? '#d97706' : '#dc2626';

  return (
    <div className="pool-analysis-page">
      {/* Pool score hero */}
      <div className="pool-score-hero">
        <div className="pool-score-cell">
          <div className="pool-score-num" style={{ color: poolGradeColor }}>{poolFairnessScore}</div>
          <div className="pool-score-label">Pool Fairness Score</div>
          <div className="pool-score-sub">/ 100</div>
        </div>
        <div className="pool-stats-row">
          {[
            { label: 'Anglo-named avg', value: angloAvgScore, sub: 'bias score', good: true },
            { label: 'Minority-named avg', value: minorityAvgScore, sub: 'bias score', good: false },
            { label: 'Biased shortlist (top 10)', value: `${angloInBiasedShortlist} Anglo / ${minorityInBiasedShortlist} Other`, sub: 'simulated', good: false, wide: true },
          ].map((s) => (
            <div key={s.label} className="pool-stat-box" style={{ flexBasis: s.wide ? '100%' : 'auto' }}>
              <div className="pool-stat-val" style={{ color: s.wide ? '#dc2626' : 'inherit' }}>{s.value}</div>
              <div className="pool-stat-lab">{s.label}</div>
              <div className="pool-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Key insight */}
      {keyInsight && (
        <div className="pool-insight-banner">
          <span className="material-icons-round" style={{ fontSize: 20, flexShrink: 0 }}>lightbulb</span>
          <div>
            <strong>Key Finding:</strong> {keyInsight}
          </div>
        </div>
      )}

      {/* Risk summary */}
      <div className="pool-risk-row">
        {[
          { label: 'High Risk', count: riskSummary?.high || 0, color: '#dc2626', bg: '#fef2f2', icon: 'warning' },
          { label: 'Medium Risk', count: riskSummary?.medium || 0, color: '#d97706', bg: '#fffbeb', icon: 'info' },
          { label: 'Low Risk', count: riskSummary?.low || 0, color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
        ].map((r) => (
          <div key={r.label} className="pool-risk-card" style={{ borderTop: `3px solid ${r.color}`, background: r.bg }}>
            <span className="material-icons-round" style={{ fontSize: 22, color: r.color }}>{r.icon}</span>
            <div className="pool-risk-count" style={{ color: r.color }}>{r.count}</div>
            <div className="pool-risk-label">{r.label}</div>
          </div>
        ))}
      </div>

      {/* Charts side by side */}
      <div className="pool-charts-grid">
        <div className="pool-chart-card">
          <div className="pool-chart-title">
            <span className="material-icons-round" style={{ fontSize: 16, color: '#4338ca' }}>bar_chart</span>
            Average Bias Score by Name Category
          </div>
          <BarChart data={barChartData} title="" />
        </div>
        <div className="pool-chart-card">
          <div className="pool-chart-title">
            <span className="material-icons-round" style={{ fontSize: 16, color: '#4338ca' }}>pie_chart</span>
            Applicant Pool Demographic Breakdown
          </div>
          <PieChart data={pieChartData} title="" />
        </div>
      </div>

      {/* Simulated shortlist table */}
      <div className="pool-shortlist-section">
        <div className="pool-section-header">
          <span className="material-icons-round" style={{ fontSize: 18, color: '#dc2626' }}>sort</span>
          <div>
            <div style={{ fontWeight: 700 }}>Biased Screener Simulation — Top 10 Shortlist</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              A screener who consciously or unconsciously favors low-bias signals would select these candidates first.
            </div>
          </div>
        </div>
        <div className="pool-shortlist-table">
          <div className="pool-shortlist-head">
            <span>Rank</span>
            <span>Candidate</span>
            <span>Name Category</span>
            <span>Bias Score</span>
            <span>Risk</span>
          </div>
          {(biasedShortlist || []).slice(0, 10).map((r, i) => {
            const score = r.biasVulnerabilityScore || 0;
            const risk  = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
            const rc    = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' }[risk];
            const isAnglo = r.nameCategory === 'Anglo';
            return (
              <div key={r.id || i} className="pool-shortlist-row" style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <span className="shortlist-rank">#{i + 1}</span>
                <span className="shortlist-name">
                  {r.candidateName || r.id}
                  {isAnglo && <span className="shortlist-favored-tag">Favored</span>}
                </span>
                <span className="shortlist-category">
                  <span className="material-icons-round" style={{ fontSize: 13, color: isAnglo ? '#16a34a' : '#dc2626' }}>
                    {isAnglo ? 'check_circle' : 'warning'}
                  </span>
                  {r.nameCategory}
                </span>
                <span className="shortlist-score" style={{ color: rc, fontWeight: 700 }}>{score}</span>
                <span className="shortlist-risk" style={{ color: rc, background: `${rc}18`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{risk}</span>
              </div>
            );
          })}
        </div>
        {angloInBiasedShortlist > 0 && (
          <div className="pool-shortlist-note">
            <span className="material-icons-round" style={{ fontSize: 16, color: '#dc2626' }}>error_outline</span>
            A biased screener would shortlist <strong>{angloInBiasedShortlist} Anglo-named</strong> candidates and only{' '}
            <strong>{minorityInBiasedShortlist} minority-named</strong> candidates from this pool — despite many having equal qualifications.
          </div>
        )}
      </div>

      {/* Category breakdown table */}
      <div className="pool-breakdown-section">
        <div className="pool-section-header">
          <span className="material-icons-round" style={{ fontSize: 18, color: '#4338ca' }}>table_chart</span>
          <div style={{ fontWeight: 700 }}>Bias Score by Name Category</div>
        </div>
        <div className="pool-breakdown-table">
          {demographicBreakdown.sort((a, b) => b.avgBiasScore - a.avgBiasScore).map((d) => (
            <div key={d.category} className="pool-breakdown-row">
              <div className="breakdown-category">{d.category}</div>
              <div className="breakdown-bar-wrap">
                <div
                  className="breakdown-bar"
                  style={{
                    width: `${d.avgBiasScore}%`,
                    background: d.avgBiasScore >= 60 ? '#dc2626' : d.avgBiasScore >= 35 ? '#d97706' : '#22c55e',
                  }}
                />
                <span className="breakdown-score">{d.avgBiasScore}/100</span>
              </div>
              <div className="breakdown-count">{d.count} resume{d.count !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
