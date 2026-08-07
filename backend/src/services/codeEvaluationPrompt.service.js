/**
 * codeEvaluationPrompt — assembles the LLM prompt that produces a
 * structured technical evaluation of a DSA interview.
 *
 * Sprint 7 Commit 5:
 *   • Pure text assembly. No Express, no Mongoose, no network.
 *   • Provider-agnostic. The caller (codeEvaluation.service) sends the
 *     returned string through the existing AI Provider Manager.
 *   • The prompt asks the LLM to output ONE JSON object matching the
 *     shape documented below. codeEvaluation.service is responsible for
 *     JSON extraction + validation; this file only builds the request.
 *
 * Input shape (see build()):
 *   {
 *     question,               // { text, topic, difficulty }
 *     candidateDiscussion,    // [{ role, content }]  chronological
 *     sourceCode,             // string
 *     execution,              // normalized lastExecution or null
 *     hiddenTests,            // { passed, total, status } or null
 *     language,               // 'cpp' | 'python' | …
 *     interview,              // { role, experience, mode, dsaTopic, dsaDifficulty }
 *   }
 */

const MAX_DISCUSSION_TURNS  = 12;
const MAX_TURN_CHARS        = 900;
const MAX_QUESTION_CHARS    = 900;
const MAX_SOURCE_CHARS      = 6000;
const MAX_STDERR_CHARS      = 800;
const MAX_COMPILE_CHARS     = 800;

// The score keys and their weights are DESCRIPTIVE only — we tell the
// LLM what each dimension measures but let it decide numeric values.
// Do NOT compute overallScore in code (spec: "Let AI suggest values").
const SCORE_DIMENSIONS = [
  ['correctness',      'Does the solution actually solve the problem correctly?'],
  ['algorithm',        'Was the choice of algorithm appropriate for the constraints?'],
  ['timeComplexity',   'How efficient is the solution in time? Consider execution result too.'],
  ['spaceComplexity',  'How efficient is the solution in memory?'],
  ['codeQuality',      'Readability, naming, structure, use of language idioms.'],
  ['communication',    'How clearly did the candidate explain their reasoning during the interview?'],
  ['edgeCases',        'Did the candidate consider and handle edge cases?'],
];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the evaluation prompt.
 *
 * @param {Object} input   see file header
 * @returns {string}       prompt text
 */
function build(input) {
  const {
    question           = {},
    candidateDiscussion = [],
    sourceCode         = '',
    execution          = null,
    hiddenTests        = null,
    language           = '',
    interview          = {},
  } = input || {};

  const parts = [];

  parts.push(header());
  parts.push('');
  parts.push('[INTERVIEW META]');
  parts.push(renderInterviewMeta(interview, language));
  parts.push('');
  parts.push('[QUESTION]');
  parts.push(renderQuestion(question));
  parts.push('');
  parts.push('[CANDIDATE DISCUSSION]');
  parts.push(renderDiscussion(candidateDiscussion));
  parts.push('');
  parts.push('[SOURCE CODE]');
  parts.push(renderSource(sourceCode, language));
  parts.push('');
  parts.push('[EXECUTION]');
  parts.push(renderExecution(execution));
  parts.push('');
  parts.push('[HIDDEN TESTS]');
  parts.push(renderHiddenTests(hiddenTests));
  parts.push('');
  parts.push(instructions());
  parts.push('');
  parts.push(outputSchema());

  return parts.join('\n');
}

// ── Sections ────────────────────────────────────────────────────────────────

function header() {
  return `You are a senior software engineer conducting a rigorous post-interview evaluation of a candidate on a DSA (data-structures and algorithms) problem. You review both what they SAID during the interview and what they WROTE as their solution. Your evaluation must be constructive, specific, and grounded strictly in the material provided — do NOT invent details.`;
}

function renderInterviewMeta(interview, language) {
  const lines = [];
  if (interview.role) lines.push(`Role: ${String(interview.role).replace(/_/g, ' ')}`);
  if (interview.experience) lines.push(`Experience: ${interview.experience}`);
  if (interview.dsaTopic) lines.push(`DSA topic: ${interview.dsaTopic}`);
  if (interview.dsaDifficulty) lines.push(`DSA difficulty: ${interview.dsaDifficulty}`);
  if (language) lines.push(`Programming language: ${language}`);
  return lines.length ? lines.join('\n') : '(no metadata provided)';
}

function renderQuestion(q) {
  if (!q || !q.text) return '(no question text — evaluate discussion + code alone)';
  const text = truncate(String(q.text), MAX_QUESTION_CHARS);
  const meta = [];
  if (q.topic) meta.push(`topic: ${q.topic}`);
  if (q.difficulty) meta.push(`asked difficulty: ${q.difficulty}`);
  return meta.length
    ? `${text}\n(${meta.join(' · ')})`
    : text;
}

