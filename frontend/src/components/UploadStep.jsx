import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  generateBiasedDataset, BIASED_DEMO_CONFIG,
  generateFairDataset,   FAIR_DEMO_CONFIG,
} from '../utils/demoDataset';
import { detectColumnTypes } from '../utils/biasCalculator';

// ── Input Method Tabs ──────────────────────────────────────────────────────
const TABS = [
  { id: 'upload', label: 'Upload File',   icon: 'upload_file'  },
  { id: 'paste',  label: 'Paste CSV',     icon: 'content_paste' },
  { id: 'demo',   label: 'Demo Datasets', icon: 'auto_awesome' },
];

const DEMO_DATASETS = [
  {
    config:    BIASED_DEMO_CONFIG,
    generate:  generateBiasedDataset,
    colorVar:  'var(--severe)',
    bgVar:     'var(--severe-bg)',
    borderVar: 'rgba(220,38,38,0.25)',
    barGrad:   'linear-gradient(90deg, #dc2626, #ea580c)',
    icon:      'warning',
    tagIcon:   'error_outline',
  },
  {
    config:    FAIR_DEMO_CONFIG,
    generate:  generateFairDataset,
    colorVar:  'var(--good)',
    bgVar:     'var(--good-bg)',
    borderVar: 'rgba(22,163,74,0.25)',
    barGrad:   'linear-gradient(90deg, #16a34a, #0891b2)',
    icon:      'verified',
    tagIcon:   'check_circle',
  },
];

