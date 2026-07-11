const Interview = require('../models/Interview.model');
const WeakTopic = require('../models/WeakTopic.model');
const Project = require('../models/Project.model');
const aiProviderManager = require('./aiProviderManager');
const coachActions = require('./coachActions');

/**
 * coach.service — composes a personalized "focus areas" roadmap for the
 * Coach page. Reads existing data (WeakTopic + Interview + Project). Asks
 * the LLM to reason over that signal and produce 3–5 short focus areas.
 * Each focus area carries 1–3 pre-built CoachActions (see coachActions.js)
 * so the frontend can dispatch them without touching the roadmap shape.
 *
 * Result is cached on User.coachRoadmap for 24h. Callers use getRoadmap()
 * to get either the cached value or a freshly generated one. The refresh
 * controller bypasses the cache explicitly.
 *
 * The engine and the AI runtime are NOT touched. This service is offline
 * to the interview flow.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TOKENS = 1200;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Return a roadmap for the user. Uses cached value if fresh; otherwise
 * generates a new one and persists it. `force: true` bypasses cache.
 */
async function getRoadmap(user, { force = false } = {}) {
  if (!force && isFresh(user?.coachRoadmap)) {
    return {
      items: user.coachRoadmap.items || [],
      generatedAt: user.coachRoadmap.generatedAt,
      cached: true,
    };
  }

  const items = await generateRoadmap(user);

  user.coachRoadmap = { items, generatedAt: new Date() };
  await user.save({ validateBeforeSave: false });

  return { items, generatedAt: user.coachRoadmap.generatedAt, cached: false };
}

// ── Freshness ───────────────────────────────────────────────────────────────

function isFresh(cache) {
  if (!cache?.generatedAt) return false;
  if (!Array.isArray(cache.items) || cache.items.length === 0) return false;
  return Date.now() - new Date(cache.generatedAt).getTime() < CACHE_TTL_MS;
}

// ── Generation ──────────────────────────────────────────────────────────────

/**
 * Compose the raw data pack, call the LLM, then normalize the result.
 *
 * For brand-new users with zero signal (no interviews, no projects), skip
 * the LLM entirely and return an onboarding-shaped roadmap. Cheaper and
 * avoids a nonsensical "based on your interviews…" model reply.
 */
