/**
 * Coding workspace localStorage helpers.
 *
 * Kept in a separate module (no React, no Monaco imports) so callers
 * like InterviewPage can clear the workspace on interview completion
 * without eagerly loading the Monaco editor bundle.
 */

export function storageKeyFor(interviewId) {
  return `dsa:workspace:${interviewId}`;
}

export function splitStorageKeyFor(interviewId) {
  return `dsa:split-width:${interviewId}`;
}

export function clearCodingWorkspace(interviewId) {
  if (!interviewId) return;
  try {
    localStorage.removeItem(storageKeyFor(interviewId));
    localStorage.removeItem(splitStorageKeyFor(interviewId));
    // Sprint 7 Commit 4 — also drop the editable sample test cases and
    // the active-case index so a fresh interview starts with defaults.
    localStorage.removeItem(`dsa:test-cases:${interviewId}`);
    localStorage.removeItem(`dsa:active-test:${interviewId}`);
  } catch { /* localStorage may be unavailable */ }
}
