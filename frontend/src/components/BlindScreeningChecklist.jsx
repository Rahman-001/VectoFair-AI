// VectoFair — Blind Screening Checklist Component

export default function BlindScreeningChecklist({ checklist, resumes }) {
  const priorityColors = {
    critical: { color: '#dc2626', bg: '#fef2f2', icon: 'error' },
    high:     { color: '#d97706', bg: '#fffbeb', icon: 'warning' },
    medium:   { color: '#2563eb', bg: '#eff6ff', icon: 'info' },
  };

  return (
    <div className="blind-checklist-page">
      {/* Header */}
      <div className="checklist-header-card">
        <div className="checklist-header-icon">
          <span className="material-icons-round" style={{ fontSize: 28, color: '#4338ca' }}>visibility_off</span>
        </div>
        <div>
          <h3 className="checklist-title">Blind Screening Implementation Guide</h3>
          <p className="checklist-subtitle">
            Remove these fields from resumes before initial screening to eliminate identity-based bias.
            Implement via your ATS settings or a manual redaction process.
          </p>
        </div>
      </div>

      {/* Priority legend */}
      <div className="checklist-legend">
        {Object.entries(priorityColors).map(([p, cfg]) => (
          <div key={p} className="legend-item">
            <span className="material-icons-round" style={{ fontSize: 14, color: cfg.color }}>{cfg.icon}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: cfg.color, textTransform: 'capitalize' }}>{p}</span>
          </div>
        ))}
      </div>

      {/* Checklist items */}
      <div className="checklist-items">
        {checklist.map((item, i) => {
          const cfg = priorityColors[item.priority] || priorityColors.medium;
          return (
            <div
              key={i}
              className={`checklist-item ${item.flaggedInPool ? 'checklist-item-flagged' : ''}`}
              style={{ borderLeft: `3px solid ${cfg.color}` }}
            >
              <div className="checklist-item-left">
                <div className="checklist-priority-badge" style={{ background: cfg.bg, color: cfg.color }}>
                  <span className="material-icons-round" style={{ fontSize: 12 }}>{cfg.icon}</span>
                  {item.priority}
                </div>
                <div className="checklist-field-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <span className="material-icons-round" style={{ fontSize: 18 }}>{item.icon}</span>
                </div>
              </div>

              <div className="checklist-item-body">
                <div className="checklist-field-name">
                  {item.field}
                  {item.flaggedInPool && (
                    <span className="checklist-pool-flag">
                      <span className="material-icons-round" style={{ fontSize: 11 }}>flag</span>
                      Found in this pool
                    </span>
                  )}
                </div>
                <div className="checklist-field-reason">{item.reason}</div>
              </div>

              <div className="checklist-item-right">
                <span className="material-icons-round" style={{ fontSize: 18, color: '#94a3b8' }}>check_box_outline_blank</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ATS recommendations */}
      <div className="ats-recommendations">
        <div className="ats-rec-header">
          <span className="material-icons-round" style={{ fontSize: 16, color: '#4338ca' }}>settings</span>
          <strong>ATS Implementation Steps</strong>
        </div>
        <div className="ats-steps">
          {[
            { step: 1, text: 'Configure your ATS to auto-redact name fields on inbound applications', icon: 'person_remove' },
            { step: 2, text: 'Set up a candidate ID system to track applications without identity', icon: 'tag' },
            { step: 3, text: 'Remove graduation year from required fields in your application form', icon: 'event_busy' },
            { step: 4, text: 'Enable address-free applications (city/state sufficient for most roles)', icon: 'location_off' },
            { step: 5, text: 'Train hiring managers on structured interviews with standardized scoring rubrics', icon: 'school' },
          ].map((s) => (
            <div key={s.step} className="ats-step">
              <div className="ats-step-num">{s.step}</div>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#4338ca' }}>{s.icon}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export note */}
      <div className="checklist-export-note">
        <span className="material-icons-round" style={{ fontSize: 16, color: '#16a34a' }}>picture_as_pdf</span>
        <span>Download the full batch PDF report to share this checklist with your HR team and ATS vendor.</span>
      </div>
    </div>
  );
}
