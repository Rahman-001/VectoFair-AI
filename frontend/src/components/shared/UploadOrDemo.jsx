import React, { useCallback } from 'react';
import Papa from 'papaparse';

/**
 * UploadOrDemo — shared landing panel for every VectoFair audit module.
 *
 * Props:
 *   title         — Module title (string)
 *   description   — Short description (string)
 *   icon          — Material icon name (string)
 *   iconColor     — Icon color (string, default #4f46e5)
 *   onDemoLoad    — () => void — called when user clicks demo button
 *   onCSVLoad     — (parsedRows) => void — called with parsed CSV rows
 *   demoLabel     — Button label for demo (string, e.g. "Run Demo — 600 Applicants")
 *   columns       — Array of { name, type, note? } for required CSV columns
 *   loading       — bool flag while loading
 *   csvError      — string | null — error message to show
 *   extraNote     — optional ReactNode rendered below columns (e.g. disclaimer)
 *   whatWeDetect  — optional string[] of bullet points describing what the module audits
 */
export default function UploadOrDemo({
  title,
  description,
  icon = 'analytics',
  iconColor = '#4f46e5',
  onDemoLoad,
  onCSVLoad,
  demoLabel = 'Run Demo Dataset',
  columns = [],
  loading = false,
  csvError = null,
  extraNote = null,
  whatWeDetect = [],
}) {
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: ({ data: rows, errors }) => {
        if (errors.length > 0) {
          // surface error through parent via csvError state
          if (onCSVLoad) onCSVLoad(null, errors[0].message);
          return;
        }
        if (onCSVLoad) onCSVLoad(rows, null);
      },
    });
    // Reset input so same file can be reloaded
    e.target.value = '';
  }, [onCSVLoad]);

  const sensitiveColumns = columns.filter(c => c.sensitive);
  const regularColumns = columns.filter(c => !c.sensitive);

  return (
    <div style={{ maxWidth: '680px', margin: '56px auto', padding: '0 20px' }}>

      {/* Icon + Title */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{
          width: '72px', height: '72px', margin: '0 auto 20px',
          borderRadius: '18px', backgroundColor: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(15,23,42,0.25)',
        }}>
          <span className="material-icons-round" style={{ fontSize: '36px', color: iconColor }}>{icon}</span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px', lineHeight: 1.2 }}>
          {title}
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.7', maxWidth: '500px', margin: '0 auto' }}>
          {description}
        </p>

        {/* What this module detects */}
        {whatWeDetect.length > 0 && (
          <div style={{
            marginTop: '20px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            textAlign: 'left',
            maxWidth: '500px',
            margin: '20px auto 0',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: '700', color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span className="material-icons-round" style={{ fontSize: '14px', color: iconColor }}>policy</span>
              What this module audits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {whatWeDetect.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span className="material-icons-round" style={{ fontSize: '14px', color: iconColor, marginTop: '1px', flexShrink: 0 }}>check_circle</span>
                  <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>

        {/* Demo Button */}
        {onDemoLoad && (
          <button
            onClick={onDemoLoad}
            disabled={loading}
            style={{
              width: '100%', padding: '18px 24px',
              backgroundColor: '#0f172a', color: '#fff',
              border: 'none', borderRadius: '12px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: '700', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.30)',
              transition: 'opacity 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '20px' }}>science</span>
            {loading ? 'Loading demo data…' : demoLabel}
          </button>
        )}

        {/* Divider */}
        {onDemoLoad && onCSVLoad && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>OR UPLOAD YOUR DATA</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          </div>
        )}

        {/* Upload Button */}
        {onCSVLoad && (
          <label style={{
            width: '100%', padding: '18px 24px',
            backgroundColor: '#fff', color: '#0f172a',
            border: '2px dashed #cbd5e1', borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600', fontSize: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = iconColor; e.currentTarget.style.backgroundColor = '#f8faff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#fff'; }}
          >
            <span className="material-icons-round" style={{ color: '#64748b', fontSize: '20px' }}>upload_file</span>
            Upload CSV File
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        )}

        {/* CSV Error */}
        {csvError && (
          <div style={{
            color: '#dc2626', fontSize: '13px',
            padding: '10px 14px', backgroundColor: '#fef2f2',
            borderRadius: '8px', border: '1px solid #fecaca',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>error_outline</span>
            {csvError}
          </div>
        )}
      </div>

      {/* CSV Schema Reference */}
      {columns.length > 0 && (
        <div style={{
          backgroundColor: '#f8fafc', borderRadius: '12px',
          padding: '20px', border: '1px solid #e2e8f0',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: '700', color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span className="material-icons-round" style={{ fontSize: '14px' }}>table_chart</span>
            Required CSV Columns
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {regularColumns.map(col => (
              <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{
                  fontSize: '12px', fontFamily: 'monospace',
                  backgroundColor: '#e2e8f0', color: '#1e293b',
                  padding: '2px 8px', borderRadius: '4px', fontWeight: '600',
                }}>{col.name}</code>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{col.type}</span>
                {col.note && <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>— {col.note}</span>}
              </div>
            ))}
            {sensitiveColumns.length > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-icons-round" style={{ fontSize: '13px' }}>shield</span>
                  Sensitive attributes (used for analysis only — never stored):
                </div>
                {sensitiveColumns.map(col => (
                  <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{
                      fontSize: '12px', fontFamily: 'monospace',
                      backgroundColor: '#fffbeb', color: '#92400e',
                      padding: '2px 8px', borderRadius: '4px', fontWeight: '600',
                      border: '1px solid #fde68a',
                    }}>{col.name}</code>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{col.type}</span>
                    {col.note && <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>— {col.note}</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {extraNote && <div style={{ marginTop: '16px' }}>{extraNote}</div>}
    </div>
  );
}
