/**
 * judge0.service — provider-agnostic wrapper around a Judge0 CE
 * instance.
 *
 * Sprint 7 Commit 4:
 *   • Async submission + polling only. `wait=true` is intentionally not
 *     used because some Judge0 deployments disable it and RapidAPI
 *     rate-limits it. Async works everywhere.
 *   • Normalizes the raw Judge0 payload into the shape documented in the
 *     Commit 4 spec. The frontend never sees raw Judge0 fields.
 *   • Handles compile-timeout, execution-timeout, poll-timeout, network-
 *     timeout, queue-timeout uniformly — each returns a normalized
 *     result with a user-safe `error` message; nothing throws unless
 *     the request itself was malformed.
 *
 * Environment (loaded via process.env — no reads at import time so
 * tests can stub them):
 *   JUDGE0_URL      — required; e.g. http://localhost:2358
 *   JUDGE0_API_KEY  — optional RapidAPI-style key; sent as
 *                     X-RapidAPI-Key when present, plain X-Auth-Token
 *                     fallback for self-hosted deployments that use it
 *
 * Zero dependencies on Express, Mongoose, or the interview module —
 * consumers pass in raw language + code + stdin.
 */

const { getLanguageId, isSupported } = require('../constants/judge0Languages');

// ── Tunables ────────────────────────────────────────────────────────────────
// Async polling budget. Judge0 CE compiles + executes most short DSA
// solutions in under 2 s; 10 s covers slow first-time compilations.
const POLL_INTERVAL_MS = 500;
const POLL_MAX_MS      = 10_000;
// Guardrails passed to Judge0 to prevent runaway user code.
const CPU_LIMIT_S       = 3;
const WALL_LIMIT_S      = 5;
const MEMORY_LIMIT_KB   = 128 * 1024;   // 128 MB
const STACK_LIMIT_KB    = 64 * 1024;    // 64 MB
// Cap the request payload we send. 100 KB source + stdin is plenty for
// interview problems and prevents accidental huge posts from clogging
// the Judge0 instance.
const MAX_SOURCE_CHARS = 100_000;
const MAX_STDIN_CHARS  = 20_000;

// Network timeouts for the outbound HTTP calls to Judge0.
const HTTP_TIMEOUT_MS = 8_000;

// ── Status normalization ────────────────────────────────────────────────────
// Judge0's numeric status.id (see Judge0 docs):
//   1  → In Queue
//   2  → Processing
//   3  → Accepted (success)
//   4  → Wrong Answer  (only meaningful when expected_output was set)
//   5  → Time Limit Exceeded
//   6  → Compilation Error
//   7  → Runtime Error (SIGSEGV)
//   8  → Runtime Error (SIGXFSZ)
//   9  → Runtime Error (SIGFPE)
//   10 → Runtime Error (SIGABRT)
//   11 → Runtime Error (NZEC)   ← generic "your program crashed"
//   12 → Runtime Error (Other)
//   13 → Internal Error
//   14 → Exec Format Error
const NORMALIZED_STATUS = {
  1:  'queued',
  2:  'running',
  3:  'success',
  4:  'wrong_answer',
  5:  'timeout',
  6:  'compilation_error',
  7:  'runtime_error',
  8:  'runtime_error',
  9:  'runtime_error',
  10: 'runtime_error',
  11: 'runtime_error',
  12: 'runtime_error',
  13: 'internal_error',
  14: 'internal_error',
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a single source file against a single stdin. Returns a
 * normalized result — never throws for judge-side errors.
 *
 * @param {Object}   input
 * @param {string}   input.language   supported language value (e.g. 'cpp')
 * @param {string}   input.sourceCode
 * @param {string}   [input.stdin]    optional program stdin
 * @param {string}   [input.expectedOutput] optional; enables Wrong Answer status
 * @returns {Promise<NormalizedResult>}
 */
async function executeOnce({ language, sourceCode, stdin = '', expectedOutput = null }) {
  const validation = validateInputs(language, sourceCode, stdin);
  if (validation) return validation;

  const url = normalizeUrl(process.env.JUDGE0_URL);
  if (!url) {
    return errorResult('config_error', 'Code execution is not configured on this server.');
  }

  const languageId = getLanguageId(language);
  const submissionBody = {
    language_id: languageId,
    source_code: sourceCode,
    stdin: stdin || '',
    // Judge0 accepts expected_output for automatic diffing — used by
    // the /submit path against hidden tests.
    expected_output: expectedOutput || undefined,
    cpu_time_limit:  CPU_LIMIT_S,
    wall_time_limit: WALL_LIMIT_S,
    memory_limit:    MEMORY_LIMIT_KB,
    stack_limit:     STACK_LIMIT_KB,
    // base64_encoded so binary stdout / weird chars survive JSON.
    // The wrapper decodes before returning.
  };

  // ── Submit ────────────────────────────────────────────────────────────
  let token;
  try {
    const submitRes = await fetchJson(
      `${url}/submissions?base64_encoded=true&wait=false`,
      {
        method: 'POST',
        headers: buildHeaders({ contentType: true }),
        body: JSON.stringify(base64EncodeSubmission(submissionBody)),
      },
    );
    token = submitRes?.token;
    if (!token) {
      return errorResult('network_error', 'The execution service did not return a submission token.');
    }
  } catch (err) {
    return mapNetworkError(err);
  }

  // ── Poll ──────────────────────────────────────────────────────────────
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);
    let poll;
    try {
      poll = await fetchJson(
        `${url}/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory,exit_code,message`,
        { method: 'GET', headers: buildHeaders() },
      );
    } catch (err) {
      return mapNetworkError(err);
    }
    // Judge0 uses status.id === 1 (queued) or 2 (processing) while the
    // submission is still in flight. Anything else means it's terminal.
    const statusId = poll?.status?.id;
    if (statusId != null && statusId > 2) {
      return normalizeJudge0Payload(poll);
    }
  }

  // Ran out of polling budget — mark the submission as a timeout so
  // the frontend shows a friendly state instead of hanging forever.
  return {
    status:         'timeout',
    stdout:         '',
    stderr:         '',
    compileOutput:  '',
    executionTime:  null,
    memory:         null,
    exitCode:       null,
    message:        'Execution timed out after 10 seconds.',
    error:          'Your submission took too long. Try optimizing your solution or reducing input size.',
  };
}

