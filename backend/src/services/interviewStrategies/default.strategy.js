/**
 * Default interview strategy — the no-op wrapper used by every non-DSA
 * interview mode (general, project, resume, behavioral, system_design,
 * custom). This exists so the strategy resolver can always return SOME
 * strategy without every call site needing a null check.
 *
 * All hooks return neutral defaults that preserve the pre-Sprint-7-Commit-2
 * behavior verbatim: the existing adaptive engine + prompt builder + AI
 * service continue to drive the interview exactly as they did before.
 *
 * Sprint 7 Commit 2.
 */

module.exports = {
  id: 'default',

  /**
   * Called from interviewEngine.firstQuestion to let the strategy shape
   * the seed decision (topic/difficulty/questionType). Return the same
   * decision unchanged for default behavior.
   */
  seedDecision(interview, decision) {
    return decision;
  },

  /**
   * Called from buildGenContext right before the context is handed to
   * ai.service.generateAdaptiveQuestion. Returns an object merged into
   * the context — for the default strategy, no additions.
   */
  augmentGenContext(/* interview, decision */) {
    return {};
  },

  /**
   * Optional prompt-insert block appended to the LLM prompt. Empty means
   * the AI service uses its stock prompt only.
   */
  buildPromptInsert(/* context */) {
    return '';
  },

  /**
   * Called by the hint controller. Default strategy has no hint concept.
   * Returning null tells the controller to reply with a 400 "Hints not
   * supported for this interview mode".
   */
  hintAvailable() {
    return false;
  },

  /**
   * Called after every question is appended to the interview. Default
   * strategy produces no tests — only DSA does.
   */
  seedHiddenTests() {
    return [];
  },
};
