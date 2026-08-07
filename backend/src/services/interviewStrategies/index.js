/**
 * Interview strategy resolver — Sprint 7 Commit 2.
 *
 * Maps an interview `mode` to the strategy module that knows how to
 * shape questions, prompts, and hints for that mode. All non-DSA modes
 * currently fall through to the default (no-op) strategy so nothing
 * changes for them — the strategy pattern is additive.
 *
 * The engine consults getStrategy(interview.mode) at exactly three
 * spots: seed decision (first question), gen context augmentation
 * (every question), and hint generation (DSA only for now).
 */

const defaultStrategy = require('./default.strategy');
const dsaStrategy     = require('./dsaInterview.strategy');

const STRATEGIES = {
  dsa: dsaStrategy,
  // Additional strategies plug in here as they ship (behavioral, aptitude,
  // system_design, etc.). Until then they fall through to default.
};

function getStrategy(mode) {
  if (!mode) return defaultStrategy;
  return STRATEGIES[String(mode).toLowerCase()] || defaultStrategy;
}

module.exports = { getStrategy, defaultStrategy };