/**
 * Run a source file against multiple test cases sequentially. Returns
 * per-test normalized results plus a summary. Used by /run (visible
 * sample cases) and /submit (hidden cases).
 *
 * The service does NOT parallelize submissions. A self-hosted Judge0
 * with a single worker can only compile one thing at a time; batching
 * a suite of 5 hidden tests sequentially still finishes in ~5–8 s in
 * the happy path.
 *
 * @param {Object}   input
 * @param {string}   input.language
 * @param {string}   input.sourceCode
 * @param {Array<{stdin?: string, expectedOutput?: string, label?: string}>} input.tests
 */
async function executeSuite({ language, sourceCode, tests }) {
  const validation = validateInputs(language, sourceCode, '');
  if (validation) return { summary: { passed: 0, total: (tests || []).length, status: validation.status }, results: [], error: validation.error };

  const results = [];
  const suite = Array.isArray(tests) ? tests : [];
  let passedCount = 0;
  let firstNonSuccessStatus = null;

  for (let i = 0; i < suite.length; i++) {
    const t = suite[i] || {};
    const res = await executeOnce({
      language,
      sourceCode,
      stdin: t.stdin || '',
      expectedOutput: t.expectedOutput || null,
    });
    // A test passes when Judge0 says the run itself was successful AND
    // — if we sent expectedOutput — it wasn't a wrong_answer verdict.
    const passed = res.status === 'success' && (!t.expectedOutput || !res.error);
    if (passed) passedCount += 1;
    else if (!firstNonSuccessStatus) firstNonSuccessStatus = res.status;

    results.push({
      index:          i,
      label:          t.label || `Test ${i + 1}`,
      passed,
      status:         res.status,
      stdout:         res.stdout,
      stderr:         res.stderr,
      compileOutput:  res.compileOutput,
      executionTime:  res.executionTime,
      memory:         res.memory,
      exitCode:       res.exitCode,
      expectedOutput: t.expectedOutput || null,
      message:        res.message || '',
      error:          res.error || '',
    });

    // Short-circuit on compile error — subsequent tests would all fail
    // for the same reason and each costs a Judge0 submission.
    if (res.status === 'compilation_error') break;
  }

  const total = suite.length;
  const summary = {
    passed:  passedCount,
    total,
    status:  passedCount === total && total > 0
      ? 'success'
      : firstNonSuccessStatus || (total === 0 ? 'success' : 'wrong_answer'),
  };
  return { summary, results };
}

// ── Internals ────────────────────────────────────────────────────────────────

