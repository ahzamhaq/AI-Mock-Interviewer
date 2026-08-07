/**
 * codeEvaluation.service — the Code Evaluation Engine.
 *
 * Sprint 7 Commit 5.
 *
 * Given a completed DSA interview, this service:
 *   1. Collects the relevant context (question, discussion, source
 *      code, execution result, hidden-test summary).
 *   2. Delegates prompt assembly to codeEvaluationPrompt.
 *   3. Sends the prompt through the existing AI Provider Manager.
 *   4. Extracts + validates the JSON response.
 *   5. Returns a normalized evaluation payload the controller can
 *      persist on `interview.evaluation`.
 *
 * The service knows nothing about Express or Mongoose. Callers pass a
 * plain interview document (Mongoose docs work too because we only
 * read fields). The persistence side lives in the controller.
 *
 * Failure contract: this service NEVER throws. On any failure the
 * returned payload has `status: 'failed'` with a user-safe `error`.
 * The controller must not block interview completion on evaluation
 * failure — it should persist the failed marker and continue.
 */

const aiManager = require('./aiProviderManager');
const promptBuilder = require('./codeEvaluationPrompt.service');

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate a DSA interview end-to-end.
 *
 * @param {Object} interview   plain interview object (Mongoose doc OK)
 * @param {Object} [opts]
 * @param {string} [opts.sourceCode] override source code (frontend can
 *                                    submit their final buffer if it
 *                                    wasn't already sent via /submit).
 * @returns {Promise<EvaluationResult>}
 */
async function evaluate(interview, opts = {}) {
  if (!interview || interview.mode !== 'dsa') {
    return failed('Evaluation is only available for DSA interviews.');
  }

  const context = collectContext(interview, opts);
  if (!context.hasAnyContent) {
    return failed('There is no code or discussion to evaluate.');
  }

  const prompt = promptBuilder.build(context);

  let raw;
  try {
    raw = await aiManager.generate(prompt, {
      temperature: 0.3,   // extraction / structured judgment, not creativity
      maxTokens:   1200,
    });
  } catch (err) {
    console.error('[codeEvaluation] LLM call failed:', err?.message || err);
    return failed('The evaluation service is temporarily unavailable.');
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    console.error('[codeEvaluation] LLM returned no parseable JSON. First 300 chars:');
    console.error(String(raw || '').slice(0, 300));
    return failed('The evaluator returned an unreadable response.');
  }

  return normalize(parsed);
}

/**
 * Build the same context object the prompt would see. Exposed so
 * downstream tests can inspect what was gathered from the interview.
 */
function collectContext(interview, opts = {}) {
  const dsa = interview.config?.dsa || {};

  // Identify the "primary" DSA question — for a single-problem DSA
  // interview this is the last non-follow-up question. For multi-
  // question interviews it's still the most recent one (that's what
  // the candidate's final code targets).
  const questions = Array.isArray(interview.questions) ? interview.questions : [];
  let primaryIdx = -1;
  for (let i = questions.length - 1; i >= 0; i--) {
    if (!questions[i].isFollowUp) { primaryIdx = i; break; }
  }
  if (primaryIdx === -1 && questions.length) primaryIdx = questions.length - 1;
  const primary = primaryIdx >= 0 ? questions[primaryIdx] : null;

  // Discussion: every question + user answer from the primary onward
  // (the primary question + its follow-ups). This scopes discussion
  // to the problem being evaluated instead of the whole interview.
  const discussion = [];
  for (let i = primaryIdx; i < questions.length; i++) {
    const q = questions[i];
    if (!q) continue;
    if (q.questionText) {
      discussion.push({ role: 'assistant', content: q.questionText });
    }
    if (q.userAnswer && q.userAnswer.trim()) {
      discussion.push({ role: 'user', content: q.userAnswer });
    }
  }

  const lastExec = interview.lastExecution || null;
  // sourceCode preference order:
  //   1. explicit opts.sourceCode (frontend can push their live buffer)
  //   2. stored code from a prior /submit isn't available server-side —
  //      the code isn't persisted (only execution metadata is), so we
  //      rely on the caller to supply it. If neither is present we
  //      pass an empty string and let the prompt render "(no source)."
  const sourceCode = typeof opts.sourceCode === 'string' ? opts.sourceCode : '';

  const language = dsa.language || lastExec?.language || '';

  const hiddenTests = (lastExec && lastExec.kind === 'submit' && typeof lastExec.total === 'number')
    ? { passed: lastExec.passed, total: lastExec.total, status: lastExec.status }
    : null;

  const hasAnyContent = !!(sourceCode.trim()
    || discussion.some((d) => d.role === 'user' && d.content && d.content.trim())
    || lastExec);

  return {
    hasAnyContent,
    question: primary ? {
      text:       primary.questionText,
      topic:      primary.topic || dsa.topic || '',
      difficulty: primary.difficultyAtAsk || dsa.difficulty || '',
    } : null,
    candidateDiscussion: discussion,
    sourceCode,
    execution: lastExec,
    hiddenTests,
    language,
    interview: {
      role:          interview.config?.role,
      experience:    interview.config?.experienceLevel,
      mode:          interview.mode,
      dsaTopic:      dsa.topic,
      dsaDifficulty: dsa.difficulty,
    },
  };
}

// ── Normalization ───────────────────────────────────────────────────────────

const SCORE_KEYS = [
  'correctness', 'algorithm', 'timeComplexity', 'spaceComplexity',
  'codeQuality', 'communication', 'edgeCases',
];

function normalize(raw) {
  const scores = {};
  const inScores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
  for (const key of SCORE_KEYS) {
    scores[key] = clampScore(inScores[key]);
  }

  const overallScore = clampScore(raw.overallScore);

  const complexity = raw.complexity && typeof raw.complexity === 'object'
    ? {
        time:       trimStr(raw.complexity.time, 200) || 'Unknown',
        space:      trimStr(raw.complexity.space, 200) || 'Unknown',
        confidence: raw.complexity.confidence === 'confirmed' ? 'confirmed' : 'estimated',
      }
    : { time: 'Unknown', space: 'Unknown', confidence: 'estimated' };

  const recommendations = raw.recommendations && typeof raw.recommendations === 'object'
    ? {
        topics:   toStringArray(raw.recommendations.topics,   8, 120),
        problems: toStringArray(raw.recommendations.problems, 8, 160),
        concepts: toStringArray(raw.recommendations.concepts, 8, 160),
      }
    : { topics: [], problems: [], concepts: [] };

  return {
    status:                 'ready',
    overallScore,
    scores,
    complexity,
    strengths:              toStringArray(raw.strengths,   6, 200),
    weaknesses:             toStringArray(raw.weaknesses,  6, 200),
    recommendations,
    communicationFeedback:  trimStr(raw.communicationFeedback, 600),
    summary:                trimStr(raw.summary,                800),
    evaluatedAt:            new Date(),
    error:                  '',
  };
}

function failed(error) {
  return {
    status:                'failed',
    overallScore:          null,
    scores:                emptyScores(),
    complexity:            { time: '', space: '', confidence: 'estimated' },
    strengths:             [],
    weaknesses:            [],
    recommendations:       { topics: [], problems: [], concepts: [] },
    communicationFeedback: '',
    summary:               '',
    evaluatedAt:           new Date(),
    error,
  };
}

/**
 * Returned when the controller wants a placeholder before the
 * evaluation call runs (spec: interview completion must not fail
 * because evaluation failed; persist pending until retry).
 */
function pending() {
  return {
    status:                'pending',
    overallScore:          null,
    scores:                emptyScores(),
    complexity:            { time: '', space: '', confidence: 'estimated' },
    strengths:             [],
    weaknesses:            [],
    recommendations:       { topics: [], problems: [], concepts: [] },
    communicationFeedback: '',
    summary:               '',
    evaluatedAt:           null,
    error:                 '',
  };
}

function emptyScores() {
  const s = {};
  for (const k of SCORE_KEYS) s[k] = null;
  return s;
}

// ── Small utilities ─────────────────────────────────────────────────────────

function clampScore(v) {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function trimStr(v, max) {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function toStringArray(v, maxItems, maxItemChars) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s) continue;
    out.push(s.slice(0, maxItemChars));
    if (out.length >= maxItems) break;
  }
  return out;
}

function extractJsonObject(text) {
  if (!text) return null;
  let s = String(text).replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

module.exports = {
  evaluate,
  pending,
  collectContext,
  // Exported for tests / debugging.
  _internals: { normalize, extractJsonObject, SCORE_KEYS },
};
