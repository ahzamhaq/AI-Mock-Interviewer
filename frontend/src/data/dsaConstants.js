/**
 * DSA constants — frontend mirror of backend/src/constants/dsa.js.
 *
 * Sprint 7 Commit 1: DSA topic/difficulty/language enums for the Guided
 * Setup DSA step, Review page display, and Quick AI Setup display. The
 * backend is authoritative — this file must be kept in sync when either
 * enum grows.
 */

export const DSA_TOPICS = [
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

export const DSA_DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   color: '#3FB950' },
  { value: 'medium', label: 'Medium', color: '#D29922' },
  { value: 'hard',   label: 'Hard',   color: '#F85149' },
  { value: 'mixed',  label: 'Mixed',  color: '#58A6FF' },
];

// Language options — value matches the backend enum; label is the display
// name shown in the selector.
export const DSA_LANGUAGES = [
  { value: 'cpp',        label: 'C++' },
  { value: 'java',       label: 'Java' },
  { value: 'python',     label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go',         label: 'Go' },
  { value: 'rust',       label: 'Rust' },
  { value: 'csharp',     label: 'C#' },
  { value: 'kotlin',     label: 'Kotlin' },
];

export const DSA_QUESTION_COUNT = {
  MIN: 1,
  MAX: 20,
  DEFAULT: 5,
};

// Optional focus areas — freeform tags a user can add on top of the main
// topic to steer the interview (e.g. "cycle detection" inside "Linked List").
// This is a HINT list surfaced in the UI; users can also type their own.
export const DSA_FOCUS_AREA_SUGGESTIONS = [
  'time complexity',
  'space optimization',
  'edge cases',
  'iterative solutions',
  'recursive solutions',
  'in-place algorithms',
  'follow-up variations',
];

export function dsaLanguageLabel(value) {
  const entry = DSA_LANGUAGES.find((l) => l.value === value);
  return entry ? entry.label : value || '';
}

export function dsaDifficultyLabel(value) {
  const entry = DSA_DIFFICULTIES.find((d) => d.value === value);
  return entry ? entry.label : value || '';
}
