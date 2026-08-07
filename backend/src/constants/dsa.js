/**
 * DSA constants — the SINGLE source of truth for DSA interview configuration.
 *
 * Sprint 7 Commit 1: introduced alongside the DSA interview mode. Every
 * consumer (Interview model, interviewBlueprint, interviewParser, and the
 * frontend selectors) reads from here so adding a topic or a language is
 * a one-file change.
 *
 * Language selection is METADATA ONLY in Commit 1 — no execution, no
 * Judge0, no editor. Later commits attach runtime behavior.
 */

const DSA_TOPICS = [
  'Arrays',
  'Strings',
  'Linked List',
  'Stack',
  'Queue',
  'Hashing',
  'Trees',
  'Binary Search Trees',
  'Heap',
  'Trie',
  'Graphs',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Recursion',
  'Binary Search',
  'Sliding Window',
  'Two Pointers',
  'Bit Manipulation',
  'Math',
  'Sorting',
  'Searching',
  'Intervals',
  'Prefix Sum',
  'Monotonic Stack',
  'Monotonic Queue',
  'Union Find',
  'Segment Tree',
  'Fenwick Tree',
  'Advanced Graphs',
];

// DSA difficulty adds 'mixed' on top of the base engine difficulties. The
// engine still runs per-question at easy/medium/hard — 'mixed' is a
// blueprint-level intent that varies difficulty across the question set.
const DSA_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

const DSA_LANGUAGES = [
  'cpp',
  'java',
  'python',
  'javascript',
  'typescript',
  'go',
  'rust',
  'csharp',
  'kotlin',
];

const DSA_QUESTION_COUNT = {
  MIN: 1,
  MAX: 20,
  DEFAULT: 5,
};

const TOPIC_SET = new Set(DSA_TOPICS.map((t) => t.toLowerCase()));
const DIFFICULTY_SET = new Set(DSA_DIFFICULTIES);
const LANGUAGE_SET = new Set(DSA_LANGUAGES);

function isValidTopic(t) {
  return typeof t === 'string' && TOPIC_SET.has(t.toLowerCase());
}

/**
 * Normalize a user-supplied topic to its canonical casing (as it appears
 * in DSA_TOPICS). Returns null when the topic is unknown.
 */
function canonicalTopic(t) {
  if (typeof t !== 'string') return null;
  const key = t.toLowerCase();
  return DSA_TOPICS.find((topic) => topic.toLowerCase() === key) || null;
}

function isValidDifficulty(d) {
  return typeof d === 'string' && DIFFICULTY_SET.has(d.toLowerCase());
}

function isValidLanguage(l) {
  return typeof l === 'string' && LANGUAGE_SET.has(l.toLowerCase());
}

module.exports = {
  DSA_TOPICS,
  DSA_DIFFICULTIES,
  DSA_LANGUAGES,
  DSA_QUESTION_COUNT,
  isValidTopic,
  canonicalTopic,
  isValidDifficulty,
  isValidLanguage,
};
