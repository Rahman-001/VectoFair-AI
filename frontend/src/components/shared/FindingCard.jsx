import React, { useState, useCallback } from 'react';
import ComplianceBadge from './ComplianceBadge';
import { callAI } from '../../utils/aiClient';

const SEVERITY_STYLE = {
  SEVERE: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: 'crisis_alert',     dot: '#ef4444' },
  HIGH:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'warning',           dot: '#f59e0b' },
  MEDIUM: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'info',              dot: '#3b82f6' },
  LOW:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: 'check_circle',     dot: '#22c55e' },
  INFO:   { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: 'analytics',         dot: '#9ca3af' },
};

function getSeverityStyle(severity) {
  const key = (severity || '').toUpperCase();
  return SEVERITY_STYLE[key] || SEVERITY_STYLE.INFO;
}

function AIInsightPanel({ findingTitle, severity, metrics, legalBasis }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);

  const explain = useCallback(async () => {
    setState('loading');
    try {
      const metricStr = (metrics || []).map(m => `${m.label}: ${m.value}`).join(', ');
      const legalStr = (legalBasis || []).map(l => l.name).join(', ');
      const prompt = `You are a bias audit expert. A fairness audit found this issue:

FINDING: "${findingTitle}"
SEVERITY: ${severity}
KEY METRICS: ${metricStr}
LEGAL EXPOSURE: ${legalStr}

Explain this in exactly this format — be concise, plain English, no jargon:
WHAT: [One sentence: what is happening and who is affected]
RISK: [One sentence: what legal/regulatory risk this creates]
FIX: [One sentence: the single most impactful remediation action]`;

      const { text } = await callAI(prompt);

      // Parse structured response
      const what = text.match(/WHAT:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const risk = text.match(/RISK:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const fix  = text.match(/FIX:\s*([^\n]+)/i)?.[1]?.trim() || '';

      if (what || risk || fix) {
        setResult({ what, risk, fix });
        setState('done');
      } else {
        // Fallback: show raw text nicely
        setResult({ what: text.trim(), risk: '', fix: '' });
        setState('done');
      }
    } catch {
      setState('error');
    }
  }, [findingTitle, severity, metrics, legalBasis]);

  if (state === 'idle') {
    return (
      <button
        onClick={explain}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', backgroundColor: '#f5f3ff',
          color: '#6d28d9', border: '1px solid #ddd6fe',
          borderRadius: '8px', cursor: 'pointer',
          fontWeight: '600', fontSize: '13px', marginTop: '12px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ede9fe'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
      >
        <span className="material-icons-round" style={{ fontSize: '16px' }}>auto_awesome</span>
        AI Explain This Finding
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div style={{
        marginTop: '12px', padding: '14px 16px',
        backgroundColor: '#faf5ff', border: '1px solid #ddd6fe',
        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '13px', color: '#7c3aed',
      }}>
        <span className="material-icons-round" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>refresh</span>
        AI analyzing this finding…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{
        marginTop: '12px', padding: '12px 16px',
        backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
        borderRadius: '8px', fontSize: '13px', color: '#991b1b',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span className="material-icons-round" style={{ fontSize: '16px' }}>cloud_off</span>
        AI unavailable — check API configuration.
        <button onClick={() => setState('idle')} style={{ marginLeft: 'auto', fontSize: '12px', color: '#991b1b', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  // Done state
  const rows = [
    { icon: 'person_alert', color: '#dc2626', bg: '#fef8f8', label: 'What this means', text: result.what },
    { icon: 'gavel',        color: '#d97706', bg: '#fffdf4', label: 'Legal / Regulatory Risk', text: result.risk },
    { icon: 'build_circle', color: '#16a34a', bg: '#f6fef9', label: 'Recommended Fix', text: result.fix },
  ].filter(r => r.text);

  return (
    <div style={{ marginTop: '14px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ddd6fe' }}>
      <div style={{
        padding: '8px 14px', backgroundColor: '#f5f3ff',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: '700', color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        <span className="material-icons-round" style={{ fontSize: '14px' }}>auto_awesome</span>
        AI Analysis
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '12px 14px', backgroundColor: row.bg,
          borderTop: i > 0 ? '1px solid #f3f0ff' : 'none',
        }}>
          <div style={{
            width: '28px', height: '28px', flexShrink: 0, borderRadius: '8px',
            backgroundColor: '#fff', border: `1px solid ${row.color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px', color: row.color }}>{row.icon}</span>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: row.color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
              {row.label}
            </div>
            <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.55' }}>{row.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FindingCard({
  title,
  severity,
  metrics = [],
  legalBasis = [],
  rewriteAvailable = false,
  onRectifyClick = () => {},
  fetchExplanation = null,       // legacy prop — kept for backwards compat
  geminiExplanation = null,      // legacy inline explanation
}) {
  const sev = getSeverityStyle(severity);

  return (
    <div style={{
      backgroundColor: '#fff',
      border: `1px solid ${sev.border}`,
      borderLeft: `4px solid ${sev.color}`,
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: sev.bg,
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%',
          backgroundColor: sev.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-icons-round" style={{ fontSize: '18px' }}>{sev.icon}</span>
        </div>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '14px', fontWeight: '700', flex: 1, lineHeight: 1.4 }}>{title}</h3>
        <span style={{
          flexShrink: 0,
          padding: '4px 10px', backgroundColor: '#fff',
          border: `1.5px solid ${sev.color}`,
          color: sev.color, borderRadius: '6px',
          fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px',
        }}>
          {(severity || 'FINDING').toUpperCase()}
        </span>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* ── Metrics Grid ─────────────────────────── */}
        {metrics.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)`,
            gap: '12px',
            marginBottom: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid #f1f5f9',
          }}>
            {metrics.map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Insight Panel ─────────────────────── */}
        <AIInsightPanel
          findingTitle={title}
          severity={severity}
          metrics={metrics}
          legalBasis={legalBasis}
        />

        {/* ── Legal Citations ──────────────────────── */}
        {legalBasis.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
            {legalBasis.map((law, i) => (
              <ComplianceBadge
                key={i}
                lawName={law.name || 'Regulation'}
                citation={law.citation || law}
                status={['SEVERE', 'HIGH'].includes((severity || '').toUpperCase()) ? 'violation' : 'risk'}
              />
            ))}
          </div>
        )}

        {/* ── Rectify Button ──────────────────────── */}
        {rewriteAvailable && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '14px',
          }}>
            <button onClick={onRectifyClick} style={{
              backgroundColor: '#059669', color: '#fff',
              border: 'none', padding: '9px 18px', borderRadius: '8px',
              fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#059669'; }}
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>healing</span>
              Rectify Bias
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
