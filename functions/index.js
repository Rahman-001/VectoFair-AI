const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ─── Bias Calculation Helpers ────────────────────────────────────────────────
function getGroups(data, column) {
  return [...new Set(data.map((r) => String(r[column])))];
}

function positiveRate(data, decisionCol, sensitiveCol, groupValue) {
  const group = data.filter((r) => String(r[sensitiveCol]) === groupValue);
  if (group.length === 0) return 0;
  const positive = group.filter((r) => Number(r[decisionCol]) === 1).length;
  return positive / group.length;
}

function calculateDemographicParity(data, decisionCol, sensitiveCol) {
  const groups = getGroups(data, sensitiveCol);
  const rates = {};
  groups.forEach((g) => { rates[g] = positiveRate(data, decisionCol, sensitiveCol, g); });
  const values = Object.values(rates);
  const maxRate = Math.max(...values);
  const minRate = Math.min(...values);
  const disparity = maxRate - minRate;
  const maxGroup = Object.keys(rates).find((k) => rates[k] === maxRate);
  const minGroup = Object.keys(rates).find((k) => rates[k] === minRate);
  return {
    metric: 'Demographic Parity',
    disparity: parseFloat(disparity.toFixed(4)),
    maxGroup, minGroup,
    maxRate: parseFloat(maxRate.toFixed(4)),
    minRate: parseFloat(minRate.toFixed(4)),
    groupRates: rates,
    verdict: disparity > 0.2 ? 'SEVERE BIAS' : disparity > 0.1 ? 'MILD BIAS' : 'FAIR',
  };
}

function calculateDisparateImpact(data, decisionCol, sensitiveCol) {
  const groups = getGroups(data, sensitiveCol);
  const rates = {};
  groups.forEach((g) => { rates[g] = positiveRate(data, decisionCol, sensitiveCol, g); });
  const values = Object.values(rates);
  const maxRate = Math.max(...values);
  const minRate = Math.min(...values);
  const ratio = maxRate === 0 ? 0 : parseFloat((minRate / maxRate).toFixed(4));
  const maxGroup = Object.keys(rates).find((k) => rates[k] === maxRate);
  const minGroup = Object.keys(rates).find((k) => rates[k] === minRate);
  return {
    metric: 'Disparate Impact Ratio',
    ratio, disparity: parseFloat((maxRate - minRate).toFixed(4)),
    maxGroup, minGroup,
    maxRate: parseFloat(maxRate.toFixed(4)),
    minRate: parseFloat(minRate.toFixed(4)),
    groupRates: rates,
    verdict: ratio < 0.5 ? 'SEVERE BIAS' : ratio < 0.8 ? 'MILD BIAS' : 'FAIR',
  };
}

function analyzeAttribute(data, decisionCol, sensitiveCol) {
  const dp = calculateDemographicParity(data, decisionCol, sensitiveCol);
  const di = calculateDisparateImpact(data, decisionCol, sensitiveCol);
  const verdicts = [dp.verdict, di.verdict];
  const overallVerdict = verdicts.includes('SEVERE BIAS') ? 'SEVERE BIAS'
    : verdicts.includes('MILD BIAS') ? 'MILD BIAS' : 'FAIR';
  return { attribute: sensitiveCol, metrics: [dp, di], overallVerdict, groupRates: dp.groupRates };
}

function computeOverallFairnessScore(findings) {
  if (!findings.length) return { score: 100, grade: 'A' };
  let totalPenalty = 0, metricCount = 0;
  findings.forEach((f) => {
    f.metrics.forEach((m) => {
      metricCount++;
      if (m.verdict === 'SEVERE BIAS') totalPenalty += 25;
      else if (m.verdict === 'MILD BIAS') totalPenalty += 12;
    });
  });
  const avgPenalty = metricCount > 0 ? totalPenalty / metricCount : 0;
  const score = Math.max(0, Math.round(100 - avgPenalty * 2.5));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  return { score, grade };
}

// ─── Cloud Function: analyzeBias ─────────────────────────────────────────────
exports.analyzeBias = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    const { datasetId, decisionColumn, sensitiveColumns } = data;

    if (!datasetId || !decisionColumn || !sensitiveColumns?.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Fetch dataset from Firestore
    const docRef = db.collection('datasets').doc(datasetId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Dataset not found');
    }

    const { rows } = doc.data();

    // Run analysis
    const findings = sensitiveColumns.map((col) => analyzeAttribute(rows, decisionColumn, col));
    const scoreResult = computeOverallFairnessScore(findings);
    const positiveCount = rows.filter((r) => Number(r[decisionColumn]) === 1).length;

    const report = {
      datasetId,
      decisionColumn,
      sensitiveColumns,
      findings,
      scoreResult,
      datasetInfo: {
        rows: rows.length,
        columns: Object.keys(rows[0] || {}).length,
        decisionColumn,
        sensitiveColumns,
        positiveRate: positiveCount / rows.length,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save report to Firestore
    const reportRef = await db.collection('reports').add(report);
    return { reportId: reportRef.id, ...report };
  });

// ─── Cloud Function: saveDataset ─────────────────────────────────────────────
exports.saveDataset = functions.https.onCall(async (data, context) => {
  const { name, rows } = data;
  if (!rows?.length) {
    throw new functions.https.HttpsError('invalid-argument', 'Empty dataset');
  }
  const docRef = await db.collection('datasets').add({
    name,
    rows,
    rowCount: rows.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { datasetId: docRef.id };
});
