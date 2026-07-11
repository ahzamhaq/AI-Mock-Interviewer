/**
 * Achievement registry — the single source of truth for badge definitions.
 *
 * Achievements are static. Adding one is a new entry here + (if it needs a
 * new trigger event) a small hook in the evaluate.js switch. The frontend
 * ships a client-safe copy of this registry (id/title/description/category
 * /icon only; no evaluate fn) as `data/achievements.js` — see Commit 8.
 *
 * Design contract:
 *   • `id` is stable forever. Renaming the display title later is fine;
 *     changing the id would orphan every user's unlocked-badge record.
 *   • Achievements only ever UNLOCK, never revoke. If a user's streak
 *     breaks, their "7-Day Streak" badge stays. Badges are memory, not
 *     status — earning something you can lose is a punishment loop.
 *   • `evaluate(user, event)` returns true when the badge SHOULD be
 *     unlocked given the incoming event. Idempotency is enforced upstream
 *     by evaluate.js checking user.hasBadge(id) BEFORE calling this.
 *
 * `event.kind` values today:
 *   • 'interview_completed' — payload: { interview }
 *   • 'project_created'     — payload: { project }
 *   • 'weak_topic_updated'  — payload: { weakTopic } — fires post-interview
 *                             when WeakTopic docs are recomputed.
 */

const CATEGORIES = {
  GETTING_STARTED: 'getting_started',
  CONSISTENCY:     'consistency',
  MASTERY:         'mastery',
};

// Helper — score threshold for "perfect question" and "conquered topic".
const PERFECT_QUESTION_SCORE = 10;
const CONQUERED_TOPIC_SCORE = 8;
const REDEMPTION_MARGIN = 2.0;

const ACHIEVEMENTS = [
  // ── Getting Started ──────────────────────────────────────────────────
  {
    id: 'first_interview',
    title: 'First Interview',
    description: 'Completed your first mock interview.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'Mic',
    evaluate: (user, event) => (
      event.kind === 'interview_completed'
    ),
  },
  {
    id: 'first_project',
    title: 'First Project',
    description: 'Analyzed your first repository.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'GitBranch',
    evaluate: (user, event) => (
      event.kind === 'project_created'
    ),
  },
  {
    id: 'first_project_interview',
    title: 'First Project Interview',
    description: 'Completed an interview grounded in your own code.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'Layers',
    evaluate: (user, event) => (
      event.kind === 'interview_completed'
      && event.payload?.interview?.mode === 'project'
    ),
  },

  // ── Consistency ──────────────────────────────────────────────────────
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Practiced for seven days in a row.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Flame',
    evaluate: (user, event) => (
      event.kind === 'interview_completed' && (user.streak || 0) >= 7
    ),
  },
  {
    id: 'streak_30',
    title: '30-Day Streak',
    description: 'A full month of daily practice.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Flame',
    evaluate: (user, event) => (
      event.kind === 'interview_completed' && (user.streak || 0) >= 30
    ),
  },
  {
    id: 'ten_interviews',
    title: '10 Interviews',
    description: 'Ten completed interviews under your belt.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Target',
    evaluate: (user, event) => (
      event.kind === 'interview_completed' && (user.totalInterviews || 0) >= 10
    ),
  },
  {
    id: 'fifty_interviews',
    title: '50 Interviews',
    description: 'Fifty completed interviews — serious dedication.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Trophy',
    evaluate: (user, event) => (
      event.kind === 'interview_completed' && (user.totalInterviews || 0) >= 50
    ),
  },

  // ── Mastery ──────────────────────────────────────────────────────────
  {
    id: 'perfect_question',
    title: 'First Perfect Question',
    description: 'Scored 10/10 on a single question.',
    category: CATEGORIES.MASTERY,
    icon: 'Star',
    evaluate: (user, event) => {
      if (event.kind !== 'interview_completed') return false;
      const qs = event.payload?.interview?.questions || [];
      return qs.some((q) => (q?.aiFeedback?.score ?? 0) >= PERFECT_QUESTION_SCORE);
    },
  },
  {
    id: 'topic_conquered',
    title: 'Weak Topic Conquered',
    description: 'Turned a weak area into a strength.',
    category: CATEGORIES.MASTERY,
    icon: 'TrendingUp',
    evaluate: (user, event) => (
      event.kind === 'weak_topic_updated'
      && (event.payload?.weakTopic?.avgScore ?? 0) >= CONQUERED_TOPIC_SCORE
      && (event.payload?.weakTopic?.attempts ?? 0) >= 3
    ),
  },
  {
    id: 'retry_redemption',
    title: 'Retry Redemption',
    description: 'Bounced back on a retry — you improved by 2 points or more.',
    category: CATEGORIES.MASTERY,
    icon: 'RotateCcw',
    evaluate: (user, event) => {
      if (event.kind !== 'interview_completed') return false;
      const iv = event.payload?.interview;
      if (!iv?.retryOf?.interviewId) return false;
      const parent = event.payload?.parentInterview;
      if (!parent?.results) return false;
      const child = iv.results?.overallScore ?? 0;
      const parentScore = parent.results.overallScore ?? 0;
      return child - parentScore >= REDEMPTION_MARGIN;
    },
  },
];

// Cheap lookup helpers.
const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
function getAchievement(id) { return byId.get(id) || null; }
function listAchievements() { return ACHIEVEMENTS; }

module.exports = {
  ACHIEVEMENTS,
  CATEGORIES,
  getAchievement,
  listAchievements,
};
