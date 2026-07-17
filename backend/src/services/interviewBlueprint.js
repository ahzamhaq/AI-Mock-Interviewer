const Project = require('../models/Project.model');
const RepositoryAnalysis = require('../models/RepositoryAnalysis.model');

/**
 * interviewBlueprint — the single source of truth for "an interview to
 * create." Every call site that constructs an Interview (today: the
 * general wizard, the project wizard, the retry endpoint, the Coach's
 * practice_now action) produces this object; the interview controller
 * reads from it exclusively.
 *
 * Sprint 5 Commit 1: introduces the object shape and threads it through
 * createInterview WITHOUT changing the frontend request body, the engine,
 * or any downstream service. Future interview modes (resume, dsa,
 * aptitude, behavioral, system_design, custom) all plug into this shape
 * — there is never a createResumeInterview() or createDSAInterview().
 *
 * The blueprint is deliberately NOT a Mongoose model. It is a request-
 * scoped construction payload. The persisted Interview document derives
 * from it but does not mirror it 1:1 (blueprint has resolved context;
 * Interview stores the snapshot).
 *
 * The name collides with the existing services/blueprint.service.js —
 * different concept: blueprint.service.js is the QUESTION PLAN inside an
 * interview (topic mix, seed questions). interviewBlueprint is the
 * CREATION PAYLOAD that feeds blueprint.service among other consumers.
 * Renaming either is out of scope for Commit 1.
 */

const VALID_MODES = new Set([
  'general', 'project', 'resume', 'dsa', 'aptitude', 'behavioral', 'system_design', 'custom',
]);

const VALID_SOURCES = new Set([
  'guided', 'quick_ai', 'template', 'preset', 'recent', 'retry', 'coach',
]);

const VALID_INTERVIEW_TYPES = new Set([
  'technical', 'hr', 'behavioral', 'system_design', 'mixed',
]);

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_PRESSURES = new Set(['relaxed', 'standard', 'intense']);
const VALID_ROLES = new Set([
  'frontend_developer', 'backend_developer', 'fullstack_developer',
  'sde', 'data_analyst', 'hr', 'other',
]);

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Construct a blueprint from the incoming HTTP request. Reads req.body
 * and req._internalRetryOf (set by the retry endpoint's internal handoff).
 * Does NOT hit the DB — that's what .resolve() is for.
 */
function fromRequest(req) {
  const body = req.body || {};

  // Detect mode. Explicit body.mode wins; otherwise infer from presence
  // of a projectId (Sprint 2 signal). Default 'general' preserves every
  // pre-Sprint-5 call site's behavior.
  const declaredMode = normalizeMode(body.mode);
  const mode = declaredMode || (body.projectId ? 'project' : 'general');

  return {
    mode,

    // Identity / targeting
    role:          body.role,
    experience:    body.experienceLevel,           // aliased to blueprint's canonical name
    company:       body.companyType || 'any',
    targetCompany: body.targetCompany || '',

    // Interview shape
    interviewType: normalizeInterviewType(body.interviewType) || 'mixed',
    difficulty:    normalizeDifficulty(body.difficulty) || 'medium',
    questionCount: clampInt(body.totalQuestions, 1, 20, 5),

    // Persona / vibe
    personality: body.personalityId || '',
    pressure:    normalizePressure(body.pressure) || 'standard',
    round:       body.round || null,               // resolved by controller from sub-mode when project
    lengthIntent: body.lengthIntent || 'auto',

    // Grounding toggles — mode-agnostic booleans that trigger context loading in .resolve()
    useResume:  !!body.useResume,
    useProject: mode === 'project' || !!body.projectId,

    // Free-form grounding
    jobDescription: body.jobDescription || '',
    customPrompt:   body.customPrompt || '',       // Sprint 5+ mode: 'custom'

    // Mode-specific inputs (raw). Resolution happens in .resolve().
    projectId: body.projectId || null,
    subMode:   body.subMode  || null,

    // Retry lineage — internal handoff from the retryQuestion controller.
    // Never accepted from external request bodies; the underscore prefix
    // is the contract. See interview.controller.js#retryQuestion.
    retryOf: req._internalRetryOf || null,

    // Sprint 5 Commit 6 — creation origin. External clients pass
    // `source` + `sourceMetadata` in the request body; retry overrides
    // both server-side (see interview.controller.js#retryQuestion).
    creationSource: (() => {
      // Retry lineage overrides everything else — it's an internal
      // handoff and we always want the correct provenance.
      if (req._internalRetryOf) return 'retry';
      const s = String(body.source || '').toLowerCase();
      return VALID_SOURCES.has(s) ? s : 'guided';
    })(),
    sourceMetadata: (() => {
      if (req._internalRetryOf) {
        return {
          parentInterviewId: String(req._internalRetryOf.interviewId || ''),
          questionIndex: req._internalRetryOf.questionIndex,
          topic: req._internalRetryOf.topic || '',
        };
      }
      const meta = body.sourceMetadata;
      // Guard against non-objects, arrays, or missing entirely.
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        return sanitizeSourceMetadata(meta);
      }
      return {};
    })(),

    // Populated by .resolve(). Consumers read from this instead of
    // hitting the DB themselves.
    generatedConfig: {
      resumeText:         '',        // filled when useResume and user has a resume
      projectMode:        null,      // filled when useProject and analysis is ready
      resolvedRepoLabel:  null,      // convenience for title generation
    },
  };
}

