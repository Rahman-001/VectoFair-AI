import React from 'react';

/**
 * Slide-out panel to display test runner results
 */
export default function TestCasePanel({ isOpen, onClose, results, onRunTests, isRunning, moduleId }) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 9998,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Slide-out Panel */}
      <div className="test-case-panel" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: '450px',
        backgroundColor: '#ffffff',
        boxShadow: '-10px 0 25px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column'
      }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-round" style={{ color: '#64748b', fontSize: '20px' }}>fact_check</span>
              Module Test Suite
            </h2>
            {results && !isRunning && (
              <p style={{ margin: '4px 0 0 0', color: results.passedCount === results.totalCount ? '#166534' : '#991b1b', fontSize: '14px', fontWeight: '500' }}>
                {results.summary}
              </p>
            )}
            {moduleId && (
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Module: {moduleId}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f1f5f9' }}>
          {isRunning ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              <span className="material-icons-round" style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>sync</span>
              Running Analysis Tests...
            </div>
          ) : !results ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', textAlign: 'center' }}>
              <span className="material-icons-round" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>science</span>
              <p style={{ margin: '0 0 16px 0' }}>No test results yet.</p>
              {onRunTests && (
                <button
                  onClick={onRunTests}
                  style={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Run All Tests Now
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {results.results.map((test, i) => (
                <div key={i} style={{
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid ' + (test.passed ? '#bbf7d0' : '#fecaca'),
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: test.passed ? '#f0fdf4' : '#fef2f2',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    borderBottom: test.passed ? 'none' : '1px solid #fecaca'
                  }}>
                    <span className="material-icons-round" style={{ color: test.passed ? '#166534' : '#991b1b', fontSize: '20px' }}>
                      {test.passed ? 'check_circle' : 'cancel'}
                    </span>
                    <span style={{ fontWeight: '600', color: test.passed ? '#166534' : '#991b1b' }}>{test.testName}</span>
                  </div>

                  {!test.passed && (
                    <div style={{ padding: '12px 16px', backgroundColor: '#fff', color: '#b91c1c', fontSize: '13px', lineHeight: '1.5' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Failure Reason:</strong>
                      {test.failReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
          {onRunTests && (
            <button
              onClick={onRunTests}
              disabled={isRunning}
              style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#334155' }}
            >
              {isRunning ? 'Running...' : 'Re-run Tests'}
            </button>
          )}

          <button
            onClick={() => {
              if (!results) return;
              const json = JSON.stringify(results, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'VectoFair-test-report-' + Date.now() + '.json';
              a.click();
            }}
            disabled={!results || isRunning}
            style={{ flex: 1, padding: '10px', backgroundColor: (results && !isRunning) ? '#0f172a' : '#cbd5e1', border: 'none', borderRadius: '6px', cursor: (results && !isRunning) ? 'pointer' : 'not-allowed', fontWeight: '500', color: '#fff' }}
          >
            Export JSON
          </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 100% { transform: rotate(360deg); } }' }} />
    </>
  );
}
