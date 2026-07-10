const Interview = require('../models/Interview.model');
const WeakTopic = require('../models/WeakTopic.model');
const Project = require('../models/Project.model');
const topicGraph = require('./topicGraph');

/**
 * recommendations.service — composes the small ordered set of "what to do
 * next" cards that power the Dashboard's Continue Learning rail.
 *
 * Sources (in the exact order shown to the user):
 *   1. Resume        — most recent in-progress interview
 *   2. Retry weak    — top 1–2 weak topics for the user's target role
 *   3. Continue repo — most recent Project with a ready analysis
 *
 * If a slot has no data, it is not emitted — the frontend rail hides
 * entirely when the list is empty. Order is fixed so users learn the
 * rail once and don't chase moving cards.
 *
 * Each card carries a `payload` that can be POSTed to /api/interviews as-is
 * OR a `route` for cards that are pure navigation (Resume, Continue repo).
 * Frontend inspects `kind` to know which action to take.
 */

const MAX_CARDS = 3;
const MAX_WEAK_TOPICS = 2;

/**
 * Build the resume card if the user has an in-progress interview. Returns
 * null when there is none — the rail simply skips this slot.
 */
async function buildResumeCard(userId) {
  const inv = await Interview.findOne({ userId, status: 'in_progress' })
    .sort({ updatedAt: -1 })
    .select('_id title config mode updatedAt')
    .lean();
  if (!inv) return null;

  return {
    kind: 'resume',
    title: 'Resume where you left off',
    subtitle: inv.title,
    meta: inv.mode === 'project' ? 'project · in progress' : 'in progress',
    // Pure navigation. Frontend routes to the existing interview room.
    route: `/interview/${inv._id}`,
  };
}

/**
 * Build up to MAX_WEAK_TOPICS retry cards. Each card carries a payload
 * ready to be POSTed to /api/interviews to create a short, topic-focused
 * session. `graphHint` seeds the engine with adjacent topics for variety.
 */
async function buildWeakTopicCards(user) {
  const role = user.targetRole || 'sde';
  const topics = await WeakTopic.find({ userId: user._id, role })
    .sort({ avgScore: 1 })
    .limit(MAX_WEAK_TOPICS)
    .select('topic avgScore attempts')
    .lean();

  return topics.map((wt) => ({
    kind: 'retry_weak',
    title: `Practice ${wt.topic}`,
    subtitle: `Weakest area (avg ${wt.avgScore.toFixed(1)} / 10)`,
    meta: `${wt.attempts} attempts`,
    payload: {
      role,
      experienceLevel: user.experience || 'fresher',
      companyType: 'any',
      targetCompany: user.targetCompany || '',
      interviewType: 'technical',
      difficulty: wt.avgScore < 5 ? 'easy' : 'medium',
      totalQuestions: 3,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'depth',
      pressure: 'standard',
      personalityId: '',
      round: 'technical',
      // Seed the blueprint toward this topic. The engine still adapts, but
      // the first question will land on the weak area.
      seedTopic: wt.topic,
      // Adjacent topics for the engine's graphHint. Free signal.
      seedNearby: topicGraph.nearbyTopics(role, wt.topic).slice(0, 3),
    },
  }));
}

/**
 * Build the continue-repo card. We surface the user's most recently active
 * Project that has a ready analysis. Projects still processing are skipped
 * so the rail never points at a half-baked workspace.
 */
async function buildContinueProjectCard(userId) {
  const project = await Project.findOne({ userId, latestAnalysisId: { $ne: null } })
    .sort({ updatedAt: -1 })
    .select('_id repoOwner repoName metadata updatedAt')
    .lean();
  if (!project) return null;

  return {
    kind: 'continue_project',
    title: `Continue with ${project.repoName}`,
    subtitle: `${project.repoOwner}/${project.repoName}`,
    meta: project.metadata?.language || 'project',
    route: `/projects/${project._id}`,
  };
}

/**
 * Public entry point. Composes the three sources into a fixed-order list
 * and clips to MAX_CARDS. Callers can trust this list to be display-ready.
 */
async function listRecommendations(user) {
  const [resume, weakTopics, continueProject] = await Promise.all([
    buildResumeCard(user._id),
    buildWeakTopicCards(user),
    buildContinueProjectCard(user._id),
  ]);

  const ordered = [
    resume,
    ...weakTopics,
    continueProject,
  ].filter(Boolean);

  return ordered.slice(0, MAX_CARDS);
}

module.exports = { listRecommendations };