/**
 * Load anything the blueprint needs from the DB. Idempotent.
 *
 *   • Resume text — pulled from the passed User doc when useResume=true.
 *   • Project mode snapshot — loaded from Project + latest ready
 *     RepositoryAnalysis when useProject=true.
 *
 * Throws on user-fixable problems (project missing, analysis not ready);
 * controllers translate the throw to HTTP 400. Never throws on missing
 * resume — falls back to empty string so useResume becomes a no-op.
 */
async function resolve(blueprint, user) {
  // Resume — pull from the user record we already loaded upstream. Zero
  // extra DB round trip. If the user has no resumeText (or hasn't
  // uploaded), useResume silently becomes a no-op.
  if (blueprint.useResume) {
    blueprint.generatedConfig.resumeText = (user && user.resumeText) || '';
  }

  // Project — snapshot the analysis into the blueprint so scoring stays
  // reproducible if the analysis is later re-run. Mirrors the pre-refactor
  // resolveProjectMode() logic verbatim.
  if (blueprint.useProject && blueprint.projectId) {
    const project = await Project.findOne({ _id: blueprint.projectId, userId: user._id });
    if (!project) {
      throw new Error('Project not found.');
    }
    const analysis = project.latestAnalysisId
      ? await RepositoryAnalysis.findById(project.latestAnalysisId).lean()
      : null;
    if (!analysis || analysis.status !== 'ready') {
      throw new Error('This project is still being analyzed. Try again once analysis completes.');
    }
    const validSubMode = ['architecture', 'debugging', 'code_review'].includes(blueprint.subMode)
      ? blueprint.subMode
      : 'architecture';

    blueprint.generatedConfig.projectMode = {
      projectId:           project._id,
      subMode:             validSubMode,
      analysisSummary:     analysis.summary || '',
      techStack:           (analysis.techStack || []).map((t) => t.name).filter(Boolean),
      importantFiles:      (analysis.importantFiles || []).map((f) => f.path).filter(Boolean),
      architectureSummary: analysis.architectureSummary || '',
    };
    blueprint.generatedConfig.resolvedRepoLabel = `${project.repoOwner}/${project.repoName}`;

    // Round mapping — project sub-modes map to existing engine rounds so
    // no engine change is needed. Explicit round override in the request
    // wins; otherwise infer from sub-mode.
    if (!blueprint.round) {
      blueprint.round =
        validSubMode === 'architecture' ? 'system_design' : 'technical';
    }
  }

  return blueprint;
}

/**
 * Validate a resolved blueprint. Throws a user-safe error on any missing
 * required field. Called by the controller after .resolve() and before
 * Interview.create().
 */
function validate(blueprint) {
  if (!VALID_MODES.has(blueprint.mode)) {
    throw new Error(`Unknown interview mode: ${blueprint.mode}`);
  }
  if (!blueprint.role || !VALID_ROLES.has(blueprint.role)) {
    throw new Error('A valid role is required.');
  }
  if (!blueprint.experience) {
    throw new Error('Experience level is required.');
  }
  if (blueprint.useProject && !blueprint.generatedConfig.projectMode) {
    throw new Error('Project mode requires a resolved project analysis.');
  }
  if (blueprint.mode === 'custom' && !blueprint.customPrompt.trim()) {
    throw new Error('Custom interviews require a customPrompt.');
  }
}

// ── Derivations for downstream services ─────────────────────────────────────
//
// These small helpers exist so the controller doesn't reach into blueprint
// internals — instead it asks the blueprint for the shapes each downstream
// service expects. Reduces coupling; adding a new mode = extending these.

