// VectoFair — Resume Uploader
// Three input modes: PDF Upload | Paste Text | Demo Dataset

import { useState, useCallback } from 'react';
import { extractResumeSignals } from '../utils/resumeSignalExtractor';
import { analyzeResumeForBias } from '../utils/aiClient';
import { RESUME_DEMO_DATA, DEMO_CONFIG } from '../data/resumeDemoData';

const TABS = [
  { id: 'upload', label: 'PDF / Text Upload', icon: 'upload_file' },
  { id: 'paste',  label: 'Paste Resume',       icon: 'content_paste' },
  { id: 'demo',   label: 'Demo Dataset',        icon: 'auto_awesome' },
];

// ── PDF text extraction via pdf.js ─────────────────────────────────────────────
async function extractTextFromPDF(file) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs').catch(
    () => import('pdfjs-dist')
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map((i) => i.str).join(' ') + '\n';
  }
  return fullText.trim();
}

async function extractTextFromFile(file) {
  if (file.name.endsWith('.pdf')) return extractTextFromPDF(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ── Single resume analysis pipeline ──────────────────────────────────────────
async function analyzeResume(text, meta = {}) {
  const signals     = extractResumeSignals(text);
  const aiAnalysis  = await analyzeResumeForBias(text, signals);

  return {
    ...signals,
    ...meta,
    originalText:  text,
    aiAnalysis,
    biasVulnerabilityScore: aiAnalysis?.biasScore ?? signals.biasVulnerabilityScore,
  };
}

export default function ResumeUploader({ onAnalysisComplete, context, onBack }) {
  const [activeTab,    setActiveTab]    = useState('demo');
  const [dragOver,     setDragOver]     = useState(false);
  const [pasteText,    setPasteText]    = useState('');
  const [files,        setFiles]        = useState([]);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [progress,     setProgress]     = useState({ current: 0, total: 0, label: '' });
  const [error,        setError]        = useState('');

  // ── File drop handler ────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files)
      .filter((f) => f.name.endsWith('.pdf') || f.name.endsWith('.txt'));
    if (!dropped.length) { setError('Please drop PDF or .txt resume files.'); return; }
    setFiles(dropped.slice(0, 50));
    setError('');
  }

  function handleFileChange(e) {
    const picked = Array.from(e.target.files)
      .filter((f) => f.name.endsWith('.pdf') || f.name.endsWith('.txt'));
    if (!picked.length) { setError('Please select PDF or .txt resume files.'); return; }
    setFiles(picked.slice(0, 50));
    setError('');
  }

  // ── Batch PDF/file analysis ──────────────────────────────────────────────────
  async function handleAnalyzeFiles() {
    if (!files.length) { setError('Please select at least one file.'); return; }
    setAnalyzing(true);
    setError('');
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, label: `Extracting text from resume ${i + 1} of ${files.length}…` });
      try {
        const text = await extractTextFromFile(file);
        setProgress({ current: i + 1, total: files.length, label: `Analyzing resume ${i + 1} of ${files.length} for bias signals…` });
        const result = await analyzeResume(text, { id: `F${i + 1}`, label: file.name });
        results.push(result);
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        results.push({
          id: `F${i + 1}`, label: file.name, error: err.message,
          candidateName: file.name, signals: [], signalCount: 0, biasVulnerabilityScore: 0,
        });
      }
    }

    setAnalyzing(false);
    onAnalysisComplete({ resumes: results, isBatch: results.length > 1 });
  }

  // ── Single paste analysis ────────────────────────────────────────────────────
  async function handleAnalyzePaste() {
    if (!pasteText.trim()) { setError('Please paste resume text first.'); return; }
    setAnalyzing(true);
    setError('');
    setProgress({ current: 1, total: 1, label: 'Analyzing resume for bias signals…' });
    try {
      const result = await analyzeResume(pasteText, { id: 'P1', label: 'Pasted Resume' });
      setAnalyzing(false);
      onAnalysisComplete({ resumes: [result], isBatch: false });
    } catch (err) {
      setAnalyzing(false);
      setError('Analysis failed: ' + err.message);
    }
  }

  // ── Demo dataset analysis ────────────────────────────────────────────────────
  async function handleLoadDemo() {
    setAnalyzing(true);
    setError('');
    const results = [];

    for (let i = 0; i < RESUME_DEMO_DATA.length; i++) {
      const demo = RESUME_DEMO_DATA[i];
      setProgress({
        current: i + 1,
        total: RESUME_DEMO_DATA.length,
        label: `Analyzing resume ${i + 1} of ${RESUME_DEMO_DATA.length}: ${demo.label}…`,
      });
      try {
        const signals = extractResumeSignals(demo.text);
        // For demo mode we use client-side signals + expected scores rather than calling AI for all 20
        // (avoids rate limits), but still call AI for individual analysis when expanded
        results.push({
          ...signals,
          id: demo.id,
          label: demo.label,
          isPairA: demo.isPairA || false,
          isPairB: demo.isPairB || false,
          nameCategory: demo.nameCategory || signals.nameCategory,
          originalText: demo.text,
          biasVulnerabilityScore: demo.expectedScore ?? signals.biasVulnerabilityScore,
          aiAnalysis: null, // Loaded lazily when card is expanded
        });
        // Small delay for UX progress
        await new Promise((r) => setTimeout(r, 80));
      } catch (err) {
        console.error('Demo analysis error:', err);
      }
    }

    setAnalyzing(false);
    onAnalysisComplete({ resumes: results, isBatch: true });
  }

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="upload-page">
      {/* Context banner */}
      {context && (
        <div className="upload-context-banner">
          <div className="upload-context-left">
            <div className="upload-context-label">
              <span className="material-icons-round" style={{ fontSize: 13 }}>folder_special</span>
              {context.category}
            </div>
            <div className="upload-context-title">{context.useCaseTitle}</div>
          </div>
          {onBack && (
            <button className="upload-context-back" onClick={onBack}>
              <span className="material-icons-round" style={{ fontSize: 15 }}>arrow_back</span>
              Change audit
            </button>
          )}
        </div>
      )}

      {/* Hero */}
      <div className="upload-hero">
        <div className="upload-hero-eyebrow">
          <span className="material-icons-round" style={{ fontSize: 13 }}>description</span>
          Resume Screening Audit
        </div>
        <h1>
          Detect <span className="highlight">Hidden Bias</span><br />Before Screening Begins
        </h1>
        <p>
          Upload resume files, paste text, or use our 20-resume demo to instantly surface bias signals — name, address, university, age, gender, and more.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <span className="material-icons-round" style={{ fontSize: 20 }}>error_outline</span>
          <span>{error}</span>
        </div>
      )}

      {/* Analysis progress */}
      {analyzing && (
        <div className="analysis-progress-card">
          <div className="analysis-progress-header">
            <div className="analysis-spinner" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Analyzing Resumes for Bias Signals</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{progress.label}</div>
            </div>
          </div>
          {progress.total > 1 && (
            <div className="analysis-progress-bar-wrap">
              <div className="analysis-progress-bar" style={{ width: `${progressPct}%` }} />
              <span className="analysis-progress-label">{progressPct}% — {progress.current} of {progress.total}</span>
            </div>
          )}
        </div>
      )}

      {!analyzing && (
        <>
          {/* Tab bar */}
          <div className="input-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`input-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setError(''); }}
                id={`resume-tab-${tab.id}`}
              >
                <span className="material-icons-round" style={{ fontSize: 17 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Upload ── */}
          {activeTab === 'upload' && (
            <div>
              <div
                className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.txt"
                  multiple
                  id="resume-file-input"
                  onChange={handleFileChange}
                />
                <span className="material-icons-round dropzone-icon">upload_file</span>
                <p className="dropzone-text">Drag &amp; drop resume files here</p>
                <p className="dropzone-hint">
                  or <span className="dropzone-link">click to browse</span> — PDF or plain text, up to 50 files
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                  {['resume.pdf', 'cv.pdf', 'resume.txt'].map((ex) => (
                    <span key={ex} className="chip">{ex}</span>
                  ))}
                </div>
              </div>

              {files.length > 0 && (
                <div className="resume-files-preview">
                  <div className="files-preview-header">
                    <span className="material-icons-round" style={{ fontSize: 16, color: '#4338ca' }}>folder</span>
                    <strong>{files.length} file{files.length !== 1 ? 's' : ''} selected</strong>
                    <button
                      onClick={() => setFiles([])}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12 }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="files-list">
                    {files.slice(0, 10).map((f, i) => (
                      <div key={i} className="file-chip">
                        <span className="material-icons-round" style={{ fontSize: 14, color: '#dc2626' }}>picture_as_pdf</span>
                        {f.name}
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>({(f.size / 1024).toFixed(0)} KB)</span>
                      </div>
                    ))}
                    {files.length > 10 && (
                      <div className="file-chip" style={{ color: '#64748b' }}>
                        +{files.length - 10} more files
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleAnalyzeFiles}
                    id="analyze-resumes-btn"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                  >
                    <span className="material-icons-round">document_scanner</span>
                    Analyze {files.length} Resume{files.length !== 1 ? 's' : ''} for Bias
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Paste ── */}
          {activeTab === 'paste' && (
            <div className="csv-paste-panel">
              <label htmlFor="resume-textarea">Paste full resume text below</label>
              <textarea
                id="resume-textarea"
                className="csv-textarea"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={16}
                placeholder={`John Smith\njohn.smith@email.com | (555) 123-4567\n\nEDUCATION\nB.S. Computer Science — Yale University, 2018\n\nEXPERIENCE\nSoftware Engineer — TechCorp, 2018–Present\n• Built scalable APIs serving 1M users\n\nSKILLS\nPython, React, AWS...`}
                spellCheck={false}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  Paste any resume format — plain text works best
                </span>
                <button
                  className="btn btn-gold csv-parse-btn"
                  onClick={handleAnalyzePaste}
                  id="analyze-paste-btn"
                  disabled={!pasteText.trim()}
                >
                  <span className="material-icons-round" style={{ fontSize: 18 }}>document_scanner</span>
                  Analyze for Bias
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Demo Dataset ── */}
          {activeTab === 'demo' && (
            <div className="demo-panel">
              <div className="demo-panel-header">
                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--blue)' }}>info</span>
                <p>
                  Load 20 synthetic resumes spanning Anglo, African-American, Hispanic, Asian, and other name categories —
                  calibrated to demonstrate real-world bias patterns including the famous Bertrand &amp; Mullainathan identical-qualification experiment.
                </p>
              </div>

              {/* Demo card */}
              <button
                className="demo-card demo-card-v2"
                onClick={handleLoadDemo}
                id="demo-load-btn"
                style={{
                  '--dc': 'var(--blue)',
                  '--dc-bg': 'var(--blue-dim)',
                  '--dc-border': 'rgba(37,99,235,0.25)',
                  '--dc-bar': 'linear-gradient(90deg, #2563eb, #4338ca)',
                  width: '100%',
                  maxWidth: 540,
                  margin: '0 auto',
                }}
              >
                <div className="demo-card-bar" />
                <div className="demo-badge-row">
                  <span className="demo-type-badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(37,99,235,0.25)' }}>
                    <span className="material-icons-round" style={{ fontSize: 12 }}>auto_awesome</span>
                    Judge Demo
                  </span>
                  <span className="demo-live-chip">● Fully Offline</span>
                </div>
                <div className="demo-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <span className="material-icons-round" style={{ fontSize: 28 }}>description</span>
                </div>
                <h3 className="demo-card-title">{DEMO_CONFIG.name}</h3>
                <p className="demo-card-desc">{DEMO_CONFIG.description}</p>
                <div className="demo-stats">
                  {DEMO_CONFIG.stats.map((s) => (
                    <div key={s.label} className="demo-stat">
                      <span className="demo-stat-value" style={{ color: '#2563eb' }}>{s.value}</span>
                      <span className="demo-stat-label">{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="demo-cta">
                  <span className="material-icons-round" style={{ fontSize: 16 }}>bolt</span>
                  Try 20 Sample Resumes
                </div>
                <div className="demo-arrow">
                  <span className="material-icons-round">arrow_forward</span>
                </div>
              </button>

              {/* Highlights */}
              <div className="demo-highlights">
                {[
                  { icon: 'science', title: 'Identical Pair Experiment', desc: 'Resumes 19 & 20 — same qualifications, different names, very different bias scores' },
                  { icon: 'school', title: 'HBCU & Prestige Bias', desc: 'Resume 16 highlights Howard University screening bias' },
                  { icon: 'cake', title: 'Age Discrimination (ADEA)', desc: 'Resume 14 triggers age discrimination risk (estimated age 57)' },
                  { icon: 'accessibility', title: 'Disability Disclosure (ADA)', desc: 'Resume 18 demonstrates highest legal risk flag' },
                ].map((h) => (
                  <div key={h.title} className="demo-highlight-card">
                    <span className="material-icons-round" style={{ fontSize: 20, color: '#4338ca' }}>{h.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{h.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature highlights */}
          <div className="feature-grid">
            {[
              { icon: 'badge', color: 'var(--blue)', bg: 'var(--blue-dim)', title: '8 Bias Signal Types', desc: 'Name, address, university, age, gender, socioeconomic, national origin, disability' },
              { icon: 'hub', color: 'var(--purple)', bg: 'var(--purple-dim)', title: 'Multi-Model AI Analysis', desc: 'OpenRouter → Mistral → offline fallback chain for every resume' },
              { icon: 'auto_fix_high', color: '#16a34a', bg: '#f0fdf4', title: 'AI Bias Rewriter', desc: 'Generates a bias-free anonymized version for blind screening' },
              { icon: 'balance', color: 'var(--color-severe)', bg: 'var(--color-severe-bg)', title: 'Legal Framework', desc: 'Title VII, ADEA, ADA, IRCA — mapped to every signal detected' },
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
        </>
      )}
    </div>
  );
}
