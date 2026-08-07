const aiProviderManager = require('./aiProviderManager');
const {
  DSA_TOPICS,
  DSA_LANGUAGES,
  DSA_QUESTION_COUNT,
  canonicalTopic,
  isValidDifficulty: isValidDsaDifficulty,
  isValidLanguage: isValidDsaLanguage,
} = require('../constants/dsa');

/**
 * interviewParser — natural-language → structured Interview Draft.
 *
 * This is an INTERPRETER, not a creator. It never touches the database.
 * It never creates an Interview. Its only job: translate a user's
 * freeform description into a structured draft that the Review page can
 * display and let the user correct.
 *
 * Pipeline:
 *   1. Build the extraction prompt with the user's text + toggle hints.
 *   2. Call aiProviderManager.generate with low temperature (extraction,
 *      not creative writing).
 *   3. Robust JSON extract (tolerant of markdown fences, leading prose).
 *   4. Normalize + validate against known enums; clamp numerics.
 *   5. Return { draft, confidence, unknown } to the controller.
 *
 * If the LLM output is unusable, throw ParserError so the controller can
 * respond 400 with a friendly message.
 */

class ParserError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ParserError';
    if (opts.cause) this.cause = opts.cause;
  }
}

// ── Known enums — mirror the interview creation contract ─────────────────

const ROLE_ENUM = [
  'frontend_developer', 'backend_developer', 'fullstack_developer',
  'sde', 'data_analyst', 'hr', 'other',
];
const EXPERIENCE_ENUM = ['fresher', '1-2_years', '3+_years'];
const COMPANY_TYPE_ENUM = ['faang', 'startup', 'service_based', 'product_based', 'any'];
const INTERVIEW_TYPE_ENUM = ['technical', 'hr', 'behavioral', 'system_design', 'mixed'];
const DIFFICULTY_ENUM = ['easy', 'medium', 'hard'];
const PRESSURE_ENUM = ['relaxed', 'standard', 'intense'];
const FEEDBACK_MODE_ENUM = ['live', 'end_only'];

// Modes the parser recognizes. Mirrors interviewBlueprint.VALID_MODES.
// The parser leaves mode='general' when the prompt doesn't clearly imply
// a specialized mode; the Review page presents mode-specific fields when
// applicable.
const MODE_ENUM = [
  'general', 'project', 'resume', 'dsa', 'aptitude', 'behavioral', 'system_design', 'custom',
];

// Fields the Review page renders. The order here is stable across the
// draft, confidence, and unknown structures.
const FIELDS = [
  'company', 'role', 'interviewType', 'experience', 'difficulty',
  'duration', 'questionCount', 'personality', 'pressure', 'round',
  'topics', 'useResume', 'useProjects', 'followUps', 'feedbackMode',
  'companyType',
  // Sprint 7 Commit 1 — DSA-only fields. Empty/null for non-DSA modes.
  'mode', 'dsaTopic', 'dsaDifficulty', 'dsaLanguage', 'dsaQuestionCount',
];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a user prompt into a structured Interview Draft.
 *
 * @param {Object} input
 * @param {string} input.prompt
 * @param {boolean} input.useResume    frontend toggle — parser respects but LLM may override
 * @param {boolean} input.useProjects
 * @returns {{ draft: Object, confidence: Object, unknown: string[] }}
 */
async function parsePrompt({ prompt, useResume = false, useProjects = false }) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    throw new ParserError('Prompt is too short to interpret.');
  }

  const llmPrompt = buildPrompt({ prompt: prompt.trim(), useResume, useProjects });

  let raw;
  try {
    raw = await aiProviderManager.generate(llmPrompt, {
      temperature: 0.1,
      maxTokens: 900,
    });
  } catch (err) {
    console.error('[interviewParser] LLM call failed:', err.message);
    throw new ParserError('Interview parsing service is temporarily unavailable.', { cause: err });
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    console.error('[interviewParser] LLM returned no parseable JSON. First 400 chars:');
    console.error(String(raw || '').slice(0, 400));
    throw new ParserError('Unable to understand interview request.');
  }

  return normalize(parsed, { useResume, useProjects });
}