/**
 * The config object saved on the Interview document. Matches the existing
 * Interview.config schema shape 1:1 so the persisted document is
 * unchanged from pre-Sprint-5.
 */
function toInterviewConfig(blueprint) {
  const cfg = {
    role:            blueprint.role,
    experienceLevel: blueprint.experience,
    companyType:     blueprint.company,
    targetCompany:   blueprint.targetCompany,
    interviewType:   blueprint.interviewType,
    difficulty:      blueprint.difficulty,
    totalQuestions:  blueprint.questionCount,
    jobDescription:  blueprint.jobDescription,
    useResume:       blueprint.useResume,
  };
  if (blueprint.generatedConfig.projectMode) {
    cfg.projectMode = blueprint.generatedConfig.projectMode;
  }
  return cfg;
}

/**
 * The config object passed to blueprint.service.build() (the question
 * planner). Matches the pre-Sprint-5 shape.
 */
function toPlannerConfig(blueprint) {
  return {
    role:            blueprint.role,
    experienceLevel: blueprint.experience,
    companyType:     blueprint.company,
    targetCompany:   blueprint.targetCompany,
    interviewType:   blueprint.interviewType,
    difficulty:      blueprint.difficulty,
    totalQuestions:  blueprint.questionCount,
    jobDescription:  blueprint.jobDescription,
    lengthIntent:    blueprint.lengthIntent,
  };
}

/**
 * The options object passed to blueprint.service.build() alongside the
 * planner config. Matches the pre-Sprint-5 shape.
 */
function toPlannerOptions(blueprint) {
  return {
    personalityId: blueprint.personality,
    pressure:      blueprint.pressure,
    round:         blueprint.round,
  };
}

/**
 * Interview title. General interviews get the classic role+type title;
 * project interviews get "owner/repo · sub-mode". Future modes extend the
 * switch as they ship.
 */
function toTitle(blueprint) {
  if (blueprint.mode === 'project' && blueprint.generatedConfig.resolvedRepoLabel) {
    const sub = blueprint.generatedConfig.projectMode?.subMode || 'architecture';
    return `${blueprint.generatedConfig.resolvedRepoLabel} · ${sub.replace('_', ' ')}`;
  }
  return `${blueprint.role.replace(/_/g, ' ')} - ${blueprint.interviewType} Interview`;
}

/**
 * Resume text ready to pass into buildGenContext(). Empty string when
 * useResume is off or the user has no resumeText. Downstream code should
 * treat empty as "no resume" (matches pre-refactor behavior).
 */
function toResumeText(blueprint) {
  return blueprint.generatedConfig.resumeText || '';
}

// ── Normalization helpers ───────────────────────────────────────────────────

function normalizeMode(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return VALID_MODES.has(s) ? s : null;
}
function normalizeInterviewType(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return VALID_INTERVIEW_TYPES.has(s) ? s : null;
}
function normalizeDifficulty(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return VALID_DIFFICULTIES.has(s) ? s : null;
}
function normalizePressure(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return VALID_PRESSURES.has(s) ? s : null;
}
function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// Whitelist known metadata fields per source. The frontend is trusted-ish
// but not trusted — an attacker could POST any object into sourceMetadata.
// We keep only string/number/boolean primitives, trim long strings, and
// drop everything else. Shape families:
//   quick_ai: { prompt, parserVersion }
//   template: { templateId, templateName }
//   preset:   { presetId, presetName }
//   recent:   { interviewId, label }
//   coach:    { recommendationId, focusAreaTitle }
//   retry:    { parentInterviewId, questionIndex, topic }  (server-generated)
//   guided:   {} (usually empty)
const ALLOWED_META_KEYS = new Set([
  'prompt', 'parserVersion',
  'templateId', 'templateName',
  'presetId', 'presetName',
  'interviewId', 'label',
  'recommendationId', 'focusAreaTitle',
  'parentInterviewId', 'questionIndex', 'topic',
]);

function sanitizeSourceMetadata(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!ALLOWED_META_KEYS.has(k)) continue;
    if (v == null) continue;
    if (typeof v === 'string') {
      // Cap prompt/label lengths so we don't store an entire essay.
      const limit = k === 'prompt' ? 2000 : 200;
      out[k] = v.trim().slice(0, limit);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  fromRequest,
  resolve,
  validate,
  toInterviewConfig,
  toPlannerConfig,
  toPlannerOptions,
  toTitle,
  toResumeText,
  // Exported for tests + future consumers.
  VALID_MODES,
};
