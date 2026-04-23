// VectoFair — PDF Audit Report Generator
// jsPDF v4 + jspdf-autotable — clean, verified API calls only

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Colour palette (RGB arrays) ───────────────────────────────────────────────
const C = {
  blue:       [66, 133, 244],
  blueLight:  [232, 240, 254],
  severe:     [220, 53, 69],
  severeLight:[255, 235, 238],
  mild:       [224, 130, 0],
  mildLight:  [255, 248, 220],
  fair:       [25, 135, 84],
  fairLight:  [212, 237, 218],
  ink:        [30, 30, 35],
  gray1:      [248, 249, 250],
  gray2:      [108, 117, 125],
  gray3:      [222, 226, 230],
  white:      [255, 255, 255],
};

function severityColors(verdict) {
  if (verdict === 'SEVERE BIAS') return { bg: C.severeLight, fg: C.severe };
  if (verdict === 'MILD BIAS')   return { bg: C.mildLight,   fg: C.mild   };
  return                                 { bg: C.fairLight,   fg: C.fair   };
}

function gradeColor(grade) {
  return ({ A: C.fair, B: C.fair, C: C.mild, D: C.severe, F: C.severe })[grade] || C.gray2;
}

// ── Helper: draw a filled rounded rect (safe in jsPDF v4) ────────────────────
function rRect(doc, x, y, w, h, r, style = 'F') {
  doc.roundedRect(x, y, w, h, r, r, style);
}

// ── Header band (every inner page) ───────────────────────────────────────────
function drawHeader(doc, pageWidth, text) {
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 14, 13);
}