function validateInputs(language, sourceCode /* , stdin */) {
  if (!isSupported(language)) {
    return errorResult('unsupported_language', `Language "${language}" is not supported for execution.`);
  }
  if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
    return errorResult('empty_source', 'Please write some code before running.');
  }
  if (sourceCode.length > MAX_SOURCE_CHARS) {
    return errorResult('source_too_large', 'Source code exceeds the allowed size.');
  }
  return null;
}

function base64EncodeSubmission(body) {
  const clone = { ...body };
  if (typeof clone.source_code === 'string') {
    clone.source_code = Buffer.from(clone.source_code, 'utf8').toString('base64');
  }
  if (typeof clone.stdin === 'string' && clone.stdin.length) {
    if (clone.stdin.length > MAX_STDIN_CHARS) {
      clone.stdin = clone.stdin.slice(0, MAX_STDIN_CHARS);
    }
    clone.stdin = Buffer.from(clone.stdin, 'utf8').toString('base64');
  }
  if (typeof clone.expected_output === 'string' && clone.expected_output.length) {
    clone.expected_output = Buffer.from(clone.expected_output, 'utf8').toString('base64');
  }
  return clone;
}

function base64DecodeMaybe(v) {
  if (typeof v !== 'string' || !v) return '';
  try {
    return Buffer.from(v, 'base64').toString('utf8');
  } catch {
    return v;
  }
}

function normalizeJudge0Payload(raw) {
  const statusId  = raw?.status?.id;
  const status    = NORMALIZED_STATUS[statusId] || 'internal_error';
  const stdout    = base64DecodeMaybe(raw?.stdout);
  const stderr    = base64DecodeMaybe(raw?.stderr);
  const compileOutput = base64DecodeMaybe(raw?.compile_output);
  const executionTime = raw?.time != null ? Number(raw.time) : null; // seconds
  const memory        = raw?.memory != null ? Number(raw.memory) : null; // KB
  const exitCode      = raw?.exit_code != null ? Number(raw.exit_code) : null;
  const message       = raw?.message ? String(raw.message).slice(0, 500) : '';

  let error = '';
  if (status === 'compilation_error') {
    error = compileOutput?.trim()
      ? 'Compilation failed. See the Errors tab for details.'
      : 'Your code did not compile.';
  } else if (status === 'timeout') {
    error = 'Execution timed out.';
  } else if (status === 'runtime_error') {
    error = message || 'Your program crashed during execution.';
  } else if (status === 'wrong_answer') {
    error = 'Output did not match the expected result.';
  } else if (status === 'internal_error') {
    error = 'The execution service returned an internal error. Please try again.';
  }

  return {
    status,
    stdout,
    stderr,
    compileOutput,
    executionTime,
    memory,
    exitCode,
    message,
    error,
  };
}

function errorResult(status, error) {
  return {
    status,
    stdout:        '',
    stderr:        '',
    compileOutput: '',
    executionTime: null,
    memory:        null,
    exitCode:      null,
    message:       '',
    error,
  };
}

function mapNetworkError(err) {
  const msg = err?.message || '';
  if (err?.name === 'AbortError' || /timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return errorResult('network_error', 'The execution service took too long to respond. Please try again.');
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(msg)) {
    return errorResult('network_error', 'The execution service is unreachable. Make sure Judge0 is running.');
  }
  return errorResult('network_error', 'Could not reach the execution service.');
}

function buildHeaders({ contentType = false } = {}) {
  const h = {};
  if (contentType) h['Content-Type'] = 'application/json';
  const key = process.env.JUDGE0_API_KEY;
  if (key) {
    // Send under both header names so the same code works with a
    // RapidAPI-hosted Judge0 AND a self-hosted deployment that gates
    // access via X-Auth-Token. Extra headers are ignored by the other.
    h['X-RapidAPI-Key']  = key;
    h['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    h['X-Auth-Token']    = key;
  }
  return h;
}

function normalizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  return u.trim().replace(/\/+$/, '');
}

async function fetchJson(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const snippet = text ? ` (${text.slice(0, 120)})` : '';
      throw new Error(`Judge0 HTTP ${res.status}${snippet}`);
    }
    // Judge0 always returns JSON on success — but be defensive.
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  executeOnce,
  executeSuite,
  // Exported for tests.
  _internals: {
    normalizeJudge0Payload,
    base64EncodeSubmission,
    base64DecodeMaybe,
    NORMALIZED_STATUS,
    POLL_INTERVAL_MS,
    POLL_MAX_MS,
  },
};
