/**
 * coachActions — pure builders for the shared CoachAction shape used by
 * the Coach roadmap, the Dashboard's Continue Learning rail, and (later)
 * the ⌘K command palette's quick actions. One vocabulary everywhere.
 *
 * CoachAction shape:
 *   {
 *     id                — stable per-action id (React key, dedupe)
 *     kind              — 'practice_now' | 'retry_question' |
 *                         'review_feedback' | 'continue_interview' |
 *                         'continue_project' | 'connect_github' | 'nav'
 *     label             — display text on the button
 *     priority          — 'high' | 'medium' | 'low'
 *     estimatedMinutes  — optional
 *     route             — for pure-navigation actions
 *     payload           — for actions that create an interview via POST
 *     meta              — free-form { topic, projectId, ... }
 *   }
 *
 * These builders never persist anything and never call the DB. Callers
 * supply the raw user/topic/interview data; builders shape it.
 */

// Small helpers so callers don't stringify ids manually.
const idFor = (parts) => parts.filter(Boolean).map(String).join(':');

// ── practice_now ─────────────────────────────────────────────────────────────
//
// Kicks off a new short interview seeded toward a specific weak topic. The
// payload matches what POST /api/interviews already accepts, so the frontend
// dispatches it identically to Sprint 3's Continue Learning cards.
function buildPracticeNow(user, weakTopic) {
  const role = user?.targetRole || 'sde';
  const experienceLevel = user?.experience || 'fresher';
  const avg = weakTopic?.avgScore ?? 0;
  const difficulty = avg > 0 && avg < 5 ? 'easy' : 'medium';

  return {
    id: idFor(['practice_now', weakTopic?.topic]),
    kind: 'practice_now',
    label: `Practice ${weakTopic?.topic || 'a weak area'}`,
    priority: avg < 5 ? 'high' : 'medium',
    estimatedMinutes: 10,
    payload: {
      role,
      experienceLevel,
      companyType: 'any',
      targetCompany: user?.targetCompany || '',
      interviewType: 'technical',
      difficulty,
      totalQuestions: 3,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'depth',
      pressure: 'standard',
      personalityId: '',
      round: 'technical',
      seedTopic: weakTopic?.topic || '',
    },
    meta: { topic: weakTopic?.topic },
  };
}

// ── retry_question ───────────────────────────────────────────────────────────
//
// Points the frontend at a specific past question. The frontend resolver
// POSTs to /api/interviews/:id/retry-question — a route Sprint 3 already
// ships. `meta` carries what the resolver needs; no payload for this kind.
function buildRetryQuestion(interview, questionIndex) {
  return {
    id: idFor(['retry_question', interview?._id, questionIndex]),
    kind: 'retry_question',
    label: 'Retry weakest question',
    priority: 'high',
    estimatedMinutes: 8,
    meta: {
      interviewId: String(interview?._id || ''),
      questionIndex,
    },
  };
}

// ── review_feedback ──────────────────────────────────────────────────────────
//
// Pure navigation to a past ResultsPage. Used when the coach thinks the
// user hasn't internalized their last feedback yet.
function buildReviewFeedback(interview) {
  return {
    id: idFor(['review_feedback', interview?._id]),
    kind: 'review_feedback',
    label: 'Review last feedback',
    priority: 'medium',
    estimatedMinutes: 3,
    route: `/interview/${interview?._id}/results`,
  };
}

// ── continue_interview ───────────────────────────────────────────────────────
function buildContinueInterview(interview) {
  return {
    id: idFor(['continue_interview', interview?._id]),
    kind: 'continue_interview',
    label: 'Resume in-progress interview',
    priority: 'high',
    estimatedMinutes: 12,
    route: `/interview/${interview?._id}`,
  };
}

// ── continue_project ─────────────────────────────────────────────────────────
function buildContinueProject(project) {
  return {
    id: idFor(['continue_project', project?._id]),
    kind: 'continue_project',
    label: `Return to ${project?.repoName || 'workspace'}`,
    priority: 'medium',
    estimatedMinutes: 5,
    route: `/projects/${project?._id}`,
    meta: { projectId: String(project?._id || '') },
  };
}

// ── connect_github ───────────────────────────────────────────────────────────
function buildConnectGithub() {
  return {
    id: 'connect_github',
    kind: 'connect_github',
    label: 'Connect GitHub',
    priority: 'low',
    route: '/profile?tab=connections',
  };
}

// ── nav ──────────────────────────────────────────────────────────────────────
function buildNav(label, route, { priority = 'low' } = {}) {
  return {
    id: idFor(['nav', route]),
    kind: 'nav',
    label,
    priority,
    route,
  };
}

module.exports = {
  buildPracticeNow,
  buildRetryQuestion,
  buildReviewFeedback,
  buildContinueInterview,
  buildContinueProject,
  buildConnectGithub,
  buildNav,
};