function renderDiscussion(turns) {
  if (!Array.isArray(turns) || turns.length === 0) {
    return '(the candidate did not have a spoken/typed discussion for this problem)';
  }
  const kept = turns.slice(-MAX_DISCUSSION_TURNS);
  return kept
    .map((t) => {
      const role = t?.role === 'assistant' ? 'Interviewer' : 'Candidate';
      const body = truncate(String(t?.content || '').trim(), MAX_TURN_CHARS);
      return body ? `${role}: ${body}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function renderSource(code, language) {
  if (!code || !code.trim()) return '(no source code was written)';
  const trimmed = truncate(String(code), MAX_SOURCE_CHARS);
  return `\`\`\`${language || ''}\n${trimmed}\n\`\`\``;
}

function renderExecution(exec) {
  if (!exec) {
    return '(no execution result available — the candidate did not run their code, or execution was not attempted)';
  }
  const lines = [];
  if (exec.kind)   lines.push(`Last action: ${exec.kind}`);
  if (exec.status) lines.push(`Status: ${exec.status}`);
  if (exec.executionTime != null) lines.push(`Time: ${Number(exec.executionTime).toFixed(3)} s`);
  if (exec.memory != null)        lines.push(`Memory: ${exec.memory} KB`);
  if (exec.exitCode != null)      lines.push(`Exit code: ${exec.exitCode}`);
  if (exec.compileOutput) {
    lines.push(`Compile output:\n${truncate(exec.compileOutput, MAX_COMPILE_CHARS)}`);
  }
  if (exec.stderr) {
    lines.push(`stderr:\n${truncate(exec.stderr, MAX_STDERR_CHARS)}`);
  }
  return lines.length ? lines.join('\n') : '(execution recorded but with no useful details)';
}

function renderHiddenTests(t) {
  if (!t || typeof t.total !== 'number' || t.total === 0) {
    return '(hidden tests were not attempted for this problem)';
  }
  const pct = t.total > 0 ? Math.round(((t.passed || 0) / t.total) * 100) : 0;
  const parts = [`Passed ${t.passed || 0} / ${t.total} hidden tests (${pct}%).`];
  if (t.status) parts.push(`Aggregate status: ${t.status}.`);
  return parts.join(' ');
}

function instructions() {
  const dims = SCORE_DIMENSIONS
    .map(([key, desc]) => `  • ${key}: ${desc}`)
    .join('\n');
  return `INSTRUCTIONS:
- Judge the candidate strictly on the material above. Do NOT invent facts about their explanation, code, or execution.
- Every score is an integer 0–100.
- Score each dimension independently. The overallScore is your own weighted judgment — do not average mechanically; weight what mattered most for this interview.
- Score dimensions:
${dims}
- If the code did not compile, correctness cannot be high. Explain that in weaknesses.
- If hidden tests failed, factor that into correctness and edge-case scoring.
- If no execution occurred, evaluate discussion + code only; keep confidence flags honest.
- Complexity: infer time/space complexity from the code AND the candidate's stated reasoning. If uncertain, mark complexityConfidence "estimated"; if confident, "confirmed".
- Recommendations must be ACTIONABLE. Prefer specific topics ("Union Find", "Monotonic Stack", "Sliding Window on strings") over vague advice ("study more").
- summary is 2–4 sentences, professional, plain prose, no bullet points inside.
- Do NOT praise gratuitously. Do NOT sugar-coat weaknesses. Be direct but constructive.`;
}

function outputSchema() {
  return `Return ONLY a single JSON object matching this schema — no prose, no markdown fences:

{
  "overallScore": 0-100,
  "scores": {
    "correctness":     0-100,
    "algorithm":       0-100,
    "timeComplexity":  0-100,
    "spaceComplexity": 0-100,
    "codeQuality":     0-100,
    "communication":   0-100,
    "edgeCases":       0-100
  },
  "complexity": {
    "time":       "e.g. O(n log n) — 1 sentence justification",
    "space":      "e.g. O(n) — 1 sentence justification",
    "confidence": "confirmed" | "estimated"
  },
  "strengths":       ["short bullet", "short bullet", "..."],
  "weaknesses":      ["short bullet", "short bullet", "..."],
  "recommendations": {
    "topics":   ["Union Find", "Monotonic Queue", "..."],
    "problems": ["LeetCode 210 · Course Schedule II", "..."],
    "concepts": ["revisit BFS vs DFS trade-offs", "..."]
  },
  "communicationFeedback": "2–3 sentence assessment of how well they explained their thinking during the interview, distinct from code quality.",
  "summary": "2–4 sentence professional summary of the candidate's performance on this problem."
}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s, max) {
  if (!s) return '';
  const str = String(s);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

module.exports = {
  build,
  // Exported for tests.
  SCORE_DIMENSIONS,
  _internals: { renderQuestion, renderDiscussion, renderSource, renderExecution, renderHiddenTests },
};
