import { useEffect, useRef } from 'react';

const METRIC_TOOLTIPS = {
  'Demographic Parity':
    'Measures whether different demographic groups receive positive decisions at equal rates. A disparity of 0 is perfect fairness. Values above 0.2 indicate significant bias.',
  'Disparate Impact Ratio':
    'The 80% rule: ratio of positive rates between groups. A value below 0.8 is legally considered discriminatory under EEOC guidelines.',
  'Equal Opportunity':
    'Checks whether qualified individuals from all groups have equal opportunity to receive a positive decision.',
};

function verdictClass(verdict) {
  if (verdict === 'SEVERE BIAS') return 'severe';
  if (verdict === 'MILD BIAS') return 'mild';
  return 'fair';
}

function attrIcon(attr) {
  const icons = {
    gender: 'wc',
    age: 'cake',
    race: 'diversity_3',
    ethnicity: 'diversity_3',
    religion: 'church',
    disability: 'accessible',
    default: 'person',
  };
  return icons[attr.toLowerCase()] || icons.default;
}

function attrColor(attr) {
  const colors = {
    gender: ['#e8f0fe', '#4285f4'],
    age: ['#fef7e0', '#e37400'],
    race: ['#fce8e6', '#ea4335'],
    ethnicity: ['#fce8e6', '#ea4335'],
    default: ['#f3e8fd', '#a142f4'],
  };
  return colors[attr.toLowerCase()] || colors.default;
}

// Simple bar chart using Google Charts
function GroupBarChart({ groupRates, attribute, cardId }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!window.google?.visualization) {
      // Retry after Google Charts loads
      const timer = setTimeout(() => {
        renderChart();
      }, 1500);
      return () => clearTimeout(timer);
    }
    renderChart();
  }, [groupRates]);

  function renderChart() {
    if (!chartRef.current || !window.google?.visualization) return;

    const groups = Object.entries(groupRates);
    const data = new window.google.visualization.DataTable();
    data.addColumn('string', 'Group');
    data.addColumn('number', 'Decision Rate (%)');
    data.addColumn({ type: 'string', role: 'style' });
    data.addColumn({ type: 'string', role: 'annotation' });

    const maxRate = Math.max(...groups.map(([, r]) => r));
    data.addRows(
      groups.map(([group, rate]) => [
        group,
        parseFloat((rate * 100).toFixed(1)),
        rate === maxRate ? 'color: #4285f4' : 'color: #ea4335',
        `${(rate * 100).toFixed(1)}%`,
      ])
    );

    const options = {
      chartArea: { width: '80%', height: '70%' },
      legend: { position: 'none' },
      hAxis: { title: 'Decision Rate (%)', minValue: 0, maxValue: 100, textStyle: { fontSize: 11 } },
      vAxis: { textStyle: { fontSize: 12, bold: true } },
      bar: { groupWidth: '60%' },
      annotations: { alwaysOutside: false, textStyle: { fontSize: 11, bold: true, color: '#fff' } },
      backgroundColor: 'transparent',
      height: 180,
    };

    if (chartInstance.current) chartInstance.current.clearChart();
    chartInstance.current = new window.google.visualization.BarChart(chartRef.current);
    chartInstance.current.draw(data, options);
  }

  return <div ref={chartRef} id={`chart-${cardId}`} className="chart-container" />;
}

export default function BiasCard({ finding, explanation, index }) {
  const vc = verdictClass(finding.overallVerdict);
  const [bgColor, iconColor] = attrColor(finding.attribute);
  const icon = attrIcon(finding.attribute);

  return (
    <div className="bias-card" id={`bias-card-${finding.attribute}`} style={{ animationDelay: `${index * 0.08}s` }}>
      {/* Card Header */}
      <div className="bias-card-header">
        <div className="bias-card-title">
          <div className="attr-icon" style={{ background: bgColor }}>
            <span className="material-icons-round" style={{ color: iconColor }}>{icon}</span>
          </div>
          <div>
            <h3>
              {finding.attribute.charAt(0).toUpperCase() + finding.attribute.slice(1)} Bias
            </h3>
            <p>
              {Object.keys(finding.groupRates).join(' vs ')} —&nbsp;
              {Object.entries(finding.groupRates)
                .map(([g, r]) => `${g}: ${(r * 100).toFixed(1)}%`)
                .join(', ')}
            </p>
          </div>
        </div>
        <span className={`severity-badge ${vc}`}>
          <span className="material-icons-round" style={{ fontSize: 14 }}>
            {vc === 'severe' ? 'dangerous' : vc === 'mild' ? 'warning' : 'check_circle'}
          </span>
          {finding.overallVerdict}
        </span>
      </div>

      {/* Card Body */}
      <div className="bias-card-body">
        <div className="bias-body-grid">
          {/* Metrics Table */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Metric Analysis
            </p>
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>
                    Metric
                    <span className="material-icons-round" style={{ fontSize: 12, marginLeft: 4, verticalAlign: 'middle', color: 'var(--color-text-tertiary)' }}>
                      info
                    </span>
                  </th>
                  <th>Value</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {finding.metrics.map((metric) => (
                  <tr key={metric.metric}>
                    <td>
                      <div className="tooltip-wrap">
                        <span style={{ fontSize: 13 }}>{metric.metric}</span>
                        <div className="tooltip-content">{METRIC_TOOLTIPS[metric.metric]}</div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {metric.metric === 'Disparate Impact Ratio'
                        ? metric.ratio?.toFixed(3)
                        : metric.disparity?.toFixed(3)}
                    </td>
                    <td>
                      <span className={`metric-verdict ${verdictClass(metric.verdict)}`}>
                        {metric.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Decision Rate by Group
            </p>
            <GroupBarChart
              groupRates={finding.groupRates}
              attribute={finding.attribute}
              cardId={`${finding.attribute}-${index}`}
            />
          </div>
        </div>

        {/* AI Explanation */}
        {explanation && (
          <div className="ai-explanation">
            <div className="ai-header">
              <span className="ai-badge">
                <span className="material-icons-round" style={{ fontSize: 12 }}>hub</span>
                {explanation.source === 'fallback' ? 'AI' : 'Multi-Model AI'} Analysis
                {explanation.source === 'fallback' && (
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>(offline)</span>
                )}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>What this means</span>
            </div>
            <p>{explanation.explanation}</p>
            {explanation.recommendations?.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recommendations
                </p>
                <div className="recommendations">
                  {explanation.recommendations.map((rec, i) => (
                    <div key={i} className="recommendation-item">
                      <div className="rec-number">{i + 1}</div>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
