import { useEffect, useState, useRef } from 'react';
import { analyzeAttribute, computeOverallFairnessScore, binNumericalColumn, detectColumnTypes } from '../utils/biasCalculator';
import { explainAllFindings } from '../utils/aiClient';

const STEPS = [
  { id: 'parse', label: 'Parsing data', sub: 'Reading CSV and detecting column types...', icon: 'data_table' },
  { id: 'metrics', label: 'Calculating metrics', sub: 'Running demographic parity, equal opportunity, disparate impact...', icon: 'calculate' },
  { id: 'ai', label: 'AI Model Analysis', sub: 'Generating plain-English explanations for bias findings using multi-model AI...', icon: 'psychology' },
  { id: 'report', label: 'Generating report', sub: 'Computing fairness scores and building audit report...', icon: 'summarize' },
];

export default function AnalysisStep({ uploadData, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runAnalysis();
  }, []);

  async function runAnalysis() {
    try {
      const { data, decisionCol, sensitiveAttrs, datasetName } = uploadData;

      // Step 1: Parse
      setCurrentStep(0);
      await delay(800);

      const columnTypes = detectColumnTypes(data, Object.keys(data[0]));

      // Step 2: Calculate bias metrics
      setCurrentStep(1);
      await delay(600);

      const findings = [];
      for (const attr of sensitiveAttrs) {
        let analysisData = data;
        let analysisAttr = attr;

        // Bin numerical columns
        if (columnTypes[attr] === 'numerical') {
          analysisData = binNumericalColumn(data, attr);
          analysisAttr = `${attr}_group`;
        }

        const finding = analyzeAttribute(analysisData, decisionCol, analysisAttr);
        finding.originalAttribute = attr;
        finding.attribute = attr; // keep display name
        // Remap groupRates to use the original binned keys
        findings.push(finding);
      }

      // Step 3: AI explanations (OpenRouter → Mistral)
      setCurrentStep(2);
      const explanations = await explainAllFindings(
        findings,
        'hiring',
        (i, total) => console.log(`AI explanation: ${i + 1}/${total}`)
      );

      // Step 4: Compute score & finalize
      setCurrentStep(3);
      await delay(600);
      const scoreResult = computeOverallFairnessScore(findings);

      // Build dataset info
      const positiveCount = data.filter((r) => Number(r[decisionCol]) === 1).length;
      const datasetInfo = {
        name: datasetName || 'Uploaded Dataset',
        rows: data.length,
        columns: Object.keys(data[0]).length,
        decisionColumn: decisionCol,
        sensitiveColumns: sensitiveAttrs,
        positiveRate: positiveCount / data.length,
      };

      await delay(400);
      setDone(true);

      setTimeout(() => {
        onComplete({ findings, explanations, scoreResult, datasetInfo, rawData: data, decisionCol });
      }, 600);

    } catch (err) {
      console.error('Analysis error:', err);
      setError(`Analysis failed: ${err.message}`);
    }
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  if (error) {
    return (
      <div className="analysis-page">
        <div className="alert alert-error" style={{ maxWidth: 480, width: '100%' }}>
          <span className="material-icons-round">error</span>
          <div>
            <strong>Analysis Error</strong>
            <p style={{ marginTop: 4 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-page">
      {/* Animated logo */}
      <div className="analysis-logo">
        <div className="analysis-logo-ring" />
        <div className="analysis-logo-ring" />
        <div className="analysis-logo-inner">
          <span className="material-icons-round">balance</span>
        </div>
      </div>

      <div>
        <h2 className="analysis-title">
          {done ? '✓ Analysis Complete!' : 'Analyzing for Bias...'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: 8 }}>
          {done
            ? 'Loading your results dashboard...'
            : `Auditing ${uploadData.sensitiveAttrs.join(', ')} across ${uploadData.data.length} records`}
        </p>
      </div>

      {/* Step indicators */}
      <div className="analysis-steps">
        {STEPS.map((step, i) => {
          const status = done ? 'done' : i < currentStep ? 'done' : i === currentStep ? 'active' : 'waiting';
          return (
            <div key={step.id} className={`analysis-step-item ${status}`}>
              <div className={`step-status-icon ${status}`}>
                {status === 'done' ? (
                  <span className="material-icons-round" style={{ fontSize: 18 }}>check</span>
                ) : status === 'active' ? (
                  <span className="material-icons-round" style={{ fontSize: 18 }}>{step.icon}</span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>
              <div className="step-text">
                <div className="step-text-title">
                  {step.label}
                  {status === 'active' && (
                    <span className="loading-dots" style={{ marginLeft: 8 }}>
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                    </span>
                  )}
                </div>
                {status !== 'waiting' && (
                  <div className="step-text-sub">{step.sub}</div>
                )}
              </div>
              {status === 'done' && (
                <span className="material-icons-round" style={{ color: 'var(--color-secondary)', fontSize: 20 }}>
                  check_circle
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ background: 'var(--color-border)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-primary), #a142f4)',
              borderRadius: 100,
              width: done ? '100%' : `${((currentStep) / STEPS.length) * 100}%`,
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
          {done ? 'Complete!' : `Step ${Math.min(currentStep + 1, STEPS.length)} of ${STEPS.length}`}
        </p>
      </div>
    </div>
  );
}
