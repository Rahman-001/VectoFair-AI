// ── GLOBAL TEST CASE RUNNER ───────────────────────────────────────────────

/**
 * Runs a JSON-defined test suite against a specific module's analysis engine.
 * @param {Array} tests - Array of test configuration objects
 * @param {Function} analysisEngine - The module's data analysis function/promise
 * @returns {Promise<Object>} { summary: "X/Y tests passing", results: Array }
 */
export async function runTestCases(tests, analysisEngine) {
  const results = [];
  let passedCount = 0;

  for (const test of tests) {
    const { testName, inputData, expectedOutput } = test;
    const testResult = {
      testName,
      passed: false,
      failReason: null,
      actualOutput: null,
      expectedOutput,
    };

    try {
      // Execute the module's engine on the dummy input
      const output = await analysisEngine(inputData);
      testResult.actualOutput = output;

      let failures = [];

      // Tolerances and assertions
      // 1. Bias Score (±5)
      if (expectedOutput.biasScore !== undefined) {
        const actualScore = output.biasVulnerabilityScore || output.score || 0; // handle different module formats
        if (Math.abs(actualScore - expectedOutput.biasScore) > 5) {
          failures.push(\`Score mismatch: Expected ~\${expectedOutput.biasScore}, got \${actualScore}\`);
        }
      }

      // 2. Findings Count
      if (expectedOutput.findingsCount !== undefined) {
        const actualFindings = output.findings?.length || output.signals?.length || 0;
        if (actualFindings !== expectedOutput.findingsCount) {
          failures.push(\`Findings count mismatch: Expected \${expectedOutput.findingsCount}, got \${actualFindings}\`);
        }
      }

      // 3. Severity
      if (expectedOutput.severity) {
        const actualSeverity = output.overallRisk || output.severity || '';
        if (actualSeverity !== expectedOutput.severity) {
          failures.push(\`Severity mismatch: Expected \${expectedOutput.severity}, got \${actualSeverity}\`);
        }
      }

      // 4. Specific Metrics Present
      if (expectedOutput.metricsPresent && Array.isArray(expectedOutput.metricsPresent)) {
        const actualMetrics = output.metrics ? output.metrics.map(m => m.name || m.metric) : [];
        for (const reqMetric of expectedOutput.metricsPresent) {
          if (!actualMetrics.includes(reqMetric)) {
            failures.push(\`Missing expected metric: \${reqMetric}\`);
          }
        }
      }

      if (failures.length === 0) {
        testResult.passed = true;
        passedCount++;
      } else {
        testResult.failReason = failures.join(' | ');
      }
    } catch (err) {
      testResult.passed = false;
      testResult.failReason = \`Execution Error: \${err.message}\`;
    }

    results.push(testResult);
  }

  return {
    summary: \`\${passedCount}/\${tests.length} tests passing\`,
    passedCount,
    totalCount: tests.length,
    results,
  };
}
