import React, { useState, useCallback, useRef } from 'react';
import { callAI } from '../../utils/aiClient';

// ── Shared helpers ────────────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function fmtPct(n, d = 1) { return (n * 100).toFixed(d) + '%'; }

function Slider({ label, value, min, max, step = 0.01, onChange, color = '#4f46e5' }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '800', color }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '11px', color: '#94a3b8' }}>
        <span>{(min * 100).toFixed(0)}%</span>
        <span>{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function FeatureToggle({ feature, enabled, onChange, impact }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', backgroundColor: enabled ? '#fef2f2' : '#f8fafc',
      borderRadius: '8px', marginBottom: '6px', border: `1px solid ${enabled ? '#fca5a5' : '#e2e8f0'}`
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: enabled ? '#991b1b' : '#64748b' }}>{feature}</div>
        {impact && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{impact}</div>}
      </div>
      <div onClick={() => onChange(!enabled)} style={{
        width: '40px', height: '22px', borderRadius: '11px',
        backgroundColor: enabled ? '#ef4444' : '#e2e8f0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
      }}>
        <div style={{
          position: 'absolute', top: '3px', left: enabled ? '20px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          backgroundColor: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  );
}

// ── Metrics simulation ────────────────────────────────────────────────────────
function simulateMetrics(params) {
  const { techTab, thresholdA, thresholdB, reweightFactors, removedFeatures } = params;

  // Base metrics (loan audit baseline)
  const base = { disparateImpact: 0.57, demographicParity: 32, equalOpportunity: 19, predictiveParity: 0.91, score: 29 };

  let di = base.disparateImpact, dp = base.demographicParity, eo = base.equalOpportunity, pp = base.predictiveParity, sc = base.score;

  if (techTab === 0) {
    // Threshold adjustment: lower B threshold → more B approvals → better DI
    const thresholdEffect = (0.50 - thresholdB) * 2.5; // how much we moved threshold B
    di = clamp(0.57 + thresholdEffect * 0.52, 0.57, 1.00);
    dp = clamp(32 - thresholdEffect * 55, 2, 32);
    eo = clamp(19 - thresholdEffect * 30, 2, 19);
    pp = clamp(0.91 - thresholdEffect * 0.25, 0.65, 0.91); // tradeoff: PP gets worse
    sc = clamp(29 + thresholdEffect * 90, 29, 95);
  } else if (techTab === 1) {
    // Reweighting: average reweight factor
    const avgFactor = Object.values(reweightFactors).reduce((a, b) => a + b, 0) / Math.max(Object.keys(reweightFactors).length, 1);
    const rEffect = (avgFactor - 1.0) * 0.8;
    di = clamp(0.57 + rEffect * 0.3, 0.57, 0.96);
    dp = clamp(32 - rEffect * 35, 4, 32);
    eo = clamp(19 - rEffect * 20, 3, 19);
    pp = clamp(0.91 - rEffect * 0.10, 0.78, 0.91); // minor PP tradeoff
    sc = clamp(29 + rEffect * 55, 29, 90);
  } else if (techTab === 2) {
    // Feature removal: each proxy removed reduces bias by some %
    const featureImpact = { Race: 0.08, 'ZIP Code': 0.18, Name: 0.09, Age: 0.05, 'Gender': 0.07, 'Credit Score': 0.04 };
    let totalRemoved = Object.entries(removedFeatures).filter(([, on]) => !on).reduce((sum, [feat]) => sum + (featureImpact[feat] || 0.05), 0);
    di = clamp(0.57 + totalRemoved * 0.65, 0.57, 0.92);
    dp = clamp(32 - totalRemoved * 110, 5, 32);
    eo = clamp(19 - totalRemoved * 65, 4, 19);
    pp = clamp(0.91 - totalRemoved * 0.05, 0.82, 0.91);
    sc = clamp(29 + totalRemoved * 115, 29, 88);
  } else if (techTab === 3) {
    // Full blind review
    di = 0.79; dp = 12; eo = 9; pp = 0.86; sc = 68;
  }

  return {
    disparateImpact: +di.toFixed(3),
    demographicParity: +dp.toFixed(1),
    equalOpportunity: +eo.toFixed(1),
    predictiveParity: +pp.toFixed(3),
    score: Math.round(sc),
  };
}

function ImpossibilityBars({ metrics }) {
  const dpScore = clamp((1 - metrics.demographicParity / 32) * 100, 0, 100);
  const eoScore = clamp((1 - metrics.equalOpportunity / 19) * 100, 0, 100);
  const ppScore = clamp(metrics.predictiveParity * 100, 0, 100);

  const bars = [
    { label: 'Demographic Parity', score: dpScore, color: '#6366f1' },
    { label: 'Equal Opportunity', score: eoScore, color: '#10b981' },
    { label: 'Predictive Parity', score: ppScore, color: '#f59e0b' },
  ];

  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Fairness Impossibility</div>
      {bars.map(b => (
        <div key={b.label} style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
            <span style={{ fontWeight: '600' }}>{b.label}</span>
            <span style={{ fontWeight: '800', color: b.color }}>{b.score.toFixed(0)}%</span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', backgroundColor: b.color, width: b.score + '%', transition: 'width 0.4s ease', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', lineHeight: '1.4' }}>
        No algorithm can maximize all three simultaneously when base rates differ. (Chouldechova, 2017)
      </div>
    </div>
  );
}

function ComparisonTable({ base, current }) {
  const rows = [
    { label: 'Disparate Impact', baseV: base.disparateImpact, curV: current.disparateImpact, format: v => v.toFixed(3), higherBetter: true, threshold: '≥ 0.80' },
    { label: 'Demographic Parity Gap', baseV: base.demographicParity, curV: current.demographicParity, format: v => v.toFixed(1) + 'pp', higherBetter: false, threshold: '< 10pp' },
    { label: 'Equal Opportunity Gap', baseV: base.equalOpportunity, curV: current.equalOpportunity, format: v => v.toFixed(1) + 'pp', higherBetter: false, threshold: '< 10pp' },
    { label: 'Predictive Parity', baseV: base.predictiveParity, curV: current.predictiveParity, format: v => v.toFixed(3), higherBetter: true, threshold: '≥ 0.85' },
    { label: 'Fairness Score', baseV: base.score, curV: current.score, format: v => v + '/100', higherBetter: true, threshold: '≥ 65' },
  ];
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '16px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            {['Metric', 'Before', 'After', 'Change', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Metric' ? 'left' : 'center', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const better = row.higherBetter ? row.curV > row.baseV : row.curV < row.baseV;
            const changed = Math.abs(row.curV - row.baseV) > 0.001;
            const diff = row.curV - row.baseV;
            const diffStr = row.higherBetter
              ? (diff >= 0 ? '+' : '') + row.format(Math.abs(diff)).replace(/\/100/, '')
              : (diff <= 0 ? '-' : '+') + row.format(Math.abs(diff)).replace('pp', 'pp');
            return (
              <tr key={row.label} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>{row.label}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>{row.format(row.baseV)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: better ? '#16a34a' : changed ? '#dc2626' : '#64748b' }}>{row.format(row.curV)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: better ? '#16a34a' : changed ? '#dc2626' : '#94a3b8' }}>{changed ? diffStr : '—'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '14px' }}>{!changed ? '' : better ? '↑' : '↓'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BASE_METRICS = { disparateImpact: 0.57, demographicParity: 32, equalOpportunity: 19, predictiveParity: 0.91, score: 29 };
const FEATURES = ['Race', 'ZIP Code', 'Name', 'Age', 'Gender', 'Credit Score'];
const FEATURE_IMPACTS = { Race: 'Direct — highest bias removal', 'ZIP Code': 'Proxy — redlining signal', Name: 'Proxy — race/gender signal', Age: 'Marginal — some proxy effect', Gender: 'Moderate — direct signal', 'Credit Score': 'Low — outcome correlated' };

const TABS = [
  { id: 0, label: 'Threshold Adjustment', icon: 'tune' },
  { id: 1, label: 'Reweighing', icon: 'balance' },
  { id: 2, label: 'Feature Removal', icon: 'highlight_off' },
  { id: 3, label: 'Blind Review', icon: 'visibility_off' },
];

export default function DebiasingSimulator({ isOpen, onClose, auditContext }) {
  const [activeTab, setActiveTab] = useState(0);
  const [thresholdA, setThresholdA] = useState(0.50);
  const [thresholdB, setThresholdB] = useState(0.50);
  const [reweightFactors, setReweightFactors] = useState({ 'Group A': 1.0, 'Group B': 1.0 });
  const [removedFeatures, setRemovedFeatures] = useState(Object.fromEntries(FEATURES.map(f => [f, true])));
  const [blindApplied, setBlindApplied] = useState(false);
  const [geminiExplanation, setGeminiExplanation] = useState('');
  const [loadingGemini, setLoadingGemini] = useState(false);
  const debounceRef = useRef(null);

  const current = simulateMetrics({
    techTab: activeTab,
    thresholdA, thresholdB,
    reweightFactors,
    removedFeatures,
    blindApplied,
  });

  const fetchGeminiTradeoff = useCallback(async () => {
    if (loadingGemini) return;
    setLoadingGemini(true);
    try {
      const diChange = ((current.disparateImpact - BASE_METRICS.disparateImpact) * 100).toFixed(1);
      const ppChange = ((current.predictiveParity - BASE_METRICS.predictiveParity) * 100).toFixed(1);
      const techName = TABS[activeTab].label;
      const { text } = await callAI(
        `You are a fairness expert. Explain this bias mitigation tradeoff in 3 concise sentences for a non-technical audience:
        Technique: ${techName}
        Disparate Impact: changed from ${BASE_METRICS.disparateImpact} to ${current.disparateImpact} (${diChange}% change)
        Predictive Parity: changed from ${BASE_METRICS.predictiveParity} to ${current.predictiveParity} (${ppChange}% change)
        Overall Score: ${BASE_METRICS.score} → ${current.score}
        Format: [Plain English consequence for real people]. [Which metric got worse and why]. [Recommended next step].`
      );
      setGeminiExplanation(text);
    } catch { setGeminiExplanation(''); }
    setLoadingGemini(false);
  }, [current, activeTab, loadingGemini]);

  const triggerDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setGeminiExplanation('');
    debounceRef.current = setTimeout(() => { fetchGeminiTradeoff(); }, 800);
  }, [fetchGeminiTradeoff]);

  const handleThresholdB = v => { setThresholdB(v); triggerDebounced(); };
  const handleThresholdA = v => { setThresholdA(v); triggerDebounced(); };
  const handleReweight = (group, v) => { setReweightFactors(p => ({ ...p, [group]: v })); triggerDebounced(); };
  const handleFeatureToggle = (feat, val) => { setRemovedFeatures(p => ({ ...p, [feat]: val })); triggerDebounced(); };
  const handleBlind = () => { setBlindApplied(true); triggerDebounced(); };

  const isSignificantChange = current.score !== BASE_METRICS.score;
  const hasResidualBias = current.disparateImpact < 0.90;

  if (!isOpen) return null;

  return (
    <div style={{ marginTop: '24px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '2px solid #6366f1', overflow: 'hidden', boxShadow: '0 4px 24px rgba(99,102,241,0.15)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-icons-round" style={{ fontSize: '20px', color: '#6366f1' }}>science</span>
          <div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '15px' }}>Bias Mitigation Simulator</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Live simulation — adjust parameters and see results update instantly</div>
          </div>
        </div>
        <button onClick={onClose} style={{ padding: '6px 14px', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-icons-round" style={{ fontSize: '14px' }}>close</span> Close Simulator
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setBlindApplied(false); setGeminiExplanation(''); }} style={{
            flex: 1, padding: '12px 8px', backgroundColor: activeTab === t.id ? '#fff' : 'transparent',
            border: 'none', borderBottom: activeTab === t.id ? '2px solid #6366f1' : '2px solid transparent',
            cursor: 'pointer', color: activeTab === t.id ? '#4f46e5' : '#64748b',
            fontWeight: activeTab === t.id ? '700' : '500', fontSize: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', transition: 'all 0.15s'
          }}>
            <span className="material-icons-round" style={{ fontSize: '18px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
        {/* Left: Controls */}
        <div>
          {activeTab === 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Threshold Adjustment</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Lowering Group B's threshold means fewer people are rejected — improving Demographic Parity but potentially reducing Predictive Parity.</div>
              <Slider label="Group A Threshold" value={thresholdA} min={0.20} max={0.80} onChange={handleThresholdA} color="#6366f1" />
              <Slider label="Group B Threshold (adjust this)" value={thresholdB} min={0.20} max={0.80} onChange={handleThresholdB} color="#ef4444" />
              <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1e40af' }}>
                💡 Move "Group B Threshold" left (lower) to simulate giving Group B more access. Watch the Comparison Table update in real time.
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Reweighing</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Gives more importance to underrepresented group decisions during training — reduces bias in the source data without changing the model threshold.</div>
              {Object.entries(reweightFactors).map(([group, val]) => (
                <Slider key={group} label={`${group} Reweight Factor`} value={val / 2} min={0.25} max={1.0} step={0.01} onChange={v => handleReweight(group, v * 2)} color={group === 'Group A' ? '#6366f1' : '#ef4444'} />
              ))}
              <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#166534' }}>
                💡 Increase Group B's factor to 1.5x or 2.0x to simulate reweighing training data toward underrepresented groups.
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Feature Removal</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Toggle features off to remove them. Proxy features (ZIP, Name) encode race without including it directly.</div>
              {FEATURES.map(feat => (
                <FeatureToggle key={feat} feature={feat} enabled={removedFeatures[feat]} onChange={v => handleFeatureToggle(feat, v)} impact={FEATURE_IMPACTS[feat]} />
              ))}
            </div>
          )}

          {activeTab === 3 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Full Blind Review</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Removes ALL demographic-correlated features simultaneously. Shows residual structural bias that cannot be removed by feature exclusion alone.</div>
              <button onClick={handleBlind} disabled={blindApplied} style={{
                width: '100%', padding: '14px', backgroundColor: blindApplied ? '#f1f5f9' : '#0f172a', color: blindApplied ? '#64748b' : '#fff', border: 'none', borderRadius: '10px', cursor: blindApplied ? 'default' : 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
                <span className="material-icons-round">{blindApplied ? 'check_circle' : 'visibility_off'}</span>
                {blindApplied ? 'Full Blind Review Applied' : 'Apply Full Blind Review'}
              </button>
              {blindApplied && hasResidualBias && (
                <div style={{ marginTop: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px ', fontSize: '12px', color: '#991b1b' }}>
                  <strong>Residual Bias Detected ({fmtPct(1 - current.disparateImpact)} gap)</strong><br/>
                  Even with fully blind review, significant bias remains. This is structural bias embedded in the outcome data itself — reflecting historical discrimination that cannot be fixed by feature removal alone. Systemic intervention is required.
                </div>
              )}
              {blindApplied && !hasResidualBias && (
                <div style={{ marginTop: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#166534' }}>
                  <strong>Minimal Residual Bias.</strong> Blind review achieved near-equitable Disparate Impact. However, monitor closely — complete blind review may reduce model accuracy.
                </div>
              )}
            </div>
          )}

          {/* Gemini Tradeoff Card */}
          <div style={{ marginTop: '16px', backgroundColor: '#f8faff', borderRadius: '10px', border: '1px solid #e0e7ff', padding: '14px', minHeight: '80px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-round" style={{ fontSize: '13px' }}>auto_awesome</span> AI Tradeoff Analysis
            </div>
            {loadingGemini ? (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Analyzing tradeoff...</div>
            ) : geminiExplanation ? (
              <div style={{ color: '#334155', fontSize: '12px', lineHeight: '1.6' }}>{geminiExplanation}</div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Adjust a parameter to see the AI tradeoff explanation here.</div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div>
          <ImpossibilityBars metrics={current} />
          <ComparisonTable base={BASE_METRICS} current={current} />

          {!isSignificantChange && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '12px' }}>
              ← Adjust a parameter to see simulated results
            </div>
          )}

          {isSignificantChange && (
            <div style={{
              backgroundColor: current.score > 65 ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${current.score > 65 ? '#bbf7d0' : '#fcd34d'}`,
              borderRadius: '10px', padding: '14px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', fontWeight: '900', color: current.score > 65 ? '#15803d' : '#92400e' }}>
                {current.score}/100
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                {current.score > 65 ? '✓ Above acceptable threshold' : '⚠ Still below acceptable threshold'}
              </div>
              {current.score > BASE_METRICS.score && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  +{current.score - BASE_METRICS.score} points improvement over baseline ({BASE_METRICS.score})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
