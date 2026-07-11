/**
 * repoAnalysis.service — heuristic repo analysis pipeline.
 *
 * Contract:
 *   analyzeRepo({ owner, repo, defaultBranch, token }) →
 *     {
 *       summary: string,
 *       architectureSummary: string,
 *       techStack: [{ name, category, confidence }],
 *       importantFiles: [{ path, purpose, size }],
 *       filesRead: number,
 *       bytesRead: number,
 *       model: string,
 *     }
 *
 * The pipeline never analyzes the whole repo. It selects a small set of
 * high-signal files using explicit priority + ignore lists, enforces a hard
 * budget (40 files OR 150 KB, whichever hits first), then hands the digest
 * to a single LLM call that returns structured JSON.
 *
 * Everything past the LLM call — persistence, HTTP responses, polling — is
 * the controller's problem. This module is pure business logic and can be
 * unit-tested by mocking `github` and `ai`.
 */

const github = require('./github.service');
const aiProviderManager = require('./aiProviderManager');

// ── Budget ──────────────────────────────────────────────────────────────────

const MAX_FILES = 40;
const MAX_BYTES = 150 * 1024;
const FETCH_CONCURRENCY = 8;
// Files reported above this size in the tree are skipped without a fetch —
// they'd blow the byte budget by themselves.
const PER_FILE_MAX_BYTES = 40 * 1024;

// ── Selection heuristics ────────────────────────────────────────────────────

// Explicit priority: exact-path matches at repo root. These are the files that
// pin down the tech stack faster than anything else. Ranked in scoring order.
const PRIORITY_FILES = [
  'README.md', 'readme.md', 'README', 'Readme.md',
  'package.json',
  'tsconfig.json', 'jsconfig.json',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'nuxt.config.js', 'nuxt.config.ts',
  'svelte.config.js',
  'astro.config.mjs', 'astro.config.ts',
  'remix.config.js',
  'tailwind.config.js', 'tailwind.config.ts',
  'postcss.config.js',
  'eslint.config.js', '.eslintrc', '.eslintrc.js', '.eslintrc.json',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', '.env.sample',
  'requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py',
  'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'composer.json',
  'vercel.json', 'netlify.toml', 'render.yaml', 'railway.json',
];

// Directory prefixes that get bonus score. Files inside these are strong
// signal for architecture/entry-point questions.
const PRIORITY_DIRS = [
  'src/', 'app/', 'pages/', 'components/', 'lib/',
  'services/', 'controllers/', 'routes/', 'hooks/', 'utils/',
  'server/', 'api/', 'models/', 'middleware/', 'store/',
];

// Path segments we always ignore. Matched by substring anywhere in the path.
const IGNORE_SEGMENTS = [
  'node_modules', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  'dist', 'build', 'out', 'coverage', '.coverage',
  'public/assets', 'static/assets', 'assets/images', 'assets/videos',
  '__snapshots__', '.git/', 'vendor/', 'target/',
  '.venv', 'venv', '__pycache__',
];

// File extensions we never read (binary / media / lockfile noise).
const IGNORE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp',
  '.mp4', '.mov', '.mp3', '.wav', '.webm', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.min.js', '.min.css', '.map',
  // Lockfiles — package.json already tells the story; lockfiles bloat the digest.
  '.lock',
]);
// Extra lockfile names (not by extension).
const IGNORE_EXACT = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'poetry.lock', 'Cargo.lock', 'composer.lock',
]);

// Source-code extensions the LLM will benefit from seeing.
const CODE_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.php', '.cs', '.c', '.cpp', '.h', '.hpp',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass',
  '.html', '.md', '.mdx',
  '.json', '.yaml', '.yml', '.toml',
  '.sh', '.dockerfile',
]);

// ── Public API ──────────────────────────────────────────────────────────────

