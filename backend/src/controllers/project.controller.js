const User = require('../models/User.model');
const Project = require('../models/Project.model');
const RepositoryAnalysis = require('../models/RepositoryAnalysis.model');

const github = require('../services/github.service');
const repoAnalysis = require('../services/repoAnalysis.service');
const { parseRepoUrl, canonicalUrl } = require('../services/repoUrl');
const { decrypt } = require('../services/crypto.service');
const achievements = require('../services/achievements/evaluate');

/**
 * project.controller — CRUD + analysis lifecycle for the Workspace object.
 *
 * Two creation paths converge on the same document shape:
 *   POST /from-url     — public URL paste, no auth required for the repo
 *   POST /from-github  — repo picked from the connected GitHub account
 *
 * Both return the created Project immediately with an analysis record in
 * `processing` state. Analysis then runs after `res.json()` returns so no
 * request hangs longer than a normal API call. The frontend polls
 * GET /:id until `analysis.status` transitions to `ready` or `failed`.
 *
 * All handlers assume `protect` middleware has populated `req.user`.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

// Load the user's GitHub token from the DB. The default query strips
// `accessTokenEncrypted` (select: false in the schema), so we re-select it
// explicitly. Returns null when the user has no GitHub connection.
async function loadGithubToken(userId) {
  const u = await User.findById(userId).select('+githubIntegration.accessTokenEncrypted');
  if (!u?.githubIntegration?.connected || !u.githubIntegration.accessTokenEncrypted) return null;
  try {
    return decrypt(u.githubIntegration.accessTokenEncrypted);
  } catch {
    // A tampered or key-rotated ciphertext should force reconnect, not crash.
    return null;
  }
}

// Convert a repo API payload to the Project.metadata shape.
function metadataFromRepo(r) {
  return {
    description: r.description || '',
    language:    r.language || '',
    stars:       r.stargazers_count || 0,
    forks:       r.forks_count || 0,
    htmlUrl:     r.html_url || '',
    homepage:    r.homepage || '',
    private:     !!r.private,
    updatedAt:   r.pushed_at ? new Date(r.pushed_at) : null,
  };
}

// Kick off analysis in the background and update the RepositoryAnalysis
// record when done. Deliberately NOT awaited by the request handler: the
// HTTP response has already been sent by the time this runs.
function runAnalysisInBackground({ analysisId, projectId, owner, repo, defaultBranch, token }) {
  // Fire-and-forget. Any thrown error is caught and persisted as a failure
  // so the polling frontend sees a real status.
  setImmediate(async () => {
    try {
      const result = await repoAnalysis.analyzeRepo({ owner, repo, defaultBranch, token });
      await RepositoryAnalysis.updateOne(
        { _id: analysisId },
        {
          $set: {
            status: 'ready',
            error: null,
            summary: result.summary,
            architectureSummary: result.architectureSummary,
            techStack: result.techStack,
            importantFiles: result.importantFiles,
            filesRead: result.filesRead,
            bytesRead: result.bytesRead,
            model: result.model,
          },
        },
      );
      await Project.updateOne(
        { _id: projectId },
        { $set: { latestAnalysisId: analysisId } },
      );
    } catch (err) {
      // Full logging so we can actually see what's throwing. The frontend
      // gets the compact message; the server console gets the stack.
      console.error('[analysis:failed]', {
        owner, repo,
        message: err?.message,
        name: err?.name,
        stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
      });
      const message = (err && err.message) ? String(err.message).slice(0, 500) : 'Unknown analysis error';
      await RepositoryAnalysis.updateOne(
        { _id: analysisId },
        { $set: { status: 'failed', error: message } },
      ).catch(() => { /* best-effort — nothing to do if the DB is unreachable */ });
    }
  });
}

// Find-or-create the Project row for (user, owner, repo). Enforces the
// compound unique index at the app level with a clear error message.
async function upsertProject({ userId, source, owner, repo, defaultBranch, metadata }) {
  const existing = await Project.findOne({ userId, repoOwner: owner, repoName: repo });
  if (existing) {
    // Refresh metadata + URL in case the repo was renamed / moved provider path.
    existing.source = source;
    existing.repoUrl = canonicalUrl({ owner, repo });
    existing.defaultBranch = defaultBranch || existing.defaultBranch;
    existing.metadata = metadata;
    await existing.save();
    return { project: existing, reused: true };
  }
  const project = await Project.create({
    userId,
    source,
    provider: 'github',
    repoOwner: owner,
    repoName: repo,
    repoUrl: canonicalUrl({ owner, repo }),
    defaultBranch: defaultBranch || 'main',
    metadata,
  });
  return { project, reused: false };
}

// Send the response shape used by the frontend for both creation and polling.
function projectResponse(res, { project, analysis, statusCode = 200, unlockedBadges }) {
  return res.status(statusCode).json({
    success: true,
    project,
    analysis,
    ...(unlockedBadges?.length ? { unlockedBadges } : {}),
  });
}

/**
 * Evaluate achievements for a project_created event, apply any new unlocks
 * to the user, persist, and return the display-ready badge list. Shared by
 * createFromUrl and createFromGithub so the logic lives in one place.
 *
 * The `User` doc is re-loaded fresh so we don't collide with any parallel
 * writes the analysis pipeline may perform on the user later.
 */
