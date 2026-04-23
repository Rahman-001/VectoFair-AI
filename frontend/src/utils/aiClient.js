// VectoFair — AI Explanation Client
// Primary:  OpenRouter (free models, OpenAI-compatible)
// Fallback: Mistral AI direct API
// Final:    Offline pre-written explanations

// ── API Keys ──────────────────────────────────────────────────────────────────
const OPENROUTER_KEY =
  import.meta.env.VITE_OPENROUTER_API_KEY ||
  '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';

const MISTRAL_KEY =
  import.meta.env.VITE_MISTRAL_API_KEY ||
  'gZw60HeqZKq4ssQDnqAOvramYjWDa8lQ';

// ── Endpoints ─────────────────────────────────────────────────────────────────
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MISTRAL_URL    = 'https://api.mistral.ai/v1/chat/completions';

// OpenRouter free models — tried in order
// 'openrouter/auto' auto-selects the best available free model
const OPENROUTER_MODELS = [
  'openrouter/auto',                              // Auto-picks best free model
  'meta-llama/llama-3.3-70b-instruct:free',       // Meta Llama 3.3 70B (free)
  'deepseek/deepseek-r1:free',                    // DeepSeek R1 (free)
  'microsoft/phi-3-mini-128k-instruct:free',      // Microsoft Phi-3 (free)
  'google/gemma-3-12b-it:free',                   // Google Gemma 3 12B (free)
  'mistralai/mistral-small-3.1-24b-instruct:free',// Mistral Small (free)
];