async function analyzeRepo({ owner, repo, defaultBranch, token }) {
  const ref = defaultBranch || 'main';

  // 1. Tree
  const tree = await github.getRepoTree(owner, repo, ref, { token });
  const entries = (tree.tree || []).filter((n) => n.type === 'blob');

  // 2. Filter + score
  const scored = entries
    .map(scoreEntry)
    .filter((s) => s !== null)
    .sort((a, b) => b.score - a.score);

  // 3. Budget cutoff — walk scored entries and pick until we hit the cap.
  const picked = [];
  let bytes = 0;
  for (const entry of scored) {
    if (picked.length >= MAX_FILES) break;
    const size = entry.size ?? 0;
    if (size > PER_FILE_MAX_BYTES) continue;
    if (bytes + size > MAX_BYTES) continue;
    picked.push(entry);
    bytes += size;
  }

  // 4. Fetch selected file contents with bounded concurrency.
  const fetched = await fetchInBatches(
    picked,
    (entry) => github.getFileContent(owner, repo, entry.path, ref, { token })
      .then((f) => ({ path: entry.path, size: f.size, content: f.content }))
      .catch((err) => ({ path: entry.path, size: entry.size ?? 0, content: '', error: err.message })),
    FETCH_CONCURRENCY,
  );

  const usable = fetched.filter((f) => f.content && !f.error);

  // 5. Build a bounded LLM prompt.
  const prompt = buildAnalysisPrompt({ owner, repo, files: usable });

  // 6. LLM call — reuses the existing fallback chain. Analysis is offline
  // to the interview runtime so we keep temperature low for stable JSON.
  const raw = await aiProviderManager.generate(prompt, {
    temperature: 0.2,
    // 40-file analyses can produce dense JSON. 1400 was cutting off the
    // model mid-response on some repos; 2400 gives comfortable headroom
    // without a meaningful cost difference at this scale.
    maxTokens: 2400,
  });

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    // Log the raw model output so we can see exactly what the model
    // returned. Truncated to keep console lines readable.
    console.error('[analysis:llm-parse-failed] raw output (first 1200 chars):');
    console.error(String(raw || '').slice(0, 1200));
    console.error('[analysis:llm-parse-failed] raw output (last 400 chars):');
    console.error(String(raw || '').slice(-400));
    throw new Error('Analysis model returned no parsable JSON.');
  }

  return normalizeAnalysis(parsed, {
    filesRead: usable.length,
    bytesRead: usable.reduce((n, f) => n + (f.content?.length || 0), 0),
    model: process.env.AI_PROVIDER || 'gemini',
    fallbackImportantFiles: usable.map((f) => ({ path: f.path, size: f.size })),
  });
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreEntry(entry) {
  const path = entry.path || '';
  const lower = path.toLowerCase();

  // Ignore rules — return null so the entry is dropped entirely.
  if (IGNORE_SEGMENTS.some((seg) => lower.includes(seg))) return null;
  const base = basename(path);
  if (IGNORE_EXACT.has(base)) return null;
  const ext = extname(base).toLowerCase();
  if (ext && IGNORE_EXT.has(ext)) return null;

  // Priority + directory bonuses combine into a single score.
  let score = 0;

  const priorityIdx = PRIORITY_FILES.indexOf(base);
  if (priorityIdx !== -1) {
    // Higher rank in PRIORITY_FILES → higher score.
    score += 1000 - priorityIdx;
  }

  for (let i = 0; i < PRIORITY_DIRS.length; i++) {
    if (lower.startsWith(PRIORITY_DIRS[i])) {
      score += 100 - i; // earlier dirs (src/, app/) rank slightly higher
      break;
    }
  }

  // Entry-point-y filenames.
  if (/^(index|main|app|server)\.(js|ts|jsx|tsx|py|go|rs)$/i.test(base)) score += 40;

  // README-alike at any depth.
  if (/^readme(\.md)?$/i.test(base)) score += 30;

  // Everything else — only include if it's a recognized code type AND has a score.
  if (score === 0 && !CODE_EXT.has(ext)) return null;

  // Shallower paths beat deeply nested ones as a tiebreak.
  const depth = path.split('/').length;
  score -= depth * 0.5;

  return { path, size: entry.size ?? 0, score };
}

function basename(p) {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? p : p.slice(idx + 1);
}

function extname(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot);
}

// ── Concurrency helper ──────────────────────────────────────────────────────

