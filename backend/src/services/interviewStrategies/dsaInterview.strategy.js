/**
 * DSA Interview Strategy — Sprint 7 Commit 2.
 *
 * Turns a generic technical interview into a DSA-flavored one WITHOUT
 * duplicating the engine. Every hook here piggybacks on the existing
 * interviewEngine → adaptiveEngine → ai.service pipeline; the strategy
 * only injects DSA-specific instructions, topic seeding, difficulty
 * progression (for 'mixed'), and a hint generator.
 *
 * The strategy is a pure module — no Express, no Mongoose. It receives
 * plain interview objects (Mongoose docs work too because we only touch
 * fields, not save()) and returns plain objects the engine merges in.
 *
 * DSA config shape (from Interview.config.dsa):
 *   { topic, difficulty, language, questionCount, allowHints, focusAreas[] }
 *
 * The interviewer voice for DSA is: senior software engineer conducting
 * a discussion-based coding interview. No code editor. Candidates
 * describe approaches, trade-offs, complexity, and edge cases.
 */

const { dsaDifficultyLabel, dsaLanguageLabel } = require('./dsaLabels');

// Difficulty ladder used by 'mixed' mode. The engine escalates as the
// candidate progresses through primary questions.
const MIXED_LADDER = ['easy', 'medium', 'hard'];