async function evaluateProjectCreatedBadges(userId, project) {
  const User = require('../models/User.model');
  const user = await User.findById(userId);
  if (!user) return [];
  const ids = achievements.evaluate(user, {
    kind: 'project_created',
    payload: { project },
  });
  const applied = achievements.applyUnlocks(user, ids);
  if (applied.length) {
    await user.save({ validateBeforeSave: false });
  }
  return achievements.describeUnlocks(applied);
}

// ── Handlers ────────────────────────────────────────────────────────────────

// POST /api/projects/from-url  { url }
const createFromUrl = async (req, res, next) => {
  try {
    const { url } = req.body || {};

    let owner, repo;
    try {
      ({ owner, repo } = parseRepoUrl(url));
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Public metadata fetch. A pasted URL for a private repo will 404 here,
    // which is the correct signal — the user should connect GitHub instead.
    let repoMeta;
    try {
      // Attach the user's token if available: gives higher rate limits and
      // succeeds for private repos they own without a separate flow.
      const token = await loadGithubToken(req.user._id);
      repoMeta = await github.getRepo(owner, repo, { token });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const { project } = await upsertProject({
      userId: req.user._id,
      source: 'public_url',
      owner,
      repo,
      defaultBranch: repoMeta.default_branch,
      metadata: metadataFromRepo(repoMeta),
    });

    const analysis = await RepositoryAnalysis.create({
      projectId: project._id,
      status: 'processing',
    });

    const unlockedBadges = await evaluateProjectCreatedBadges(req.user._id, project);

    projectResponse(res, { project, analysis, statusCode: 201, unlockedBadges });

    // Fire after response is sent.
    const token = await loadGithubToken(req.user._id);
    runAnalysisInBackground({
      analysisId: analysis._id,
      projectId: project._id,
      owner,
      repo,
      defaultBranch: repoMeta.default_branch,
      token,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects/from-github  { owner, repo }
const createFromGithub = async (req, res, next) => {
  try {
    const { owner, repo } = req.body || {};
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'owner and repo are required' });
    }

    const token = await loadGithubToken(req.user._id);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Connect a GitHub account before importing a repository.',
      });
    }

    let repoMeta;
    try {
      repoMeta = await github.getRepo(owner, repo, { token });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const { project } = await upsertProject({
      userId: req.user._id,
      source: 'github_connected',
      owner,
      repo,
      defaultBranch: repoMeta.default_branch,
      metadata: metadataFromRepo(repoMeta),
    });

    const analysis = await RepositoryAnalysis.create({
      projectId: project._id,
      status: 'processing',
    });

    const unlockedBadges = await evaluateProjectCreatedBadges(req.user._id, project);

    projectResponse(res, { project, analysis, statusCode: 201, unlockedBadges });

    runAnalysisInBackground({
      analysisId: analysis._id,
      projectId: project._id,
      owner,
      repo,
      defaultBranch: repoMeta.default_branch,
      token,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects
const listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();

    // Attach the latest analysis status (only the status, not the body) so
    // the list can render "processing…" indicators without a second query.
    const ids = projects.map((p) => p.latestAnalysisId).filter(Boolean);
    const analyses = ids.length
      ? await RepositoryAnalysis.find({ _id: { $in: ids } })
          .select('_id status updatedAt')
          .lean()
      : [];
    const byId = new Map(analyses.map((a) => [String(a._id), a]));

    const enriched = projects.map((p) => ({
      ...p,
      analysisStatus: p.latestAnalysisId ? byId.get(String(p.latestAnalysisId))?.status || null : null,
    }));

    res.json({ success: true, projects: enriched });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:id — used by the Workspace page AND by the analyzing
// page's polling loop.
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    let analysis = null;
    if (project.latestAnalysisId) {
      analysis = await RepositoryAnalysis.findById(project.latestAnalysisId).lean();
    } else {
      // Legacy safety: fall back to the newest analysis for this project.
      analysis = await RepositoryAnalysis.findOne({ projectId: project._id })
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({ success: true, project, analysis });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects/:id/reanalyze
const reanalyzeProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Refresh repo metadata so a rename / default-branch change is caught.
    const token = await loadGithubToken(req.user._id);
    let repoMeta;
    try {
      repoMeta = await github.getRepo(project.repoOwner, project.repoName, { token });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    project.defaultBranch = repoMeta.default_branch;
    project.metadata = metadataFromRepo(repoMeta);
    await project.save();

    const analysis = await RepositoryAnalysis.create({
      projectId: project._id,
      status: 'processing',
    });

    res.status(202).json({ success: true, project, analysis });

    runAnalysisInBackground({
      analysisId: analysis._id,
      projectId: project._id,
      owner: project.repoOwner,
      repo: project.repoName,
      defaultBranch: project.defaultBranch,
      token,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/projects/:id
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    // Analyses are orphaned but not cascaded here to keep this endpoint
    // fast and side-effect-simple. A periodic sweep can clean them later.
    await RepositoryAnalysis.deleteMany({ projectId: project._id }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createFromUrl,
  createFromGithub,
  listProjects,
  getProject,
  reanalyzeProject,
  deleteProject,
};