// ── Footer (every page) ──────────────────────────────────────────────────────
function drawFooter(doc, pageWidth, pageHeight, num) {
  doc.setDrawColor(...C.gray3);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
  doc.setTextColor(...C.gray2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `VectoFair AI Bias Audit  ·  Page ${num}  ·  Powered by Multi-Model AI`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateAuditPDF({ datasetInfo, findings, explanations, scoreResult }) {
  const doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW        = doc.internal.pageSize.getWidth();
  const PH        = doc.internal.pageSize.getHeight();
  const M         = 16;   // margin
  const CW        = PW - M * 2;
  let   pageNum   = 1;

  // ═══ COVER PAGE ═══════════════════════════════════════════════════════════

  // Blue header strip
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, PW, 58, 'F');

  // Left accent white bar
  doc.setFillColor(...C.white);
  doc.rect(0, 0, 5, 58, 'F');

  // Brand
  doc.setTextColor(...C.white);
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.text('VectoFair', 14, 32);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Bias Detection & Fairness Audit Platform', 14, 44);

  doc.setFontSize(8.5);
  doc.setTextColor(200, 220, 255);
  doc.text('Powered by Multi-Model AI  ·  Google Solution Challenge 2025', 14, 53);

  // Report title
  doc.setTextColor(...C.ink);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Fairness Audit Report', M, 80);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray2);
  doc.text(`Dataset:  ${datasetInfo.name}`,            M, 93);
  doc.text(`Generated: ${new Date().toLocaleString()}`,M, 101);
  doc.text(`Records:   ${datasetInfo.rows.toLocaleString()}`, M, 109);

  // Divider
  doc.setDrawColor(...C.gray3);
  doc.setLineWidth(0.4);
  doc.line(M, 116, PW - M, 116);

  // ── Score Box ───────────────────────────────────────────────────────────
  const SY = 122;
  const gc = gradeColor(scoreResult.grade);

  doc.setFillColor(...C.gray1);
  rRect(doc, M, SY, CW, 42, 3);

  // Grade circle drawn as filled rect (safe) — simple colored square badge
  doc.setFillColor(...gc);
  rRect(doc, M + 6, SY + 8, 26, 26, 3);
  doc.setTextColor(...C.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(scoreResult.grade, M + 19, SY + 26, { align: 'center' });

  doc.setTextColor(...C.ink);
  doc.setFontSize(14);
  doc.text(`Overall Fairness Score: ${scoreResult.score}/100`, M + 38, SY + 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray2);
  const verdict =
    scoreResult.score >= 90 ? 'Excellent — Dataset meets fairness standards.'
    : scoreResult.score >= 80 ? 'Good — Minor fairness improvements recommended.'
    : scoreResult.score >= 70 ? 'Fair — Moderate bias detected. Action recommended.'
    : scoreResult.score >= 55 ? 'Poor — Significant bias. Immediate action required.'
    : 'Critical — Severe bias. Dataset should not be used as-is.';
  doc.text(verdict, M + 38, SY + 30);

  // ── Dataset Summary Table ───────────────────────────────────────────────
  doc.setTextColor(...C.ink);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Dataset Summary', M, SY + 56);

  autoTable(doc, {
    startY:  SY + 61,
    margin:  { left: M, right: M },
    head:    [['Property', 'Value']],
    body:    [
      ['Dataset Name',         datasetInfo.name],
      ['Total Records',        datasetInfo.rows.toLocaleString()],
      ['Total Columns',        String(datasetInfo.columns)],
      ['Decision Column',      datasetInfo.decisionColumn],
      ['Sensitive Attributes', datasetInfo.sensitiveColumns.join(', ')],
      ['Positive Rate',        `${(datasetInfo.positiveRate * 100).toFixed(1)}%`],
      ['Analysis Date',        new Date().toLocaleDateString()],
    ],
    styles:            { fontSize: 10, cellPadding: 4.5, textColor: C.ink },
    headStyles:        { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles:{ fillColor: C.gray1 },
    columnStyles:      { 0: { fontStyle: 'bold', cellWidth: 60 } },
  });

  drawFooter(doc, PW, PH, pageNum);

  // ═══ BIAS FINDING PAGES ═══════════════════════════════════════════════════
  findings.forEach((finding, idx) => {
    doc.addPage();
    pageNum++;

    drawHeader(doc, PW, `VectoFair Audit Report  ·  Bias Finding ${idx + 1} of ${findings.length}`);

    // Attribute + verdict banner
    const { bg, fg } = severityColors(finding.overallVerdict);
    doc.setFillColor(...bg);
    rRect(doc, M, 26, CW, 14, 2);
    doc.setTextColor(...fg);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${finding.attribute.toUpperCase()}  ·  ${finding.overallVerdict}`, M + 5, 35.5);

    // Group rates table
    doc.setTextColor(...C.ink);
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Group Decision Rates', M, 52);

    autoTable(doc, {
      startY: 56,
      margin: { left: M, right: M },
      head:   [['Group', 'Decision Rate', 'Status']],
      body:   Object.entries(finding.groupRates).map(([g, r]) => [
        g,
        `${(r * 100).toFixed(1)}%`,
        r >= 0.5 ? 'Above Average' : 'Below Average',
      ]),
      styles:            { fontSize: 10, cellPadding: 4 },
      headStyles:        { fillColor: C.blue, textColor: C.white },
      alternateRowStyles:{ fillColor: C.gray1 },
    });

    const y1 = doc.lastAutoTable.finalY + 8;

    // Metrics table
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text('Metric Analysis', M, y1);

    autoTable(doc, {
      startY: y1 + 4,
      margin: { left: M, right: M },
      head:   [['Metric', 'Disparity Value', 'Verdict']],
      body:   finding.metrics.map((m) => [
        m.metric,
        m.disparity !== undefined ? m.disparity.toFixed(4) : (1 - m.ratio).toFixed(4),
        m.verdict,
      ]),
      styles:            { fontSize: 10, cellPadding: 4 },
      headStyles:        { fillColor: C.blue, textColor: C.white },
      alternateRowStyles:{ fillColor: C.gray1 },
    });

    const y2 = doc.lastAutoTable.finalY + 10;

    // AI Explanation box
    const expl = explanations[idx];
    if (expl && y2 < PH - 60) {
      const explText = typeof expl.explanation === 'string' ? expl.explanation : '';
      const lines    = doc.splitTextToSize(explText, CW - 12);
      const boxH     = Math.min(Math.max(lines.length * 5 + 20, 28), PH - y2 - 18);

      doc.setFillColor(...C.blueLight);
      rRect(doc, M, y2, CW, boxH, 2);

      // Left accent bar
      doc.setFillColor(...C.blue);
      doc.rect(M, y2, 3, boxH, 'F');

      doc.setTextColor(...C.blue);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('MULTI-MODEL AI ANALYSIS', M + 7, y2 + 9);

      doc.setTextColor(...C.ink);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      // only show lines that fit
      const maxLines = Math.floor((boxH - 14) / 5);
      doc.text(lines.slice(0, maxLines), M + 7, y2 + 16);
    }

    drawFooter(doc, PW, PH, pageNum);
  });

  // ═══ EXECUTIVE SUMMARY PAGE ═══════════════════════════════════════════════
  doc.addPage();
  pageNum++;

  drawHeader(doc, PW, 'VectoFair Audit Report  ·  Executive Summary & Recommendations');

  doc.setTextColor(...C.ink);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', M, 32);

  autoTable(doc, {
    startY: 36,
    margin: { left: M, right: M },
    head:   [['Attribute', 'Rate Range', 'Verdict']],
    body:   findings.map((f) => [
      f.attribute,
      `${(Math.min(...Object.values(f.groupRates)) * 100).toFixed(1)}% — ${(Math.max(...Object.values(f.groupRates)) * 100).toFixed(1)}%`,
      f.overallVerdict,
    ]),
    styles:            { fontSize: 10, cellPadding: 5 },
    headStyles:        { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles:{ fillColor: C.gray1 },
  });

  let rY = doc.lastAutoTable.finalY + 12;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.ink);
  doc.text('Recommendations', M, rY);
  rY += 6;

  explanations.forEach((expl, i) => {
    if (!expl?.recommendations) return;
    expl.recommendations.forEach((rec, ri) => {
      if (rY > PH - 28) {
        drawFooter(doc, PW, PH, pageNum);
        doc.addPage();
        pageNum++;
        drawHeader(doc, PW, 'VectoFair Audit Report  ·  Recommendations (continued)');
        rY = 30;
      }
      doc.setFillColor(...C.gray1);
      rRect(doc, M, rY, CW, 16, 2);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.blue);
      doc.text(`Finding ${i + 1} · Rec ${ri + 1}`, M + 4, rY + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.ink);
      const recLines = doc.splitTextToSize(rec, CW - 56);
      doc.text(recLines[0] || '', M + 52, rY + 6.5);
      if (recLines[1]) doc.text(recLines[1], M + 52, rY + 12);
      rY += 20;
    });
  });

  drawFooter(doc, PW, PH, pageNum);

  return doc;
}

// ── Download helper ───────────────────────────────────────────────────────────
export function downloadAuditPDF(params) {
  let doc;

  // ── 1. Generate ────────────────────────────────────────────────────────────
  try {
    doc = generateAuditPDF(params);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert(`Could not generate PDF: ${err.message}`);
    return null;
  }

  // ── 2. Build clean filename ────────────────────────────────────────────────
  const rawName  = params.datasetInfo?.name || 'dataset';
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const fileName = `VectoFair-audit-${safeName}.pdf`;

  // ── 3. Download via jsPDF native save (sets correct MIME + filename) ───────
  try {
    doc.save(fileName);
    console.log('✅ PDF downloaded:', fileName);
    return fileName;
  } catch (err) {
    console.error('PDF save failed, trying blob fallback:', err);

    // ── 4. Blob fallback ─────────────────────────────────────────────────────
    try {
      const blob = doc.output('blob');
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href:    url,
        download: fileName,
      });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
      return fileName;
    } catch (err2) {
      console.error('Blob fallback also failed:', err2);
      alert('PDF download failed. Please try a different browser.');
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUME PDF GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

function riskColor(score) {
  if (score >= 60) return C.severe;
  if (score >= 35) return C.mild;
  return C.fair;
}
function riskLabel(score) {
  if (score >= 60) return 'HIGH RISK';
  if (score >= 35) return 'MEDIUM RISK';
  return 'LOW RISK';
}

// ── Single resume PDF (3 pages) ───────────────────────────────────────────────
export function generateSingleResumePDF({ resume }) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW     = doc.internal.pageSize.getWidth();
  const PH     = doc.internal.pageSize.getHeight();
  const M      = 16;
  const CW     = PW - M * 2;
  let pageNum  = 1;

  const score  = resume.biasVulnerabilityScore || 0;
  const rc     = riskColor(score);
  const rl     = riskLabel(score);
  const name   = resume.candidateName || 'Candidate';
  const ai     = resume.aiAnalysis || {};

  // PAGE 1: Cover + Bias Summary
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, PW, 52, 'F');
  doc.setFillColor(...C.white);
  doc.rect(0, 0, 5, 52, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(24); doc.setFont('helvetica', 'bold');
  doc.text('VectoFair Resume Audit', 14, 28);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Resume Screening Bias Detection Report', 14, 40);
  doc.setFontSize(8); doc.setTextColor(200, 220, 255);
  doc.text('Powered by Multi-Model AI  ·  Google Solution Challenge 2025', 14, 48);

  doc.setTextColor(...C.ink);
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('Bias Vulnerability Assessment', M, 66);

  doc.setFillColor(...C.gray1);
  rRect(doc, M, 70, CW, 36, 3);
  doc.setFillColor(...rc);
  rRect(doc, M + 6, 76, 26, 22, 3);
  doc.setTextColor(...C.white);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(String(score), M + 19, 91, { align: 'center' });

  doc.setTextColor(...C.ink);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(`${name}  ·  ${rl}`, M + 38, 84);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray2);
  doc.text(`Name category: ${resume.nameCategory || 'Unknown'}  ·  Signals: ${resume.signalCount || 0}  ·  ${new Date().toLocaleString()}`, M + 38, 94);

  if (ai.overallSummary) {
    doc.setTextColor(...C.ink);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('AI Analysis Summary', M, 120);
    doc.setFillColor(...C.blueLight);
    const summaryLines = doc.splitTextToSize(ai.overallSummary, CW - 12);
    const boxH = summaryLines.length * 5 + 16;
    rRect(doc, M, 124, CW, Math.min(boxH, 40), 2);
    doc.setFillColor(...C.blue); doc.rect(M, 124, 3, Math.min(boxH, 40), 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.ink);
    doc.text(summaryLines.slice(0, 6), M + 7, 132);
  }

  if (ai.legalRisks && ai.legalRisks.length > 0) {
    let lY = 175;
    doc.setTextColor(...C.ink); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Legal Risk Flags', M, lY); lY += 5;
    ai.legalRisks.slice(0, 3).forEach((risk) => {
      doc.setFillColor(...C.severeLight);
      rRect(doc, M, lY, CW, 10, 2);
      doc.setTextColor(...C.severe); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      doc.text(`\u2696 ${risk.slice(0, 90)}`, M + 4, lY + 7);
      lY += 13;
    });
  }

  drawFooter(doc, PW, PH, pageNum);

  // PAGE 2: Signal Breakdown
  doc.addPage(); pageNum++;
  drawHeader(doc, PW, `Resume Bias Audit  \u00b7  ${name}  \u00b7  Signal Breakdown`);
  doc.setTextColor(...C.ink); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Detected Bias Signals', M, 30);

  const signals = resume.signals || [];
  if (signals.length > 0) {
    autoTable(doc, {
      startY: 34, margin: { left: M, right: M },
      head: [['Signal Type', 'Severity', 'Excerpt', 'Recommendation']],
      body: signals.map((s) => [
        (s.type || '').replace(/_/g, ' '),
        s.severity || '',
        (s.excerpt || '').slice(0, 45),
        (s.recommendation || '').slice(0, 65),
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: C.ink, overflow: 'linebreak' },
      headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.gray1 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 20 }, 2: { cellWidth: 48 }, 3: { cellWidth: 67 } },
    });
  } else {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray2);
    doc.text('No bias signals detected in this resume.', M, 42);
  }

  drawFooter(doc, PW, PH, pageNum);

  // PAGE 3: Blind Screening Guide
  doc.addPage(); pageNum++;
  drawHeader(doc, PW, `Resume Bias Audit  \u00b7  ${name}  \u00b7  Blind Screening Guide`);
  doc.setTextColor(...C.ink); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Blind Screening Recommendations', M, 30);

  const recs = ai.blindScreeningRecommendations || [
    'Remove candidate name and replace with anonymous identifier.',
    'Redact home address — use city/state only.',
    'Evaluate qualifications without university prestige weighting.',
  ];

  autoTable(doc, {
    startY: 34, margin: { left: M, right: M },
    head: [['#', 'Recommendation']],
    body: recs.map((r, i) => [String(i + 1), r]),
    styles: { fontSize: 9.5, cellPadding: 5, textColor: C.ink },
    headStyles: { fillColor: C.blue, textColor: C.white },
    alternateRowStyles: { fillColor: C.gray1 },
    columnStyles: { 0: { cellWidth: 12 } },
  });

  drawFooter(doc, PW, PH, pageNum);
  return doc;
}

export function downloadSingleResumePDF(params) {
  try {
    const doc = generateSingleResumePDF(params);
    const safeName = (params.resume.candidateName || 'resume').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    doc.save(`VectoFair-resume-${safeName}.pdf`);
  } catch (err) {
    console.error('Single resume PDF failed:', err);
    alert('PDF generation failed: ' + err.message);
  }
}

// ── Batch resume PDF (4 pages) ─────────────────────────────────────────────────
export function generateBatchResumePDF({ analyzedResumes, batchStats }) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW     = doc.internal.pageSize.getWidth();
  const PH     = doc.internal.pageSize.getHeight();
  const M      = 16;
  const CW     = PW - M * 2;
  let pageNum  = 1;

  const poolScore = batchStats?.poolFairnessScore || 0;

  // PAGE 1: Executive Summary
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, PW, 52, 'F');
  doc.setFillColor(...C.white);
  doc.rect(0, 0, 5, 52, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('VectoFair Resume Pool Audit', 14, 28);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Batch Resume Screening Bias Detection Report', 14, 40);

  doc.setTextColor(...C.ink); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', M, 65);

  autoTable(doc, {
    startY: 69, margin: { left: M, right: M },
    head: [['Metric', 'Value']],
    body: [
      ['Total Resumes Analyzed', String(analyzedResumes.length)],
      ['Pool Fairness Score', `${poolScore}/100`],
      ['High Risk Resumes', String(batchStats?.riskSummary?.high || 0)],
      ['Medium Risk Resumes', String(batchStats?.riskSummary?.medium || 0)],
      ['Low Risk Resumes', String(batchStats?.riskSummary?.low || 0)],
      ['Anglo-Named Avg Bias Score', String(batchStats?.angloAvgScore || 0)],
      ['Minority-Named Avg Bias Score', String(batchStats?.minorityAvgScore || 0)],
      ['Biased Top-10 Shortlist — Anglo', String(batchStats?.angloInBiasedShortlist || 0)],
      ['Biased Top-10 Shortlist — Minority', String(batchStats?.minorityInBiasedShortlist || 0)],
      ['Date Generated', new Date().toLocaleDateString()],
    ],
    styles: { fontSize: 10, cellPadding: 4, textColor: C.ink },
    headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
  });

  if (batchStats?.keyInsight) {
    const ky = doc.lastAutoTable.finalY + 10;
    if (ky < PH - 40) {
      const lines = doc.splitTextToSize(batchStats.keyInsight, CW - 12);
      const bh    = lines.length * 5 + 16;
      doc.setFillColor(...C.blueLight);
      rRect(doc, M, ky, CW, Math.min(bh, 28), 2);
      doc.setFillColor(...C.blue); doc.rect(M, ky, 3, Math.min(bh, 28), 'F');
      doc.setTextColor(...C.blue); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('KEY FINDING', M + 7, ky + 9);
      doc.setTextColor(...C.ink); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(lines.slice(0, 3), M + 7, ky + 17);
    }
  }

  drawFooter(doc, PW, PH, pageNum);

  // PAGE 2: Individual Scores Table
  doc.addPage(); pageNum++;
  drawHeader(doc, PW, 'VectoFair Resume Pool Audit  \u00b7  Individual Scores');
  doc.setTextColor(...C.ink); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Individual Resume Scores (sorted by bias score)', M, 30);

  autoTable(doc, {
    startY: 34, margin: { left: M, right: M },
    head: [['ID', 'Candidate', 'Category', 'Signals', 'Score', 'Risk']],
    body: [...analyzedResumes]
      .sort((a, b) => (b.biasVulnerabilityScore || 0) - (a.biasVulnerabilityScore || 0))
      .map((r) => [
        r.id || '',
        (r.candidateName || r.label || '').slice(0, 22),
        r.nameCategory || 'Unknown',
        String(r.signalCount || 0),
        String(r.biasVulnerabilityScore || 0),
        riskLabel(r.biasVulnerabilityScore || 0),
      ]),
    styles: { fontSize: 8.5, cellPadding: 3, textColor: C.ink },
    headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray1 },
    columnStyles: { 4: { fontStyle: 'bold' }, 5: { fontStyle: 'bold' } },
  });

  drawFooter(doc, PW, PH, pageNum);

  // PAGE 3: Simulated Shortlist
  doc.addPage(); pageNum++;
  drawHeader(doc, PW, 'VectoFair Resume Pool Audit  \u00b7  Shortlist Simulation');
  doc.setTextColor(...C.ink); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Biased Screener Simulation — Top 10 Shortlist', M, 30);

  autoTable(doc, {
    startY: 34, margin: { left: M, right: M },
    head: [['Rank', 'Candidate', 'Name Category', 'Bias Score', 'Risk']],
    body: (batchStats?.biasedShortlist || []).slice(0, 10).map((r, i) => [
      `#${i + 1}`,
      (r.candidateName || r.id || '').slice(0, 25),
      r.nameCategory || '',
      String(r.biasVulnerabilityScore || 0),
      riskLabel(r.biasVulnerabilityScore || 0),
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: C.ink },
    headStyles: { fillColor: C.blue, textColor: C.white },
    alternateRowStyles: { fillColor: C.gray1 },
  });

  drawFooter(doc, PW, PH, pageNum);

  // PAGE 4: Blind Screening Guide
  doc.addPage(); pageNum++;
  drawHeader(doc, PW, 'VectoFair Resume Pool Audit  \u00b7  Blind Screening Guide');
  doc.setTextColor(...C.ink); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Blind Screening Implementation Guide', M, 30);

  autoTable(doc, {
    startY: 34, margin: { left: M, right: M },
    head: [['Field to Redact', 'Priority', 'Reason']],
    body: [
      ['Full Name', 'Critical', 'Replace with anonymous ID before initial review'],
      ['Home Address', 'Critical', 'Zip code can proxy for race/income — use city/state only'],
      ['Photo', 'Critical', 'Reveals race, gender, age, disability status'],
      ['Graduation Year', 'High', 'Age proxy; ADEA protects workers 40+'],
      ['Personal Website / Social Links', 'High', 'May reveal protected characteristics'],
      ['Pronouns', 'High', 'Gender blind screening reduces sex discrimination risk'],
      ['University Name (initial screen)', 'Medium', 'Prestige bias disadvantages HBCU/community college graduates'],
      ['Gendered Organization Names', 'Medium', 'Sorority/fraternity reveals gender and social class'],
      ['Disability Disclosure', 'Medium', 'ADA prohibits adverse action — blind before screener'],
      ['Citizenship/Visa Status', 'Medium', 'IRCA prohibits national origin discrimination'],
    ],
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: C.ink, overflow: 'linebreak' },
    headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray1 },
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 99 } },
  });

  drawFooter(doc, PW, PH, pageNum);
  return doc;
}

