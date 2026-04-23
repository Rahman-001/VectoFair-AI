import React, { useState, useEffect } from 'react';

/**
 * Renders an AI-generated explanation of bias with skeletons for loading states.
 * expects data from aiClient containing: { explanation, recommendations: [] }
 */
export default function GeminiExplainCard({ fetchExplanation, trigger = true }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (trigger && !data && !loading && !error) {
      loadData();
    }
  }, [trigger]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExplanation();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to generate explanation.');
    } finally {
      setLoading(false);
    }
  };

  if (!trigger) return null;

  return (
    <div className="gemini-explain-card" style={{
      background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '16px',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="material-symbols-rounded" style={{ color: '#8b5cf6' }}>auto_awesome</span>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '15px', fontWeight: '600' }}>AI Bias Explanation</h4>
        {data && data.source && (
          <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', marginLeft: 'auto' }}>
            Powered by {data.source === 'mistral' ? 'Mistral.ai' : data.source === 'openrouter' ? 'OpenRouter' : 'VectoFair Fallback'}
          </span>
        )}
      </div>

      {loading && (
        <div className="skeleton-loader" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ height: '16px', background: '#cbd5e1', borderRadius: '4px', width: '100%', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '16px', background: '#cbd5e1', borderRadius: '4px', width: '90%', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '16px', background: '#cbd5e1', borderRadius: '4px', width: '95%', animation: 'pulse 1.5s infinite' }} />
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px' }}>
          <p style={{ margin: '0 0 12px 0' }}>{error}</p>
          <button onClick={loadData} style={{
            background: '#fee2e2', border: 'none', color: '#b91c1c', padding: '6px 12px', 
            borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
          }}>
            Retry Analysis
          </button>
        </div>
      )}

      {data && !loading && !error && (
        <div className="gemini-content">
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>What this means</h5>
            <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: '1.6' }}>
              {data.explanation}
            </p>
          </div>
          
          {data.recommendations && data.recommendations.length > 0 && (
            <div>
              <h5 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>How to fix</h5>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '15px', lineHeight: '1.6' }}>
                {data.recommendations.map((rec, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: '@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }'}} />
    </div>
  );
}