async function generateRoadmap(user) {
  const role = user.targetRole || 'sde';

  const [weakTopics, recentInterviews, inProgressInterview, projects] = await Promise.all([
    WeakTopic.find({ userId: user._id, role })
      .sort({ avgScore: 1 })
      .limit(6)
      .select('topic avgScore attempts')
      .lean(),
    Interview.find({ userId: user._id, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('title mode config.projectMode.subMode results.overallScore results.strengths results.weaknesses completedAt')
      .lean(),
    Interview.findOne({ userId: user._id, status: 'in_progress' })
      .sort({ updatedAt: -1 })
      .select('_id title')
      .lean(),
    Project.find({ userId: user._id, latestAnalysisId: { $ne: null } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('_id repoOwner repoName metadata')
      .lean(),
  ]);

  // Zero-signal onboarding roadmap.
  if (recentInterviews.length === 0 && !inProgressInterview) {
    return onboardingRoadmap(user, projects);
  }

  const prompt = buildPrompt({
    user,
    role,
    weakTopics,
    recentInterviews,
    hasProject: projects.length > 0,
  });

  let raw = '';
  try {
    raw = await aiProviderManager.generate(prompt, {
      temperature: 0.35,
      maxTokens: MAX_TOKENS,
    });
  } catch (err) {
    console.error('[coach] LLM failed:', err.message);
    return fallbackRoadmap({ user, weakTopics, recentInterviews, inProgressInterview, projects });
  }

  const parsedItems = extractItems(raw);
  if (!parsedItems || parsedItems.length === 0) {
    console.error('[coach] LLM output not parseable, using fallback');
    return fallbackRoadmap({ user, weakTopics, recentInterviews, inProgressInterview, projects });
  }

  // Hydrate LLM output with real CoachAction objects. The model returns
  // abstract action tags; the service turns them into fully-typed actions
  // pointing at the right topics / interviews / projects.
  return hydrateItems(parsedItems, {
    user,
    weakTopics,
    recentInterviews,
    inProgressInterview,
    projects,
  });
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt({ user, role, weakTopics, recentInterviews, hasProject }) {
  const weakList = weakTopics.length
    ? weakTopics.map((t) => `- ${t.topic} (avg ${t.avgScore.toFixed(1)}/10, ${t.attempts} attempts)`).join('\n')
    : '- (no persistent weak topics yet)';

  const recentList = recentInterviews.length
    ? recentInterviews
        .slice(0, 6)
        .map((iv) => `- ${iv.title} → ${iv.results?.overallScore ?? 0}/10 (${iv.mode || 'general'})`)
        .join('\n')
    : '- (no completed interviews yet)';

  return `You are the AI Coach for a developer interview prep platform. Compose 3–5 focus areas that will most improve this user's readiness.

User target role: ${role}
Experience: ${user.experience || 'fresher'}
Weakest topics:
${weakList}

Recent interviews (newest first):
${recentList}

Has connected a project workspace: ${hasProject ? 'yes' : 'no'}

Return a SINGLE JSON object — no prose, no markdown fences. Shape:

{
  "items": [
    {
      "title": "Get comfortable with async/await",
      "reason": "You averaged 4.2 across 6 questions on Async/Promises",
      "priority": "high|medium|low",
      "estimatedMinutes": 10,
      "actionTags": ["practice_now:Async/Promises", "review_feedback:latest"]
    }
  ]
}

Rules:
- items.length between 3 and 5.
- Each focus area gets 1–3 actionTags, chosen from:
    practice_now:<topic>         — kick off a short practice on this exact topic
    retry_question:latest_weak   — retry the weakest question of the most recent interview
    review_feedback:latest       — review the most recent interview's feedback
    continue_interview           — only include if there is an in-progress interview
    continue_project:<slot>      — where slot is 0, 1, or 2 (index into recent projects)
- Reasons must reference the user's actual data (topic names, scores, interview titles). Do not invent metrics.
- Do NOT include actionTags of a type that has no matching data (e.g. no continue_interview when none is in progress).
- Output ONLY the JSON object.
`;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

// Balanced-brace scanner — same shape as the extractor in repoAnalysis.service.
function extractJsonObject(text) {
  if (!text) return null;
  let s = String(text).replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
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
        try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function extractItems(text) {
  const obj = extractJsonObject(text);
  if (!obj || !Array.isArray(obj.items)) return null;
  return obj.items
    .filter((it) => it && typeof it.title === 'string' && it.title.trim())
    .slice(0, 5);
}

// ── Hydration ───────────────────────────────────────────────────────────────

const PRIORITY_ENUM = new Set(['high', 'medium', 'low']);

/**
 * Turn { title, reason, priority, estimatedMinutes, actionTags[] } items
 * into the persisted shape { title, reason, priority, estimatedMinutes,
 * actions[] } where actions[] is an array of real CoachAction objects.
 *
 * Unknown action tags are silently dropped. Items that end up with zero
 * actions are also dropped — a recommendation with no next-step is noise.
 */
function hydrateItems(items, ctx) {
  const out = [];
  for (const raw of items) {
    const actions = [];
    for (const tag of raw.actionTags || []) {
      const built = buildActionFromTag(String(tag || ''), ctx);
      if (built) actions.push(built);
    }
    if (actions.length === 0) continue;

    out.push({
      title: String(raw.title).trim(),
      reason: String(raw.reason || '').trim(),
      priority: PRIORITY_ENUM.has(raw.priority) ? raw.priority : 'medium',
      estimatedMinutes: Number.isFinite(raw.estimatedMinutes)
        ? Math.max(1, Math.min(120, Math.round(raw.estimatedMinutes)))
        : null,
      actions,
    });
  }
  return out.slice(0, 5);
}

function buildActionFromTag(tag, ctx) {
  const [kind, arg = ''] = tag.split(':');
  const { user, weakTopics, recentInterviews, inProgressInterview, projects } = ctx;

  switch (kind) {
    case 'practice_now': {
      // Match the topic to a real WeakTopic when possible; otherwise use
      // the free-form arg as a seed topic.
      const match = weakTopics.find((wt) => wt.topic.toLowerCase() === arg.toLowerCase());
      return coachActions.buildPracticeNow(user, match || { topic: arg, avgScore: 0, attempts: 0 });
    }
    case 'retry_question': {
      // Only build if we have a most-recent completed interview to retry.
      const latest = recentInterviews[0];
      if (!latest) return null;
      return coachActions.buildRetryQuestion({ _id: latest._id }, 0);
    }
    case 'review_feedback': {
      const latest = recentInterviews[0];
      if (!latest) return null;
      return coachActions.buildReviewFeedback({ _id: latest._id });
    }
    case 'continue_interview': {
      if (!inProgressInterview) return null;
      return coachActions.buildContinueInterview(inProgressInterview);
    }
    case 'continue_project': {
      const idx = Number.parseInt(arg, 10);
      const p = projects[Number.isFinite(idx) ? idx : 0];
      if (!p) return null;
      return coachActions.buildContinueProject(p);
    }
    default:
      return null;
  }
}

// ── Fallbacks ───────────────────────────────────────────────────────────────

/**
 * Deterministic roadmap for brand-new users. Shown once, then replaced by
 * the LLM-generated one after their first interview.
 */
function onboardingRoadmap(user, projects) {
  const items = [
    {
      title: 'Take your first mock interview',
      reason: 'Baseline your skills so your Coach can personalize what comes next.',
      priority: 'high',
      estimatedMinutes: 15,
      actions: [coachActions.buildNav('Start an interview', '/interviews', { priority: 'high' })],
    },
  ];

  if (projects.length > 0) {
    items.push({
      title: `Try a project interview on ${projects[0].repoName}`,
      reason: "Practice grounded in your own code — questions become concrete.",
      priority: 'medium',
      estimatedMinutes: 15,
      actions: [coachActions.buildContinueProject(projects[0])],
    });
  } else {
    items.push({
      title: 'Connect a project workspace',
      reason: 'Analyze a repository so your Coach can factor real code into recommendations.',
      priority: 'medium',
      estimatedMinutes: 5,
      actions: [coachActions.buildNav('Analyze a repository', '/projects/new', { priority: 'medium' })],
    });
  }

  items.push({
    title: 'Set your target role and company',
    reason: 'Sharper defaults mean sharper practice.',
    priority: 'low',
    estimatedMinutes: 2,
    actions: [coachActions.buildNav('Update profile', '/profile', { priority: 'low' })],
  });

  return items;
}

/**
 * Deterministic roadmap when the LLM is unavailable or returns garbage.
 * Uses the raw signals we already loaded to compose a plausible plan.
 */
function fallbackRoadmap({ user, weakTopics, recentInterviews, inProgressInterview, projects }) {
  const items = [];

  if (inProgressInterview) {
    items.push({
      title: 'Finish your in-progress interview',
      reason: 'Complete the session so your progress is scored.',
      priority: 'high',
      estimatedMinutes: 12,
      actions: [coachActions.buildContinueInterview(inProgressInterview)],
    });
  }

  weakTopics.slice(0, 2).forEach((wt) => {
    items.push({
      title: `Improve ${wt.topic}`,
      reason: `Your average on this topic is ${wt.avgScore.toFixed(1)} across ${wt.attempts} attempts.`,
      priority: wt.avgScore < 5 ? 'high' : 'medium',
      estimatedMinutes: 10,
      actions: [coachActions.buildPracticeNow(user, wt)],
    });
  });

  const latest = recentInterviews[0];
  if (latest && items.length < 5) {
    items.push({
      title: 'Review your last interview',
      reason: `Recap "${latest.title}" (${latest.results?.overallScore ?? 0}/10).`,
      priority: 'medium',
      estimatedMinutes: 3,
      actions: [coachActions.buildReviewFeedback({ _id: latest._id })],
    });
  }

  if (projects[0] && items.length < 5) {
    items.push({
      title: `Continue with ${projects[0].repoName}`,
      reason: 'You have a workspace ready — practice on your real code.',
      priority: 'medium',
      estimatedMinutes: 15,
      actions: [coachActions.buildContinueProject(projects[0])],
    });
  }

  return items.slice(0, 5);
}

module.exports = { getRoadmap };