export function downloadBatchResumePDF(params) {
  try {
    const doc = generateBatchResumePDF(params);
    const ts  = new Date().toISOString().slice(0, 10);
    doc.save(`VectoFair-resume-pool-${ts}.pdf`);
  } catch (err) {
    console.error('Batch resume PDF failed:', err);
    alert('PDF generation failed: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE REPORT PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCompliancePDF(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - M * 2;
  let pageNum = 1;

  // PAGE 1: Header + Methodology
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, PW, 40, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text(report.regulation.name, M, 22);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`VectoFair AI Audit Platform — ${report.orgName} · ${report.reportPeriod}`, M, 30);

  doc.setTextColor(...C.ink);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Methodology Statement', M, 55);

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const methLines = doc.splitTextToSize(report.methodology, CW);
  doc.text(methLines, M, 63);

  let curY = 63 + (methLines.length * 5) + 12;

  // Findings Table
  if (report.findings && report.findings.length > 0) {
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Bias Audit Results', M, curY);
    
    autoTable(doc, {
      startY: curY + 5, margin: { left: M, right: M },
      head: [['Finding', 'Severity', 'Metrics', 'Legal Basis']],
      body: report.findings.map(f => [
        f.title, f.severity, f.metrics, f.legal
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: C.ink },
      headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.gray1 },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 20 } },
    });
    curY = doc.lastAutoTable.finalY + 16;
  }

  // Corrective Action Plan
  if (curY > PH - 60) {
    drawFooter(doc, PW, PH, pageNum);
    doc.addPage(); pageNum++; curY = 30;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  } else {
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  }

  doc.text('Corrective Action Plan', M, curY);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const actionLines = doc.splitTextToSize(report.correctiveAction, CW);
  doc.text(actionLines, M, curY + 8);
  
  curY += 8 + (actionLines.length * 5) + 16;

  // Checklist
  if (curY > PH - 40) {
    drawFooter(doc, PW, PH, pageNum);
    doc.addPage(); pageNum++; curY = 30;
  }
  
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Compliance Checklist Complete', M, curY);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  
  report.sections.forEach((sec, i) => {
    doc.text(`\u2713 ${sec}`, M + 4, curY + 8 + (i * 6));
  });

  drawFooter(doc, PW, PH, pageNum);
  return doc;
}

export function downloadCompliancePDF(report) {
  try {
    const doc = generateCompliancePDF(report);
    const safeReg = report.regulation.id.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const safeOrg = report.orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    doc.save(`compliance-report-${safeReg}-${safeOrg}.pdf`);
  } catch (err) {
    console.error('Compliance PDF failed:', err);
    alert('PDF generation failed: ' + err.message);
  }
}