// ── Prompt construction ─────────────────────────────────────────────────────

function buildPrompt({ prompt, useResume, useProjects }) {
  const dsaTopicList = DSA_TOPICS.join(', ');
  const dsaLangList = DSA_LANGUAGES.join(', ');
  return `You are an interview-configuration parser for an AI interview prep platform. Extract structured fields from a user's freeform description.

Supported DSA topics: ${dsaTopicList}.
Supported DSA languages: ${dsaLangList}.

The user's freeform request:
"""
${prompt}
"""

User toggles (respect these unless the freeform text explicitly overrides):
- useResume:   ${useResume ? 'true' : 'false'}
- useProjects: ${useProjects ? 'true' : 'false'}

Return a SINGLE JSON object — no prose, no markdown fences. Shape:

{
  "reasons": {
    "company":       "1-sentence explanation, mentioning which phrases in the prompt led to this value",
    "role":          "same",
    "interviewType": "same",
    "experience":    "same",
    "difficulty":    "same",
    "duration":      "same",
    "questionCount": "same",
    "personality":   "same",
    "pressure":      "same",
    "round":         "same",
    "topics":        "same",
    "useResume":     "same",
    "useProjects":   "same",
    "followUps":     "same",
    "feedbackMode":  "same",
    "companyType":   "same",
    "mode":              "same",
    "dsaTopic":          "same",
    "dsaDifficulty":     "same",
    "dsaLanguage":       "same",
    "dsaQuestionCount":  "same"
  },
  "draft": {
    "company":       "string|null",              // e.g. "Amazon" or null
    "role":          "frontend_developer|backend_developer|fullstack_developer|sde|data_analyst|hr|other|null",
    "interviewType": "technical|hr|behavioral|system_design|mixed|null",
    "experience":    "fresher|1-2_years|3+_years|null",
    "difficulty":    "easy|medium|hard|null",
    "duration":      "integer minutes|null",     // e.g. 30
    "questionCount": "integer 3-15|null",        // derived from duration if absent
    "personality":   "string|null",              // e.g. "Google" or "Amazon", freeform
    "pressure":      "relaxed|standard|intense|null",
    "round":         "general|technical|behavioral|system_design|hiring_manager|null",
    "topics":        ["string", "..."],          // [] when none stated
    "useResume":     "boolean",                  // start from toggle, override on explicit user request
    "useProjects":   "boolean",
    "followUps":     "boolean",                  // true if user mentions follow-ups / drilling
    "feedbackMode":  "live|end_only|null",
    "companyType":   "faang|startup|service_based|product_based|any|null",
    "mode":              "general|project|resume|dsa|aptitude|behavioral|system_design|custom|null",
    "dsaTopic":          "one of the supported topics|null",
    "dsaDifficulty":     "easy|medium|hard|mixed|null",
    "dsaLanguage":       "cpp|java|python|javascript|typescript|go|rust|csharp|kotlin|null",
    "dsaQuestionCount":  "integer 1-20|null"
  },
  "confidence": {
    "company": 0.0-1.0, "role": 0.0-1.0, "interviewType": 0.0-1.0,
    "experience": 0.0-1.0, "difficulty": 0.0-1.0, "duration": 0.0-1.0,
    "questionCount": 0.0-1.0, "personality": 0.0-1.0, "pressure": 0.0-1.0,
    "round": 0.0-1.0, "topics": 0.0-1.0, "useResume": 0.0-1.0,
    "useProjects": 0.0-1.0, "followUps": 0.0-1.0, "feedbackMode": 0.0-1.0,
    "companyType": 0.0-1.0,
    "mode": 0.0-1.0, "dsaTopic": 0.0-1.0, "dsaDifficulty": 0.0-1.0,
    "dsaLanguage": 0.0-1.0, "dsaQuestionCount": 0.0-1.0
  },
  "unknown": ["field", "..."]
}

RULES:
- Never invent values. If a field cannot be determined from the text, set it to null AND add its name to unknown[].
- Confidence must reflect how strongly the text supports the value. Guessed values MUST have confidence <= 0.5.
- Each reason must be at most one sentence. Reference specific words or phrases from the user's text when possible. When a field is null/unknown, the reason should be "Not mentioned in your prompt." or similar.
- "Amazon SDE-1" → company="Amazon", role="sde", experience="1-2_years".
- "Backend internship" → role="backend_developer", experience="fresher".
- "Behave like Google" or "Google-style" → personality="Google".
- "Be strict" or "grill me" → pressure="intense", followUps=true.
- "Don't help me" / "no hints" → feedbackMode="end_only".
- "Ask follow-up questions" → followUps=true.
- Duration → questionCount mapping: ~5 minutes per question. 30min → 6 questions, 15min → 3. Clamp questionCount to [3, 15].
- Company type inference: FAANG names → "faang"; TCS/Infosys/Wipro → "service_based"; Razorpay/Zomato → "product_based"; anything explicitly small → "startup".
- DSA detection: if the user mentions coding topics ("DP", "graphs", "arrays", "leetcode-style", "algorithms", "data structures", "DSA") OR names a language for practice ("in C++", "in Python"), set mode="dsa".
- For DSA mode ONLY:
  * dsaTopic — the SINGLE most-specific topic from the supported list. "DP" → "Dynamic Programming". "graph problems" → "Graphs". "linked lists" → "Linked List". Leave null if none is clearly stated.
  * dsaDifficulty — "easy"|"medium"|"hard"|"mixed". "mix of levels" → "mixed".
  * dsaLanguage — normalized to the supported codes: "C++" → "cpp", "JS" → "javascript", "TS" → "typescript", "C#" → "csharp".
  * dsaQuestionCount — "five hard DP questions" → 5. Clamp to [1, 20].
- If mode is NOT "dsa", set all dsa* fields to null.
- Examples:
  * "I want a medium graph interview in C++" → mode="dsa", dsaTopic="Graphs", dsaDifficulty="medium", dsaLanguage="cpp".
  * "Five hard DP questions" → mode="dsa", dsaTopic="Dynamic Programming", dsaDifficulty="hard", dsaQuestionCount=5, dsaLanguage=null.
- Output ONLY the JSON object.
`;
}

