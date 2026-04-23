import React, { useState } from 'react';

/**
 * Pill badge displaying regulatory compliance status.
 * @param {string} lawName - The short name of the law (e.g. "Title VII")
 * @param {string} citation - The full citation or description
 * @param {string} status - "violation" (red), "risk" (amber), or "guidance" (blue)
 */
export default function ComplianceBadge({ lawName, citation, status = 'guidance' }) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    violation: { bg: '#fef2f2', text: '#ef4444', border: '#fca5a5', icon: 'gavel' },
    risk:      { bg: '#fffbeb', text: '#d97706', border: '#fcd34d', icon: 'warning' },
    guidance:  { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe', icon: 'info' },
  };

  const theme = colors[status] || colors.guidance;

  return (
    <div 
      className="compliance-badge"
      onClick={() => setExpanded(!expanded)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        backgroundColor: theme.bg,
        border: '1px solid ' + theme.border,
        borderRadius: expanded ? '8px' : '999px',
        padding: expanded ? '8px 12px' : '4px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        maxWidth: '400px',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '16px', color: theme.text }}>
          {theme.icon}
        </span>
        <span style={{ color: theme.text, fontWeight: '600' }}>
          {lawName}
        </span>
        <span className="material-symbols-rounded" style={{ fontSize: '14px', color: theme.text, marginLeft: 'auto', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          expand_more
        </span>
      </div>
      
      {expanded && (
        <div style={{ marginTop: '6px', color: theme.text, fontSize: '12px', lineHeight: '1.4', opacity: 0.9 }}>
          {citation}
        </div>
      )}
    </div>
  );
}
