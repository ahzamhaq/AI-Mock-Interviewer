import api from './api';

/**
 * execution — thin wrapper around the interview run/submit endpoints.
 *
 * Sprint 7 Commit 4. The CodingWorkspace calls these; Monaco never
 * touches them directly. Payload / response shapes match the backend
 * controllers verbatim — no transformation lives here so both sides
 * can evolve together without silent drift.
 */

/**
 * Execute source code against a single stdin (sample test case).
 *
 * @param {string} interviewId
 * @param {Object} payload
 * @param {string} payload.language
 * @param {string} payload.sourceCode
 * @param {string} [payload.stdin]
 * @returns {Promise<{ success: boolean, result: NormalizedResult }>}
 */
export function runCode(interviewId, { language, sourceCode, stdin = '' }) {
  return api.post(`/interviews/${interviewId}/run`, {
    language,
    sourceCode,
    stdin,
  });
}

/**
 * Submit source code against the current question's hidden test suite.
 *
 * @param {string} interviewId
 * @param {Object} payload
 * @param {string} payload.language
 * @param {string} payload.sourceCode
 * @returns {Promise<{ success: boolean, summary: {passed:number,total:number,status:string}, results: Array }>}
 */
export function submitCode(interviewId, { language, sourceCode }) {
  return api.post(`/interviews/${interviewId}/submit`, {
    language,
    sourceCode,
  });
}

// ── localStorage helpers for editable sample test cases ────────────────
//
// Persisted keyed by interview id. Sample cases are user-editable and
// should survive refresh so a candidate iterating on a problem doesn't
// lose their custom inputs. Cleared by clearCodingWorkspace() (Commit 3
// storage helper) when the interview completes.

const TEST_CASE_KEY_PREFIX = 'dsa:test-cases:';
const ACTIVE_TEST_KEY_PREFIX = 'dsa:active-test:';

export function testCasesStorageKey(interviewId) {
  return `${TEST_CASE_KEY_PREFIX}${interviewId}`;
}

export function activeTestStorageKey(interviewId) {
  return `${ACTIVE_TEST_KEY_PREFIX}${interviewId}`;
}

export function loadSampleTestCases(interviewId, fallback) {
  if (!interviewId) return fallback;
  try {
    const raw = localStorage.getItem(testCasesStorageKey(interviewId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t?.stdin === 'string')) {
      return parsed.slice(0, 6); // cap defensive
    }
  } catch { /* corrupt entry — fall through */ }
  return fallback;
}

export function saveSampleTestCases(interviewId, cases) {
  if (!interviewId) return;
  try {
    localStorage.setItem(testCasesStorageKey(interviewId), JSON.stringify(cases));
  } catch { /* quota / private mode */ }
}

export function loadActiveTestIndex(interviewId, fallback = 0) {
  if (!interviewId) return fallback;
  try {
    const raw = localStorage.getItem(activeTestStorageKey(interviewId));
    const n = raw != null ? Number(raw) : NaN;
    if (Number.isInteger(n) && n >= 0) return n;
  } catch { /* ignore */ }
  return fallback;
}

export function saveActiveTestIndex(interviewId, index) {
  if (!interviewId) return;
  try {
    localStorage.setItem(activeTestStorageKey(interviewId), String(index));
  } catch { /* ignore */ }
}

// Default sample cases for a fresh interview — 3 empty stdin slots.
// Spec: 3 default, stdin-only, editable.
export const DEFAULT_SAMPLE_TESTS = [
  { stdin: '', label: 'Sample 1' },
  { stdin: '', label: 'Sample 2' },
  { stdin: '', label: 'Sample 3' },
];