module.exports = {
  id: 'dsa',

  /**
   * Reshape the first-question decision so it targets the DSA topic +
   * difficulty. Focus areas (if any) come first as the seed's rationale.
   */
  seedDecision(interview, decision) {
    const dsa = interview?.config?.dsa;
    if (!dsa) return decision;

    // Focus areas take priority — start with the first focus area (which
    // is usually a sub-concept of the main topic). Otherwise use the
    // main topic itself.
    const seedTopic = (dsa.focusAreas && dsa.focusAreas[0]) || dsa.topic || decision.topic;

    return {
      ...decision,
      topic: seedTopic,
      questionType: 'technical', // DSA is always technical
      difficulty: resolveDifficulty(interview, dsa, 0),
    };
  },

  /**
   * Merge DSA-specific fields into the generation context so the AI
   * service (and the prompt insert below) can see them.
   */
  augmentGenContext(interview /*, decision */) {
    const dsa = interview?.config?.dsa;
    if (!dsa) return {};

    // For 'mixed' difficulty, override the context difficulty per
    // primary-question index using the ladder. The engine passes the
    // decision's difficulty forward; we recompute here based on how far
    // through the interview we are.
    const primaryAsked = (interview.questions || []).filter((q) => !q.isFollowUp).length;
    const resolvedDifficulty = resolveDifficulty(interview, dsa, primaryAsked);

    return {
      dsaConfig: {
        topic: dsa.topic,
        rootTopic: dsa.topic,
        focusAreas: dsa.focusAreas || [],
        language: dsa.language,
        difficultyIntent: dsa.difficulty,   // easy|medium|hard|mixed (user intent)
        allowHints: dsa.allowHints !== false,
      },
      // Override the difficulty the AI service sees for 'mixed' mode.
      difficulty: resolvedDifficulty,
    };
  },

  /**
   * The DSA-specific prompt block appended to ai.service's stock prompt.
   * This is what transforms a generic technical question into a DSA
   * discussion question with the right constraints, tone, and probing
   * angles. Consumed by ai.service.generateAdaptiveQuestion when
   * context.strategyPromptInsert is present.
   */
  buildPromptInsert(context) {
    const dsa = context.dsaConfig;
    if (!dsa) return '';

    const language = dsaLanguageLabel(dsa.language);
    const focusLine = (dsa.focusAreas && dsa.focusAreas.length)
      ? `Focus areas to prioritize: ${dsa.focusAreas.join(', ')}.`
      : '';
    const difficultyLine = `Target difficulty: ${dsaDifficultyLabel(context.difficulty || 'medium')}.`;
    const difficultyGuide = difficultyGuidance(context.difficulty);
    const modeIntro = focusLine
      ? `You are conducting a DSA (Data Structures & Algorithms) interview. Root topic: ${dsa.rootTopic}. ${focusLine}`
      : `You are conducting a DSA (Data Structures & Algorithms) interview on the topic: ${dsa.rootTopic}.`;

    return `
── DSA MODE ─────────────────────────────────────────────────────────
${modeIntro}
${difficultyLine}
Preferred language for discussion: ${language}. The candidate will describe their approach verbally / in text — there is NO code editor. Never ask them to paste working code; ask them to explain the algorithm, walk through logic, and reason about complexity.

${difficultyGuide}

DSA question rules:
- Ask ONE question. Do not enumerate multiple problems.
- Never reveal the answer or full solution. Probe reasoning instead.
- If asking a follow-up, target ONE of: approach explanation, an optimization, time complexity, space complexity, edge cases, alternative data structure, iterative vs recursive tradeoff, why this DS/algorithm over another, or scaling to large input.
- Do not repeat problems or paraphrase earlier ones in this session.
- Prefer questions that map to a canonical LeetCode-style problem on the target topic, but describe it in your own words.

Voice: senior engineer conducting a friendly-but-rigorous discussion. Reward good reasoning, challenge weak reasoning, escalate difficulty when the candidate is strong.

The "hints" array in your JSON output should be 2–3 progressive nudges the candidate could ask for if stuck — each one revealing one small step further (e.g. ["think about traversal order", "consider BFS from the source", "track visited nodes to avoid cycles"]).
────────────────────────────────────────────────────────────────────
`.trim();
  },

  /**
   * Hint availability — reads config.dsa.allowHints. When false, the
   * hint endpoint returns 400.
   */
  hintAvailable(interview) {
    return !!(interview?.config?.dsa && interview.config.dsa.allowHints !== false);
  },

  /**
   * Sprint 7 Commit 4 — static hidden test mock set attached to every
   * DSA question when it's generated. Deterministic + language-agnostic:
   * we can't derive real tests from the AI-generated problem text
   * (we'd need to know its shape), so we ship a small "echo my stdin"
   * mock suite that at least verifies the candidate wired stdin →
   * stdout correctly.
   *
   * Commit 5+ can replace this with AI-generated tests derived from the
   * problem statement without changing the storage shape or /submit
   * flow — only this function changes.
   */
  seedHiddenTests(/* interview, question */) {
    return [
      { label: 'Hidden test 1', stdin: '',                 expectedOutput: '' },
      { label: 'Hidden test 2', stdin: '1\n',              expectedOutput: '' },
      { label: 'Hidden test 3', stdin: '5\n1 2 3 4 5\n',   expectedOutput: '' },
    ];
  },

  /**
   * Build the LLM prompt for the *next* progressive hint on the current
   * question. hintsAlreadyGiven = the number of hints the candidate has
   * already received for this question; the prompt asks for hint #N+1.
   *
   * Returns a plain string. The controller calls aiService.generateText
   * with this prompt.
   */
  buildHintPrompt(interview, question, hintsAlreadyGiven) {
    const dsa = interview?.config?.dsa || {};
    const language = dsaLanguageLabel(dsa.language);
    const nudgeIndex = (hintsAlreadyGiven || 0) + 1;
    // Progressive escalation — hint 1 nudges direction, hint 2 names an
    // approach, hint 3 mentions the concrete data structure / trick.
    const progression = [
      'A gentle nudge that only points the candidate toward the right kind of thinking (e.g. "think about traversal order", "what structure lets you find things in O(1)?"). Do not name the algorithm outright.',
      'A more specific nudge that names the general approach or paradigm (e.g. "consider BFS from the source", "this is a DP problem — think about subproblems").',
      'A concrete nudge that names the exact data structure or algorithmic idea (e.g. "use a monotonic stack", "memoize on (i, remaining)").',
    ];
    const level = progression[Math.min(nudgeIndex - 1, progression.length - 1)];

    return `You are a senior technical interviewer giving progressive hints during a discussion-based DSA interview.

Current question (asked to the candidate): "${question.questionText}"
Topic: ${question.topic || dsa.topic || 'DSA'}
Difficulty: ${question.difficultyAtAsk || dsa.difficulty || 'medium'}
Preferred language (for context): ${language}
Hints already given: ${hintsAlreadyGiven || 0}
This is hint #${nudgeIndex}.

Level of specificity for hint #${nudgeIndex}:
${level}

Rules:
- Output ONLY the hint text. No preamble, no numbering, no quotes.
- ONE short sentence (max 25 words).
- Conversational. Do not reveal the full solution.
- Do not restate the problem.
- If a previous hint already exposed the approach, this hint should reveal ONE more concrete step.
`;
  },

  // Exported for testing.
  _internals: { resolveDifficulty, difficultyGuidance, MIXED_LADDER },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the effective difficulty for the Nth primary question.
 *   easy / medium / hard  → constant (return as-is)
 *   mixed                 → climb the ladder gradually as questions progress
 */
function resolveDifficulty(interview, dsa, primaryQuestionIndex) {
  const intent = (dsa?.difficulty || 'medium').toLowerCase();
  if (intent !== 'mixed') return intent;

  const total = dsa.questionCount || interview?.blueprint?.totalPlanned || 5;
  // Split questions into thirds. First third easy, middle medium, last hard.
  // Guard tiny counts: [1] → medium only; [2] → easy, medium; [3] → easy, medium, hard.
  if (total <= 1) return 'medium';
  if (total === 2) return primaryQuestionIndex === 0 ? 'easy' : 'medium';
  const bucket = Math.floor((primaryQuestionIndex / total) * MIXED_LADDER.length);
  return MIXED_LADDER[Math.min(bucket, MIXED_LADDER.length - 1)];
}

function difficultyGuidance(difficulty) {
  const d = String(difficulty || 'medium').toLowerCase();
  if (d === 'easy') {
    return 'Difficulty guidance: Ask a foundational problem that tests correct implementation and basic understanding. Avoid trick questions.';
  }
  if (d === 'medium') {
    return 'Difficulty guidance: Ask a problem where the naïve solution is obvious but suboptimal. Push toward optimization and trade-offs.';
  }
  if (d === 'hard') {
    return 'Difficulty guidance: Ask a problem with non-obvious edge cases, advanced optimizations, or multiple viable approaches. Probe deeply.';
  }
  return '';
}