// Mistral direct models — fallback
const MISTRAL_MODELS = [
  'mistral-small-latest',
  'open-mistral-7b',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function extractText(data) {
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty content in API response');
  return text;
}

// ── OpenRouter call ───────────────────────────────────────────────────────────
async function callOpenRouter(model, prompt) {
  const res = await fetch(OPENROUTER_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer':  'http://localhost:5173',
      'X-Title':       'VectoFair AI Bias Audit',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role:    'system',
          content: 'You are a bias analysis expert who explains AI fairness findings in plain, empathetic English for a non-technical audience.',
        },
        { role: 'user', content: prompt },
      ],
      temperature:  0.6,
      max_tokens:   600,
    }),
  });

  if (!res.ok) {
    const err      = new Error(`OpenRouter HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return extractText(await res.json());
}

// ── Mistral direct call ───────────────────────────────────────────────────────
async function callMistral(model, prompt) {
  const res = await fetch(MISTRAL_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${MISTRAL_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role:    'system',
          content: 'You are a bias analysis expert. Explain AI fairness findings in plain English for non-technical readers.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens:  600,
    }),
  });

  if (!res.ok) {
    const err      = new Error(`Mistral HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return extractText(await res.json());
}

// ── Combined caller with full fallback chain ───────────────────────────────────
export async function callAI(prompt) {
  // 1. Try OpenRouter free models
  for (const model of OPENROUTER_MODELS) {
    try {
      const text = await callOpenRouter(model, prompt);
      console.log(`✅ OpenRouter [${model}] success`);
      return { text, source: 'openrouter', model };
    } catch (err) {
      if (err.statusCode === 429 || err.statusCode === 503) {
        console.warn(`⏳ OpenRouter [${model}] rate-limited, retrying after 2s…`);
        await sleep(2000);
        try {
          const text = await callOpenRouter(model, prompt);
          console.log(`✅ OpenRouter [${model}] success (retry)`);
          return { text, source: 'openrouter', model };
        } catch (e2) {
          console.warn(`⚠️ OpenRouter [${model}] retry failed: ${e2.message}`);
        }
      } else {
        console.warn(`⚠️ OpenRouter [${model}] failed (${err.statusCode}): ${err.message}`);
      }
    }
  }

  // 2. Try Mistral direct API
  for (const model of MISTRAL_MODELS) {
    try {
      const text = await callMistral(model, prompt);
      console.log(`✅ Mistral [${model}] success`);
      return { text, source: 'mistral', model };
    } catch (err) {
      console.warn(`⚠️ Mistral [${model}] failed (${err.statusCode}): ${err.message}`);
    }
  }

  throw new Error('All AI providers exhausted');
}

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(finding, metric, context = 'hiring') {
  const { attribute, groupRates } = finding;
  const groupEntries = Object.entries(groupRates)
    .map(([g, r]) => `${g}: ${(r * 100).toFixed(1)}%`)
    .join(', ');

  return `A ${context} decision model shows bias: ${metric.metric} for "${attribute}" has a disparity of ${(metric.disparity || (1 - metric.ratio)).toFixed(2)}. Decision rates: ${groupEntries}. Verdict: ${metric.verdict}.

Explain in 3 sentences what this means for affected people in plain English. Give 2 specific actionable recommendations to fix this bias. Be direct, empathetic, non-technical. Format exactly as:

EXPLANATION: [3 sentences]
RECOMMENDATION 1: [specific action]
RECOMMENDATION 2: [specific action]`;
}

function parseResponse(text) {
  const em   = text.match(/EXPLANATION:\s*([\s\S]*?)(?=RECOMMENDATION 1:|$)/i);
  const r1m  = text.match(/RECOMMENDATION 1:\s*([\s\S]*?)(?=RECOMMENDATION 2:|$)/i);
  const r2m  = text.match(/RECOMMENDATION 2:\s*([\s\S]*?)$/i);
  return {
    explanation:     em  ? em[1].trim()  : text.trim(),
    recommendations: [
      r1m ? r1m[1].trim() : 'Collect more representative data from underrepresented groups.',
      r2m ? r2m[1].trim() : 'Apply fairness constraints during model training.',
    ],
  };
}

// ── Offline fallbacks ─────────────────────────────────────────────────────────
function getFallback(finding, metric) {
  const { attribute, groupRates } = finding;
  const groups   = Object.entries(groupRates);
  const maxGroup = groups.reduce((a, b) => (a[1] > b[1] ? a : b));
  const minGroup = groups.reduce((a, b) => (a[1] < b[1] ? a : b));
  const gap      = ((maxGroup[1] - minGroup[1]) * 100).toFixed(1);

  const map = {
    'Demographic Parity': {
      explanation: `"${minGroup[0]}" group members receive positive decisions at ${(minGroup[1]*100).toFixed(1)}% versus ${(maxGroup[1]*100).toFixed(1)}% for "${maxGroup[0]}" — a ${gap} point gap. This disparity means people are being judged on their ${attribute} rather than their qualifications. Left unchecked, this compounds historical inequalities and limits career opportunities for disadvantaged groups.`,
      recommendations: [
        `Audit your dataset for proxy variables that encode ${attribute} (e.g., zip code, school name) and remove or neutralise them before training.`,
        'Apply reweighting or resampling to balance positive-decision rates across groups, then re-evaluate with fairness-aware model selection.',
      ],
    },
    'Disparate Impact Ratio': {
      explanation: `A Disparate Impact Ratio of ${metric.ratio?.toFixed(2) || 'N/A'} is below the legally required 0.8 threshold (the 80% Rule), classifying this process as statistically discriminatory toward "${minGroup[0]}". These individuals are ${((1-(metric.ratio||0.5))*100).toFixed(0)}% less likely to receive a positive outcome than the most-favoured group. This exposes your organisation to legal liability under employment discrimination law.`,
      recommendations: [
        'Run a full adverse impact analysis and document every selection criterion to identify the primary driver of the disparity.',
        `Lower the decision threshold for "${minGroup[0]}" applicants in post-processing until the ratio meets or exceeds 0.8.`,
      ],
    },
    'Equal Opportunity': {
      explanation: `Equally qualified "${minGroup[0]}" candidates are ${gap} percentage points less likely to receive a positive decision than "${maxGroup[0]}" peers. This means their skills and experience are being systematically discounted based on their ${attribute}. The root cause is typically historical bias baked into the training data.`,
      recommendations: [
        `Remove or de-weight features strongly correlated with ${attribute} that are not validated predictors of actual job performance.`,
        'Add an equalized-odds constraint to the training objective to enforce matching true positive rates across all demographic groups.',
      ],
    },
  };

  return map[metric.metric] || map['Demographic Parity'];
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function explainBias(finding, context = 'hiring') {
  const primaryMetric = [...finding.metrics]
    .sort((a, b) => ({ 'SEVERE BIAS': 3, 'MILD BIAS': 2, FAIR: 1 }[b.verdict] || 0) -
                    ({ 'SEVERE BIAS': 3, 'MILD BIAS': 2, FAIR: 1 }[a.verdict] || 0))[0];

  try {
    const prompt        = buildPrompt(finding, primaryMetric, context);
    const { text, source, model } = await callAI(prompt);
    console.log(`🤖 AI explanation via ${source} (${model})`);
    return { ...parseResponse(text), source };
  } catch (err) {
    console.warn('⚠️ All AI providers failed, using offline fallback:', err.message);
    return { ...getFallback(finding, primaryMetric), source: 'fallback' };
  }
}

export async function explainAllFindings(findings, context = 'hiring', onProgress) {
  const results = [];
  for (let i = 0; i < findings.length; i++) {
    if (onProgress) onProgress(i, findings.length);
    results.push(await explainBias(findings[i], context));
    if (i < findings.length - 1) await sleep(1200);
  }
  return results;
}

// ── Resume Analysis ────────────────────────────────────────────────────────────
function buildResumePrompt(resumeText, extractedSignals) {
  const signalsJson = JSON.stringify(extractedSignals.signals?.slice(0, 6) || []);
  return `You are a fair hiring expert and employment law specialist. Analyze this resume for elements that could trigger unconscious bias in human reviewers or AI screening systems. Focus ONLY on bias risk — do not evaluate qualifications.

Resume text:
"""
${resumeText.slice(0, 3000)}
"""

Client-side signals already detected:
${signalsJson}

Respond in valid JSON only. No preamble. No markdown fences. No trailing commas.
{
  "overallBiasRisk": "LOW",
  "biasScore": 25,
  "keyFindings": [
    {
      "signal": "Name-based bias",
      "severity": "HIGH",
      "excerpt": "exact text from resume",
      "explanation": "One sentence plain English explanation.",
      "recommendation": "One sentence specific fix."
    }
  ],
  "blindScreeningRecommendations": ["Remove candidate name before review", "Redact graduation year", "Use skills-first evaluation"],
  "legalRisks": ["Title VII - national origin", "ADEA - age discrimination"],
  "overallSummary": "Two sentences maximum for an HR manager. Plain English only."
}`;
}

function parseResumeResponse(text) {
  // Strip markdown fences if present
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '');

  // Find first { ... } block
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');

  const jsonStr = clean.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

function getResumeFallback(extractedSignals) {
  const signalCount = extractedSignals.signalCount || 0;
  const score = extractedSignals.biasVulnerabilityScore || 20;
  const risk = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';

  return {
    overallBiasRisk: risk,
    biasScore: score,
    keyFindings: (extractedSignals.signals || []).slice(0, 4).map((s) => ({
      signal: s.type.replace(/_/g, ' '),
      severity: s.severity,
      excerpt: s.excerpt,
      explanation: s.explanation,
      recommendation: s.recommendation,
    })),
    blindScreeningRecommendations: [
      'Remove candidate name and replace with anonymous identifier before initial review.',
      'Redact home address — use city/state only during screening.',
      'Evaluate skills and experience independently of university prestige or name recognition.',
    ],
    legalRisks: (extractedSignals.signals || []).map((s) => s.legalBasis).filter(Boolean).slice(0, 3),
    overallSummary: `This resume contains ${signalCount} bias-triggering signal${signalCount !== 1 ? 's' : ''} with an overall bias vulnerability score of ${score}/100. Implementing blind CV screening would remove the primary bias vectors and ensure this candidate is evaluated on merit alone.`,
    source: 'fallback',
  };
}

export async function analyzeResumeForBias(resumeText, extractedSignals) {
  try {
    const prompt = buildResumePrompt(resumeText, extractedSignals);
    const { text, source, model } = await callAI(prompt);
    console.log(`🤖 Resume analysis via ${source} (${model})`);
    const parsed = parseResumeResponse(text);
    return { ...parsed, source };
  } catch (err) {
    console.warn('⚠️ Resume AI analysis failed, using fallback:', err.message);
    return getResumeFallback(extractedSignals);
  }
}

// ── AI Resume Rewriter ────────────────────────────────────────────────────────
function buildRewritePrompt(resumeText, signals) {
  const signalTypes = signals.map((s) => s.type).join(', ');
  return `You are a professional resume editor tasked with creating a BIAS-FREE version of a resume for blind screening.

Your task:
1. Remove or anonymize ALL identity-revealing elements: full name (replace with "CANDIDATE"), home address (keep city/state only), graduation years (remove or make vague like "Bachelor's in Computer Science"), pronouns, sorority/fraternity names, disability disclosures.
2. Keep ALL qualifications, skills, experience descriptions, and achievements EXACTLY as written.
3. Do NOT change any job titles, company names, dates of employment, GPA, certifications, or professional skills.
4. Keep the exact same formatting and structure.
5. Signals to address: ${signalTypes}

Original resume:
"""
${resumeText.slice(0, 3000)}
"""

Return ONLY the rewritten resume text. No preamble, no explanation. Start directly with the anonymized resume.`;
}

export async function rewriteResumeForBlindScreening(resumeText, signals) {
  try {
    const prompt = buildRewritePrompt(resumeText, signals);
    const { text, source, model } = await callAI(prompt);
    console.log(`🤖 Resume rewrite via ${source} (${model})`);
    return { rewrittenText: text.trim(), source };
  } catch (err) {
    console.warn('⚠️ Resume rewrite failed:', err.message);
    // Manual fallback — replace name pattern in first line
    const lines = resumeText.split('\n');
    const rewritten = ['[CANDIDATE — IDENTITY REDACTED FOR BLIND SCREENING]', ...lines.slice(1)].join('\n');
    return { rewrittenText: rewritten, source: 'fallback' };
  }
}

