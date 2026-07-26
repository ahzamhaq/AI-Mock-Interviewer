const Project = require('../models/Project.model');
const RepositoryAnalysis = require('../models/RepositoryAnalysis.model');

/**
 * workspaceContext.service — the single source of truth for "what does
 * the AI know about this repository?"
 *
 * Sprint 6 Commit 4: this service assembles a normalized context object
 * from data that ALREADY EXISTS in the system (Project + latest
 * RepositoryAnalysis, both produced by Sprint 2). It does NOT:
 *   • Call GitHub
 *   • Clone or re-scan repositories
 *   • Parse code
 *   • Rebuild analysis
 *   • Call any LLM
 *
 * It reads two documents, groups + summarizes + truncates, and returns
 * a stable shape. Commit 5's prompt builder will consume this as-is.
 *
 * Shape: see `EMPTY_CONTEXT` below for the canonical structure.
 * Rules:
 *   • Missing sources → the corresponding section is null or empty.
 *   • Nothing is fabricated. If a field can't be derived, it's omitted.
 *   • Payload is deliberately compact — a few KB, not the whole repo.
 */

// Caps chosen so the whole context comfortably fits into a single LLM
// prompt in Commit 5 without needing an aggressive truncation pass.
const SUMMARY_MAX = 1200;
const ARCHITECTURE_MAX = 1600;
const KEY_FILES_MAX = 15;
const KEY_DIRS_MAX = 10;
const TECH_PER_CATEGORY_MAX = 8;

const EMPTY_CONTEXT = Object.freeze({
  project: null,
  repository: null,
  analysis: null,
  meta: {
    hasAnalysis: false,
    analysisStatus: null,
    analysisReady: false,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text, max) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

// Group tech stack entries by category, keep the strongest N per group.
// Preserves the { name, confidence } shape so downstream prompt building
// can reason about certainty without a second lookup.
function groupTechStack(techStack = []) {
  const buckets = {};
  const sorted = [...techStack].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  for (const entry of sorted) {
    if (!entry || !entry.name) continue;
    const cat = entry.category || 'other';
    if (!buckets[cat]) buckets[cat] = [];
    if (buckets[cat].length >= TECH_PER_CATEGORY_MAX) continue;
    buckets[cat].push({
      name: entry.name,
      confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
    });
  }
  return buckets;
}

// Derive "key directories" from the analysis' importantFiles list.
// Groups by top-level segment (or first two for src/ and app/ style
// nesting) and reports the file count per directory. Cheap heuristic —
// no filesystem access, no re-parsing.
function deriveKeyDirectories(importantFiles = []) {
  const counts = new Map();
  for (const f of importantFiles) {
    if (!f?.path) continue;
    const segments = String(f.path).split('/');
    let key;
    if (segments.length === 1) key = '(root)';
    else if (segments[0] === 'src' || segments[0] === 'app') {
      key = segments.slice(0, 2).join('/');
    } else {
      key = segments[0];
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([path, files]) => ({ path, files }))
    .sort((a, b) => b.files - a.files)
    .slice(0, KEY_DIRS_MAX);
}

// Pick a "primary framework" hint from techStack, if any looks like one.
// This is derivation, not fabrication — we only surface a value when the
// analysis actually flagged a framework-category entry.
function pickPrimaryFramework(techStack = []) {
  const framework = techStack
    .filter((t) => t?.category === 'framework' && t?.name)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  return framework?.name || null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Assemble the workspace context for a project owned by the given user.
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} projectId
 * @returns {Promise<Object|null>}   Context object, or null when the
 *   project does not belong to the user (controllers translate to 404).
 */
async function getWorkspaceContext(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, userId }).lean();
  if (!project) return null;

  // Analysis may be absent (nothing analyzed yet), still processing, or
  // failed — the context shape stays consistent, `analysis` just goes
  // null and `meta` signals the state so callers can react if they want.
  const analysisDoc = project.latestAnalysisId
    ? await RepositoryAnalysis.findById(project.latestAnalysisId).lean()
    : null;

  return {
    project: {
      id:          String(project._id),
      name:        project.repoName || '',
      owner:       project.repoOwner || '',
      fullName:    `${project.repoOwner}/${project.repoName}`,
      description: project.metadata?.description || '',
    },
    repository: {
      provider:      project.provider || null,
      source:        project.source || null,
      defaultBranch: project.defaultBranch || null,
      url:           project.repoUrl || project.metadata?.htmlUrl || null,
      language:      project.metadata?.language || null,
      framework:     analysisDoc ? pickPrimaryFramework(analysisDoc.techStack) : null,
      private:       !!project.metadata?.private,
      stars:         project.metadata?.stars ?? null,
    },
    analysis: analysisDoc && analysisDoc.status === 'ready'
      ? {
        summary:        truncate(analysisDoc.summary, SUMMARY_MAX),
        architecture:   truncate(analysisDoc.architectureSummary, ARCHITECTURE_MAX),
        techStack:      groupTechStack(analysisDoc.techStack),
        keyDirectories: deriveKeyDirectories(analysisDoc.importantFiles),
        keyFiles:       (analysisDoc.importantFiles || [])
          .slice(0, KEY_FILES_MAX)
          .map((f) => ({
            path: f.path,
            purpose: f.purpose || '',
            size: typeof f.size === 'number' ? f.size : null,
          })),
        model:          analysisDoc.model || null,
        filesRead:      analysisDoc.filesRead ?? null,
        bytesRead:      analysisDoc.bytesRead ?? null,
      }
      : null,
    meta: {
      hasAnalysis:    !!analysisDoc,
      analysisStatus: analysisDoc?.status || null,
      analysisReady:  analysisDoc?.status === 'ready',
      analyzedAt:     analysisDoc?.updatedAt || null,
    },
  };
}

module.exports = {
  getWorkspaceContext,
  EMPTY_CONTEXT,
};
