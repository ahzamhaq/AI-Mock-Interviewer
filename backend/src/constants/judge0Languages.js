/**
 * Judge0 language mapping — SINGLE source of truth.
 *
 * Sprint 7 Commit 4: maps our interview language values (defined in
 * constants/dsa.js, mirrored on the frontend in data/codeTemplates.js)
 * to Judge0 CE language IDs. These IDs correspond to the language
 * versions bundled with the standard Judge0 CE Docker image at the
 * time of writing. If a self-hosted Judge0 instance is running a
 * different bundle, override values via env var or update here.
 *
 * Version notes (Judge0 CE ~1.13.x):
 *   cpp        → 54 (C++ GCC 9.2.0)
 *   java       → 62 (Java OpenJDK 13.0.1)
 *   python     → 71 (Python 3.8.1)
 *   javascript → 63 (Node.js 12.14.0)
 *   typescript → 74 (TypeScript 3.7.4)
 *   go         → 60 (Go 1.13.5)
 *   rust       → 73 (Rust 1.40.0)
 *   csharp     → 51 (C# Mono 6.6.0.161)
 *   kotlin     → 78 (Kotlin 1.3.70)
 *
 * Nothing else in the app should hard-code these numbers.
 */

const JUDGE0_LANGUAGES = {
  cpp:        { id: 54, name: 'C++ (GCC 9.2.0)' },
  java:       { id: 62, name: 'Java (OpenJDK 13.0.1)' },
  python:     { id: 71, name: 'Python (3.8.1)' },
  javascript: { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  typescript: { id: 74, name: 'TypeScript (3.7.4)' },
  go:         { id: 60, name: 'Go (1.13.5)' },
  rust:       { id: 73, name: 'Rust (1.40.0)' },
  csharp:     { id: 51, name: 'C# (Mono 6.6.0.161)' },
  kotlin:     { id: 78, name: 'Kotlin (1.3.70)' },
};

const SUPPORTED = new Set(Object.keys(JUDGE0_LANGUAGES));

function isSupported(lang) {
  return typeof lang === 'string' && SUPPORTED.has(lang.toLowerCase());
}

function getLanguageId(lang) {
  const key = String(lang || '').toLowerCase();
  return JUDGE0_LANGUAGES[key]?.id ?? null;
}

function getLanguageName(lang) {
  const key = String(lang || '').toLowerCase();
  return JUDGE0_LANGUAGES[key]?.name ?? '';
}

module.exports = {
  JUDGE0_LANGUAGES,
  isSupported,
  getLanguageId,
  getLanguageName,
  SUPPORTED_LANGUAGES: Array.from(SUPPORTED),
};
