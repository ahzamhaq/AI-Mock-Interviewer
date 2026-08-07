/**
 * Small server-side label helpers for DSA strategy prompts.
 *
 * Kept separate from constants/dsa.js because those constants are the
 * validation-facing source of truth (topic set, language enum, etc.).
 * Labels here are for prompt readability only — if the enum grows, add
 * a mapping row and the strategy renders correctly.
 */

const LANGUAGE_LABELS = {
  cpp: 'C++',
  java: 'Java',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  csharp: 'C#',
  kotlin: 'Kotlin',
};

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  mixed: 'Mixed',
};

function dsaLanguageLabel(v) {
  if (!v) return 'the candidate\'s preferred language';
  return LANGUAGE_LABELS[String(v).toLowerCase()] || v;
}

function dsaDifficultyLabel(v) {
  if (!v) return 'Medium';
  return DIFFICULTY_LABELS[String(v).toLowerCase()] || v;
}

module.exports = { dsaLanguageLabel, dsaDifficultyLabel };
