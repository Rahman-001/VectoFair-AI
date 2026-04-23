// VectoFair — Resume Dashboard
// Main results view: Tab 1 Individual Reports | Tab 2 Pool Analysis | Tab 3 Blind Screening

import { useState, useMemo } from 'react';
import ResumeReportCard from './ResumeReportCard';
import IdenticalPairCallout from './IdenticalPairCallout';
import BatchPoolAnalysis from './BatchPoolAnalysis';
import BlindScreeningChecklist from './BlindScreeningChecklist';
import { downloadBatchResumePDF, downloadSingleResumePDF } from '../utils/pdfGenerator';
import { runBatchAnalysis, generateBlindScreeningChecklist } from '../utils/batchBiasComparator';

const SORT_OPTIONS = [
  { id: 'score-high', label: 'Bias Score: High→Low', icon: 'arrow_downward' },
  { id: 'score-low',  label: 'Bias Score: Low→High', icon: 'arrow_upward' },
  { id: 'signals',    label: 'Most Signals', icon: 'radar' },
  { id: 'category',   label: 'Name Category', icon: 'sort_by_alpha' },
];

export default function ResumeDashboard({ analyzedResumes, onReset, isBatch }) {
  const [activeTab, setActiveTab] = useState('individual');
  const [sortBy,    setSortBy]    = useState('score-high');
  const [filterRisk, setFilterRisk] = useState('all');

  const pairA = analyzedResumes.find((r) => r.isPairA);
  const pairB = analyzedResumes.find((r) => r.isPairB);

  const batchStats = useMemo(() => {
    if (!isBatch || analyzedResumes.length < 2) return null;
    return runBatchAnalysis(analyzedResumes);
  }, [analyzedResumes, isBatch]);

  const checklist = useMemo(() => generateBlindScreeningChecklist(analyzedResumes), [analyzedResumes]);

  const sortedResumes = useMemo(() => {
    let arr = [...analyzedResumes];

    // Apply filter
    if (filterRisk !== 'all') {
      arr = arr.filter((r) => {
        const score = r.biasVulnerabilityScore || 0;
        const risk  = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
        return risk === filterRisk;
      });
    }

    // Apply sort
    switch (sortBy) {
      case 'score-high': return arr.sort((a, b) => (b.biasVulnerabilityScore || 0) - (a.biasVulnerabilityScore || 0));
      case 'score-low':  return arr.sort((a, b) => (a.biasVulnerabilityScore || 0) - (b.biasVulnerabilityScore || 0));
      case 'signals':    return arr.sort((a, b) => (b.signals?.length || 0) - (a.signals?.length || 0));
      case 'category':   return arr.sort((a, b) => (a.nameCategory || '').localeCompare(b.nameCategory || ''));
      default:           return arr;
    }
  }, [analyzedResumes, sortBy, filterRisk]);

  const totalHigh   = analyzedResumes.filter((r) => (r.biasVulnerabilityScore || 0) >= 60).length;
  const totalMedium = analyzedResumes.filter((r) => { const s = r.biasVulnerabilityScore || 0; return s >= 35 && s < 60; }).length;
  const totalLow    = analyzedResumes.filter((r) => (r.biasVulnerabilityScore || 0) < 35).length;

  function handleDownloadPDF() {
    if (isBatch && batchStats) {
      downloadBatchResumePDF({ analyzedResumes, batchStats });
    } else if (analyzedResumes.length === 1) {
      downloadSingleResumePDF({ resume: analyzedResumes[0] });
    }
  }

  const tabs = [
    { id: 'individual', label: `Individual Reports (${analyzedResumes.length})`, icon: 'description' },
    ...(isBatch ? [
      { id: 'pool',      label: 'Pool Analysis', icon: 'bar_chart' },
      { id: 'checklist', label: 'Blind Screening', icon: 'visibility_off' },
    ] : [
      { id: 'checklist', label: 'Blind Screening', icon: 'visibility_off' },
    ]),
  ];

  return (
    <div className="resume-dashboard">
      {/* Dashboard header */}
      <div className="rd-header">
        <div className="rd-header-left">
          <div className="rd-eyebrow">
            <span className="material-icons-round" style={{ fontSize: 13 }}>description</span>
            Resume Screening Audit Results
          </div>
          <h2 className="rd-title">
            {isBatch ? `${analyzedResumes.length} Resumes Analyzed` : 'Resume Bias Report'}
          </h2>
          {batchStats && (
            <div className="rd-score-badge" style={{
              background: batchStats.poolFairnessScore >= 70 ? '#f0fdf4' : batchStats.poolFairnessScore >= 45 ? '#fffbeb' : '#fef2f2',
              color: batchStats.poolFairnessScore >= 70 ? '#16a34a' : batchStats.poolFairnessScore >= 45 ? '#d97706' : '#dc2626',
            }}>
              Pool Fairness Score: <strong>{batchStats.poolFairnessScore}/100</strong>
            </div>
          )}
        </div>
        <div className="rd-header-actions">
          <button className="btn btn-success" onClick={handleDownloadPDF} id="resume-download-pdf-btn">
            <span className="material-icons-round">picture_as_pdf</span>
            Download Report
          </button>
          <button className="btn btn-secondary" onClick={onReset} id="resume-new-audit-btn">
            <span className="material-icons-round">refresh</span>
            New Audit
          </button>
        </div>
      </div>

      {/* Summary stats strip */}
      <div className="rd-stats-strip">
        {[
          { label: 'High Risk', count: totalHigh, color: '#dc2626', bg: '#fef2f2', icon: 'warning' },
          { label: 'Medium Risk', count: totalMedium, color: '#d97706', bg: '#fffbeb', icon: 'info' },
          { label: 'Low Risk', count: totalLow, color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
          { label: 'Total Signals', count: analyzedResumes.reduce((s, r) => s + (r.signals?.length || 0), 0), color: '#4338ca', bg: '#eff6ff', icon: 'radar' },
        ].map((s) => (
          <div key={s.label} className="rd-stat-card" style={{ borderTop: `3px solid ${s.color}`, background: s.bg }}>
            <span className="material-icons-round" style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
            <div className="rd-stat-num" style={{ color: s.color }}>{s.count}</div>
            <div className="rd-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Identical pair callout — only in batch mode */}
      {isBatch && pairA && pairB && activeTab === 'individual' && (
        <IdenticalPairCallout
          pairA={pairA}
          pairB={pairB}
          onViewResume={(r) => {
            const el = document.getElementById(`resume-card-${r.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      {/* Tab bar */}
      <div className="rd-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`rd-tab ${activeTab === tab.id ? 'rd-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            id={`resume-tab-${tab.id}`}
          >
            <span className="material-icons-round" style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Individual Reports */}
      {activeTab === 'individual' && (
        <div className="rd-tab-content">
          {/* Controls */}
          {isBatch && (
            <div className="rd-controls">
              <div className="rd-sort-group">
                <label>Sort by:</label>
                <select
                  className="form-select"
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  id="resume-sort-select"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="rd-filter-group">
                {['all', 'HIGH', 'MEDIUM', 'LOW'].map((r) => (
                  <button
                    key={r}
                    className={`rd-filter-btn ${filterRisk === r ? 'rd-filter-active' : ''}`}
                    onClick={() => setFilterRisk(r)}
                  >
                    {r === 'all' ? 'All' : r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resume cards */}
          <div className="rd-cards-list">
            {sortedResumes.map((resume, i) => (
              <div key={resume.id || i} id={`resume-card-${resume.id}`}>
                <ResumeReportCard
                  resume={resume}
                  index={analyzedResumes.indexOf(resume)}
                  defaultExpanded={!isBatch && analyzedResumes.length === 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Pool Analysis */}
      {activeTab === 'pool' && (
        <div className="rd-tab-content">
          <BatchPoolAnalysis batchStats={batchStats} />
        </div>
      )}

      {/* Tab: Blind Screening Checklist */}
      {activeTab === 'checklist' && (
        <div className="rd-tab-content">
          <BlindScreeningChecklist checklist={checklist} resumes={analyzedResumes} />
        </div>
      )}

      {/* Bottom CTA */}
      <div className="rd-bottom-cta">
        <div>
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Ready to share your findings?</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
            Download a complete PDF audit report — includes bias scores, legal risks, and blind screening implementation guide.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleDownloadPDF} id="resume-download-pdf-bottom-btn">
          <span className="material-icons-round">download</span>
          Download Full Report
        </button>
      </div>
    </div>
  );
}