async function fetchInBatches(items, worker, concurrency) {
  const out = new Array(items.length);
  let cursor = 0;
  async function pull() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pull));
  return out;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildAnalysisPrompt({ owner, repo, files }) {
  // File digests: truncate individually so no single file dominates the prompt.
  const PER_FILE_PROMPT_MAX = 4000; // chars, not tokens — conservative.
  const digests = files.map((f) => {
    const body = (f.content || '').slice(0, PER_FILE_PROMPT_MAX);
    return `--- ${f.path} (${f.size} bytes) ---\n${body}`;
  }).join('\n\n');

  return `You are analyzing a GitHub repository to produce structured metadata for an interview-prep platform. Read the files below and reply with a SINGLE JSON object — no prose, no markdown fences.

Repository: ${owner}/${repo}
Files provided: ${files.length}

Required JSON shape:
{
  "summary": "2–4 sentence plain-English description of what this project does. Focus on purpose, not tech.",
  "architectureSummary": "3–6 sentences describing the architecture: layers, entry points, data flow, notable design choices.",
  "techStack": [
    { "name": "TypeScript", "category": "language|framework|runtime|database|testing|build|deploy|other", "confidence": 0.0-1.0 }
  ],
  "importantFiles": [
    { "path": "src/index.ts", "purpose": "short reason this file matters" }
  ]
}

Rules:
- techStack: 4–12 entries, most confident first. Only include what you can justify from the files.
- importantFiles: 5–15 entries chosen from the files you were given. Do not invent paths.
- Do NOT include speculative claims. If unsure, omit rather than guess.
- Output ONLY the JSON object.

Files:
${digests}
`;
}

// ── LLM output handling ─────────────────────────────────────────────────────

// Extract the first JSON object from an LLM response, tolerating common
// wrappers (markdown fences, leading prose, trailing prose). We do a
// balanced-brace scan instead of a greedy regex so nested `{}` inside
// string values don't break parsing.
function extractJsonObject(text) {
  if (!text) return null;

  // Strip markdown code fences if present. Handles ```json ... ``` and ``` ... ```.
  let s = String(text)
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  // Find the first '{' and then scan forward counting brace depth,
  // ignoring braces inside strings. This produces the outermost object
  // even if the model wrapped it in prose on either side.
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}

const TECH_CATEGORIES = new Set([
  'language', 'framework', 'runtime', 'database', 'testing', 'build', 'deploy', 'other',
]);

function normalizeAnalysis(raw, extras) {
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  const architectureSummary = typeof raw.architectureSummary === 'string'
    ? raw.architectureSummary.trim()
    : '';

  const techStack = Array.isArray(raw.techStack)
    ? raw.techStack
        .map((t) => ({
          name: String(t?.name || '').trim(),
          category: TECH_CATEGORIES.has(t?.category) ? t.category : 'other',
          confidence: clamp(Number(t?.confidence ?? 0.5), 0, 1),
        }))
        .filter((t) => t.name)
        .slice(0, 12)
    : [];

  // Cross-check: LLM's importantFiles must exist in the files we actually
  // fetched. Fall back to top-N by size if the model returned nothing usable.
  const fetchedPaths = new Map(extras.fallbackImportantFiles.map((f) => [f.path, f.size]));
  let importantFiles = Array.isArray(raw.importantFiles)
    ? raw.importantFiles
        .map((f) => ({
          path: String(f?.path || '').trim(),
          purpose: String(f?.purpose || '').trim(),
          size: fetchedPaths.get(String(f?.path || '').trim()) || 0,
        }))
        .filter((f) => f.path && fetchedPaths.has(f.path))
        .slice(0, 15)
    : [];

  if (importantFiles.length === 0) {
    importantFiles = extras.fallbackImportantFiles.slice(0, 10).map((f) => ({
      path: f.path,
      purpose: '',
      size: f.size,
    }));
  }

  return {
    summary,
    architectureSummary,
    techStack,
    importantFiles,
    filesRead: extras.filesRead,
    bytesRead: extras.bytesRead,
    model: extras.model,
  };
}

function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

module.exports = { analyzeRepo };