// ── JSON extraction (same pattern as repoAnalysis.service) ──────────────────

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

// ── Normalization ───────────────────────────────────────────────────────────
//
// The LLM is untrusted output. Every field is validated against its enum
// or clamped to a range. Fields that fail validation are set to null and
// added to unknown[] with confidence 0.

function normalize(raw, { useResume, useProjects }) {
  const inDraft = raw.draft || {};
  const inConfidence = raw.confidence || {};
  const inReasons = (raw.reasons && typeof raw.reasons === 'object') ? raw.reasons : {};
  const inUnknown = new Set(Array.isArray(raw.unknown) ? raw.unknown : []);

  const draft = {};
  const confidence = {};
  const reasons = {};

  const setEnum = (key, val, enumList) => {
    if (val == null) { draft[key] = null; return; }
    const s = String(val).toLowerCase();
    if (enumList.includes(s)) { draft[key] = s; return; }
    draft[key] = null;
    inUnknown.add(key);
  };
  const setInt = (key, val, lo, hi) => {
    if (val == null) { draft[key] = null; return; }
    const n = Math.round(Number(val));
    if (!Number.isFinite(n)) { draft[key] = null; inUnknown.add(key); return; }
    draft[key] = Math.max(lo, Math.min(hi, n));
  };
  const setStr = (key, val) => {
    if (val == null || val === '') { draft[key] = null; return; }
    draft[key] = String(val).trim().slice(0, 120);
  };
  const setBool = (key, val, fallback) => {
    if (typeof val === 'boolean') { draft[key] = val; return; }
    draft[key] = !!fallback;
  };

  setStr('company', inDraft.company);
  setEnum('role', inDraft.role, ROLE_ENUM);
  setEnum('interviewType', inDraft.interviewType, INTERVIEW_TYPE_ENUM);
  setEnum('experience', inDraft.experience, EXPERIENCE_ENUM);
  setEnum('difficulty', inDraft.difficulty, DIFFICULTY_ENUM);
  setInt('duration', inDraft.duration, 5, 120);
  setInt('questionCount', inDraft.questionCount, 3, 15);
  setStr('personality', inDraft.personality);
  setEnum('pressure', inDraft.pressure, PRESSURE_ENUM);
  setStr('round', inDraft.round);
  draft.topics = Array.isArray(inDraft.topics)
    ? inDraft.topics.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];
  setBool('useResume', inDraft.useResume, useResume);
  setBool('useProjects', inDraft.useProjects, useProjects);
  setBool('followUps', inDraft.followUps, false);
  setEnum('feedbackMode', inDraft.feedbackMode, FEEDBACK_MODE_ENUM);
  setEnum('companyType', inDraft.companyType, COMPANY_TYPE_ENUM);

  // ── DSA fields (Sprint 7 Commit 1) ──────────────────────────────────
  setEnum('mode', inDraft.mode, MODE_ENUM);

  // Topic — validate against constants and normalize to canonical casing.
  const rawTopic = inDraft.dsaTopic;
  const canon = canonicalTopic(rawTopic);
  if (canon) {
    draft.dsaTopic = canon;
  } else if (rawTopic == null || rawTopic === '') {
    draft.dsaTopic = null;
  } else {
    draft.dsaTopic = null;
    inUnknown.add('dsaTopic');
  }

  setEnum('dsaDifficulty', inDraft.dsaDifficulty, ['easy', 'medium', 'hard', 'mixed']);
  // Language — accept the LLM's normalized code OR common human spellings.
  const langRaw = typeof inDraft.dsaLanguage === 'string' ? inDraft.dsaLanguage.toLowerCase().trim() : '';
  const langAlias = {
    'c++': 'cpp',
    'js': 'javascript',
    'ts': 'typescript',
    'c#': 'csharp',
  };
  const langNorm = langAlias[langRaw] || langRaw;
  if (!langRaw) {
    draft.dsaLanguage = null;
  } else if (isValidDsaLanguage(langNorm)) {
    draft.dsaLanguage = langNorm;
  } else {
    draft.dsaLanguage = null;
    inUnknown.add('dsaLanguage');
  }

  setInt('dsaQuestionCount', inDraft.dsaQuestionCount, DSA_QUESTION_COUNT.MIN, DSA_QUESTION_COUNT.MAX);

  // If mode wasn't set but any dsa* field was extracted, upgrade to 'dsa'.
  if (draft.mode == null && (draft.dsaTopic || draft.dsaDifficulty || draft.dsaLanguage)) {
    draft.mode = 'dsa';
  }
  // Conversely, if mode isn't 'dsa', wipe the dsa fields so downstream
  // callers don't see stray values.
  if (draft.mode !== 'dsa') {
    draft.dsaTopic = null;
    draft.dsaDifficulty = null;
    draft.dsaLanguage = null;
    draft.dsaQuestionCount = null;
  }

  // If questionCount is null but duration is known, derive it (~5 min/question).
  if (draft.questionCount == null && typeof draft.duration === 'number') {
    draft.questionCount = Math.max(3, Math.min(15, Math.round(draft.duration / 5)));
    inUnknown.delete('questionCount');
  }

  // Normalize confidence — clamp to [0, 1], default 0.5 when absent.
  // Fields we couldn't resolve get confidence 0.
  for (const field of FIELDS) {
    const c = Number(inConfidence[field]);
    if (inUnknown.has(field)) {
      confidence[field] = 0;
    } else if (Number.isFinite(c)) {
      confidence[field] = Math.max(0, Math.min(1, c));
    } else {
      confidence[field] = 0.5;
    }
    // Reasons — one-sentence explanations per field. Trim to keep tooltip
    // sizes reasonable; drop non-strings entirely. Fields the LLM didn't
    // explain get an empty string so the UI can suppress the tooltip.
    const r = inReasons[field];
    reasons[field] = typeof r === 'string' ? r.trim().slice(0, 220) : '';
  }

  return {
    draft,
    confidence,
    reasons,
    unknown: Array.from(inUnknown).filter((f) => FIELDS.includes(f)),
  };
}

module.exports = { parsePrompt, ParserError, FIELDS };
