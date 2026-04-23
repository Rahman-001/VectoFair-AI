import React from 'react';

/**
 * Full-screen modal comparing original and rewritten content for bias neutralization.
 */
export default function RewriteModal({
  isOpen,
  onClose,
  onAccept,
  originalContent,
  rewrittenContent,
  changesApplied = [],
  isDataset = false
}) {
  if (!isOpen) return null;

  return (
    <div className="rewrite-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    }}>
      <div className="rewrite-modal-content" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '95vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px' }}>Rectify Bias</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Review AI-suggested changes to neutralize bias signals.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: '8px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Content Body - Split View */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: Original */}
          <div style={{ flex: 1, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
            <div style={{ padding: '12px 20px', backgroundColor: '#fef2f2', borderBottom: '1px solid #fee2e2', color: '#991b1b', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-round" style={{ fontSize: '16px' }}>warning</span>
              Original (Contains Bias Signals)
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, color: '#334155', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {isDataset ? JSON.stringify(originalContent, null, 2) : originalContent}
            </div>
          </div>

          {/* Right: Rewritten */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
            <div style={{ padding: '12px 20px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #dcfce3', color: '#166534', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-round" style={{ fontSize: '16px' }}>check_circle</span>
              Rewritten (Neutralized)
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, color: '#334155', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {isDataset ? JSON.stringify(rewrittenContent, null, 2) : rewrittenContent}
            </div>
          </div>

        </div>

        {/* Bottom: Changes Applied & Footer */}
        <div style={{ borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', maxHeight: '30vh' }}>

          <div style={{ padding: '16px 24px', overflowY: 'auto', borderBottom: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '14px' }}>Changes Applied ({changesApplied.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {changesApplied.map((change, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px', backgroundColor: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span className="material-icons-round" style={{ color: '#3b82f6', fontSize: '16px', marginTop: '2px' }}>edit_note</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#0f172a', fontWeight: '500', marginBottom: '4px' }}>
                      {change.action || ('Replaced "' + change.original + '" with "' + change.replacement + '"')}
                    </div>
                    <div style={{ color: '#64748b' }}>Reason: {change.reason}</div>
                  </div>
                </div>
              ))}
              {changesApplied.length === 0 && <span style={{ color: '#64748b', fontSize: '13px' }}>No changes required.</span>}
            </div>
          </div>

          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={() => {
              alert('PDF download would integrate with jsPDF here.');
            }} style={{
              padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span className="material-icons-round" style={{ fontSize: '18px' }}>download</span> Download Version
            </button>
            <button onClick={() => {
              if (onAccept) onAccept(rewrittenContent);
              onClose();
            }} style={{
              padding: '10px 24px', backgroundColor: '#3b82f6', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span className="material-icons-round" style={{ fontSize: '18px' }}>check</span> Accept Rewrite
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