export default function UploadStep({ onDataReady, context, onBack }) {
  const [activeTab,      setActiveTab]      = useState('upload');
  const [dragOver,       setDragOver]       = useState(false);
  const [csvText,        setCsvText]        = useState('');
  const [parsedData,     setParsedData]     = useState(null);
  const [columns,        setColumns]        = useState([]);
  const [columnTypes,    setColumnTypes]    = useState({});
  const [decisionCol,    setDecisionCol]    = useState('');
  const [sensitiveAttrs, setSensitiveAttrs] = useState([]);
  const [datasetName,    setDatasetName]    = useState('');
  const [error,          setError]          = useState('');
  const [isDemoLoaded,   setIsDemoLoaded]   = useState(false);
  const [demoType,       setDemoType]       = useState('');

  // ── Data processing ──────────────────────────────────────────────────────
  function processData(data, name) {
    if (!data || data.length === 0) {
      setError('The dataset appears to be empty or could not be parsed.');
      return;
    }
    const cols  = Object.keys(data[0]);
    const types = detectColumnTypes(data, cols);
    setParsedData(data);
    setColumns(cols);
    setColumnTypes(types);
    setDatasetName(name);
    setError('');

    const binaryCol      = cols.find((c) => types[c] === 'binary');
    const sensitiveGuess = cols.filter((c) => types[c] === 'categorical' && c !== binaryCol);
    if (binaryCol)             setDecisionCol(binaryCol);
    if (sensitiveGuess.length) setSensitiveAttrs(sensitiveGuess.slice(0, 3));
  }

  // ── Demo dataset loader ──────────────────────────────────────────────────
  function handleLoadDemo(dataset) {
    const { config, generate } = dataset;
    const data = generate();
    processData(data, config.name);
    setDecisionCol(config.decisionColumn);
    setSensitiveAttrs(config.sensitiveColumns);
    setIsDemoLoaded(true);
    setDemoType(config.type);
  }

  // ── File upload ──────────────────────────────────────────────────────────
  function handleFileUpload(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file (.csv).');
      return;
    }
    setIsDemoLoaded(false);
    setDemoType('');
    Papa.parse(file, {
      header:       true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`CSV parse error: ${result.errors[0].message}`);
          return;
        }
        processData(result.data, file.name.replace('.csv', ''));
      },
      error: (err) => setError(`Failed to read file: ${err.message}`),
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  }

  // ── CSV paste ────────────────────────────────────────────────────────────
  function handleParseCsv() {
    if (!csvText.trim()) { setError('Please paste CSV content first.'); return; }
    setIsDemoLoaded(false);
    setDemoType('');
    const result = Papa.parse(csvText.trim(), {
      header:        true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    if (result.errors.length > 0 && result.data.length === 0) {
      setError(`CSV parse error: ${result.errors[0].message}`);
      return;
    }
    processData(result.data, 'Pasted Dataset');
  }

  // ── Attribute toggles ────────────────────────────────────────────────────
  function toggleSensitiveAttr(col) {
    setSensitiveAttrs((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  function handleAnalyze() {
    if (!decisionCol)           { setError('Please select a decision column.'); return; }
    if (!sensitiveAttrs.length) { setError('Please select at least one sensitive attribute.'); return; }
    onDataReady({ data: parsedData, decisionCol, sensitiveAttrs, datasetName });
  }

  const previewRows = parsedData ? parsedData.slice(0, 5) : [];
  const canAnalyze  = parsedData && decisionCol && sensitiveAttrs.length > 0;

  return (
    <div className="upload-page">

      {/* ── Context banner (when launched from a specific use case) ───── */}
      {context && (
        <div className="upload-context-banner">
          <div className="upload-context-left">
            <div className="upload-context-label">
              <span className="material-icons-round" style={{ fontSize: 13 }}>folder_special</span>
              {context.category}
            </div>
            <div className="upload-context-title">{context.label || context.useCaseTitle}</div>
          </div>
          {onBack && (
            <button className="upload-context-back" onClick={onBack}>
              <span className="material-icons-round" style={{ fontSize: 15 }}>arrow_back</span>
              Change audit
            </button>
          )}
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="upload-hero">
        <div className="upload-hero-eyebrow">
          <span className="material-icons-round" style={{ fontSize: 13 }}>balance</span>
          AI Fairness Audit
        </div>
        <h1>
          {context ? (
            <><span className="highlight">Bias Audit</span><br/>{context.label || context.useCaseTitle}</>
          ) : (
            <>Detect <span className="highlight">Hidden Bias</span><br />in Your Data</>
          )}
        </h1>
        <p>
          {context
            ? `Upload your dataset to run a ${context.category} fairness audit — powered by multi-model AI analysis.`
            : 'Upload a CSV dataset, paste raw data, or use our demo to instantly surface fairness issues — powered by multi-model AI analysis.'}
        </p>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error">
          <span className="material-icons-round" style={{ fontSize: 20 }}>error_outline</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Input panel (tabs) ──────────────────────────────────────── */}
      {!parsedData && (
        <>
          {/* Tab bar */}
          <div className="input-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`input-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setError(''); }}
                id={`tab-${tab.id}`}
              >
                <span className="material-icons-round" style={{ fontSize: 17 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Upload File ─── */}
          {activeTab === 'upload' && (
            <div
              className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={(e) => handleFileUpload(e.target.files[0])}
              />
              <span className="material-icons-round dropzone-icon">upload_file</span>
              <p className="dropzone-text">Drag &amp; drop your CSV file here</p>
              <p className="dropzone-hint">
                or <span className="dropzone-link">click to browse</span> — any CSV with headers
              </p>
              <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['hiring_data.csv', 'loan_approvals.csv', 'admissions.csv'].map((ex) => (
                  <span key={ex} className="chip">{ex}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Paste CSV ─── */}
          {activeTab === 'paste' && (
            <div className="csv-paste-panel">
              <label htmlFor="csv-textarea">Paste CSV content below</label>
              <textarea
                id="csv-textarea"
                className="csv-textarea"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`id,gender,age,experience,hired\n1,Male,34,8,1\n2,Female,29,5,0\n3,Male,41,12,1\n4,Female,38,10,0\n...`}
                spellCheck={false}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  First row must be column headers. Supports comma-separated values.
                </span>
                <button
                  className="btn btn-gold csv-parse-btn"
                  onClick={handleParseCsv}
                  id="parse-csv-btn"
                  disabled={!csvText.trim()}
                >
                  <span className="material-icons-round" style={{ fontSize: 18 }}>play_arrow</span>
                  Parse &amp; Load
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Demo Datasets ─── */}
          {activeTab === 'demo' && (
            <div className="demo-panel">
              <div className="demo-panel-header">
                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--blue)' }}>info</span>
                <p>Choose a pre-built dataset to instantly see VectoFair in action. One contains real bias, one doesn't.</p>
              </div>

              <div className="demo-cards-grid">
                {DEMO_DATASETS.map((ds, idx) => {
                  const { config, colorVar, bgVar, borderVar, barGrad, icon, tagIcon } = ds;
                  const isBiased = config.type === 'biased';
                  return (
                    <button
                      key={config.name}
                      className="demo-card demo-card-v2"
                      onClick={() => handleLoadDemo(ds)}
                      id={`demo-${config.type}-btn`}
                      style={{
                        '--dc': colorVar,
                        '--dc-bg': bgVar,
                        '--dc-border': borderVar,
                        '--dc-bar': barGrad,
                        animationDelay: `${idx * 0.1}s`,
                      }}
                    >
                      {/* Top accent bar */}
                      <div className="demo-card-bar" />

                      {/* Badge */}
                      <div className="demo-badge-row">
                        <span className="demo-type-badge" style={{ background: bgVar, color: colorVar, border: `1px solid ${borderVar}` }}>
                          <span className="material-icons-round" style={{ fontSize: 12 }}>{tagIcon}</span>
                          {config.badge}
                        </span>
                        {isBiased && <span className="demo-live-chip">● Live Demo</span>}
                      </div>

                      {/* Icon */}
                      <div className="demo-card-icon" style={{ background: bgVar, color: colorVar }}>
                        <span className="material-icons-round" style={{ fontSize: 28 }}>{icon}</span>
                      </div>

                      <h3 className="demo-card-title">{config.name}</h3>
                      <p className="demo-card-desc">{config.description}</p>

                      {/* Stats row */}
                      <div className="demo-stats">
                        {config.stats.map((s) => (
                          <div key={s.label} className="demo-stat">
                            <span className="demo-stat-value" style={{ color: colorVar }}>{s.value}</span>
                            <span className="demo-stat-label">{s.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="demo-cta">
                        <span className="material-icons-round" style={{ fontSize: 16 }}>bolt</span>
                        Load &amp; Analyze
                      </div>

                      <div className="demo-arrow">
                        <span className="material-icons-round">arrow_forward</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Column Selector (after data loaded) ──────────────────────── */}
      {parsedData && (
        <div className="column-selector-card card" id="column-selector">
          <div className="card-body">
            {/* Loaded banner */}
            <div
              className="alert alert-info"
              style={{
                marginBottom: 22,
                ...(demoType === 'biased'
                  ? { background: 'var(--severe-bg)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--severe)' }
                  : demoType === 'fair'
                  ? { background: 'var(--good-bg)', border: '1px solid rgba(22,163,74,0.2)', color: 'var(--good)' }
                  : {}),
              }}
            >
              <span className="material-icons-round" style={{ fontSize: 20 }}>
                {demoType === 'biased' ? 'warning' : demoType === 'fair' ? 'verified' : 'check_circle'}
              </span>
              <div>
                <strong>{datasetName}</strong>&nbsp;loaded —&nbsp;
                {parsedData.length.toLocaleString()} rows × {columns.length} columns
                {isDemoLoaded && (
                  <span style={{ marginLeft: 6 }}>
                    ({demoType === 'biased' ? '⚠️ Demo — contains bias' : '✅ Demo — fair dataset'})
                  </span>
                )}
              </div>
              <button
                onClick={() => { setParsedData(null); setIsDemoLoaded(false); setDemoType(''); setError(''); setCsvText(''); }}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                  padding: '0 4px', whiteSpace: 'nowrap', opacity: 0.75,
                }}
              >
                ← Change
              </button>
            </div>

            {/* Data preview */}
            <p className="section-subtitle">Data Preview (first 5 rows)</p>
            <div className="data-preview">
              <table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>
                        {col}
                        <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>
                          {columnTypes[col] || 'unknown'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td key={col}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column config */}
            <p className="section-title">Configure Analysis</p>
            <p className="section-subtitle">
              Tell VectoFair which column is the decision outcome and which are sensitive demographic attributes.
            </p>

            <div className="form-section">
              <div className="form-group">
                <label>Decision Column (Outcome)</label>
                <select
                  id="decision-col-select"
                  className="form-select"
                  value={decisionCol}
                  onChange={(e) => setDecisionCol(e.target.value)}
                >
                  <option value="">Select decision column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col} ({columnTypes[col]})</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  e.g., "hired", "approved", "admitted" — must be binary (0/1 or yes/no)
                </span>
              </div>

              <div className="form-group">
                <label>Sensitive Attributes</label>
                <div className="checkbox-group">
                  {columns.filter((c) => c !== decisionCol).map((col) => (
                    <label key={col} className={`checkbox-chip ${sensitiveAttrs.includes(col) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={sensitiveAttrs.includes(col)}
                        onChange={() => toggleSensitiveAttr(col)}
                      />
                      {sensitiveAttrs.includes(col) && (
                        <span className="material-icons-round" style={{ fontSize: 13 }}>check</span>
                      )}
                      {col}
                    </label>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  e.g., gender, race, age — demographic features to audit for bias
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                id="analyze-btn"
                className="btn btn-primary btn-lg"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
              >
                <span className="material-icons-round">analytics</span>
                Analyze for Bias
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature highlights ────────────────────────────────────────── */}
      {!parsedData && (
        <div className="feature-grid">
          {[
            {
              icon: 'balance',
              color: 'var(--blue)',
              bg: 'var(--blue-dim)',
              title: '3 Fairness Metrics',
              desc: 'Demographic Parity, Equal Opportunity, Disparate Impact',
            },
            {
              icon: 'hub',
              color: 'var(--purple)',
              bg: 'var(--purple-dim)',
              title: 'Multi-Model AI Insights',
              desc: 'Plain-English explanations and actionable recommendations',
            },
            {
              icon: 'picture_as_pdf',
              color: 'var(--color-severe)',
              bg: 'var(--color-severe-bg)',
              title: 'Audit Report PDF',
              desc: 'Download a complete fairness audit for stakeholders',
            },
            {
              icon: 'bar_chart',
              color: 'var(--color-fair)',
              bg: 'var(--color-fair-bg)',
              title: 'Live Dashboard',
              desc: 'Interactive charts powered by Google Charts',
            },
          ].map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                <span className="material-icons-round">{f.icon}</span>
              </div>
              <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>{f.title}</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
