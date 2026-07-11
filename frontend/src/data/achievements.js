/**
 * Client-safe achievement registry.
 *
 * Mirrors the backend registry (backend/src/services/achievements/registry.js)
 * but strips the `evaluate` function — the client never evaluates badges,
 * only renders them. Keeping the two in sync is a manual chore for now; if
 * this grows we can serve the definitions from a backend endpoint and drop
 * this file. For a fixed set of 10 badges, duplication is fine.
 *
 * CATEGORIES and ORDER match the backend so groupings render identically.
 */

export const CATEGORIES = {
  GETTING_STARTED: 'getting_started',
  CONSISTENCY:     'consistency',
  MASTERY:         'mastery',
};

export const CATEGORY_LABEL = {
  [CATEGORIES.GETTING_STARTED]: 'Getting Started',
  [CATEGORIES.CONSISTENCY]:     'Consistency',
  [CATEGORIES.MASTERY]:         'Mastery',
};

export const ACHIEVEMENTS = [
  // Getting Started
  {
    id: 'first_interview',
    title: 'First Interview',
    description: 'Completed your first mock interview.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'Mic',
  },
  {
    id: 'first_project',
    title: 'First Project',
    description: 'Analyzed your first repository.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'GitBranch',
  },
  {
    id: 'first_project_interview',
    title: 'First Project Interview',
    description: 'Completed an interview grounded in your own code.',
    category: CATEGORIES.GETTING_STARTED,
    icon: 'Layers',
  },

  // Consistency
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Practiced for seven days in a row.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Flame',
  },
  {
    id: 'streak_30',
    title: '30-Day Streak',
    description: 'A full month of daily practice.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Flame',
  },
  {
    id: 'ten_interviews',
    title: '10 Interviews',
    description: 'Ten completed interviews under your belt.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Target',
  },
  {
    id: 'fifty_interviews',
    title: '50 Interviews',
    description: 'Fifty completed interviews — serious dedication.',
    category: CATEGORIES.CONSISTENCY,
    icon: 'Trophy',
  },

  // Mastery
  {
    id: 'perfect_question',
    title: 'First Perfect Question',
    description: 'Scored 10/10 on a single question.',
    category: CATEGORIES.MASTERY,
    icon: 'Star',
  },
  {
    id: 'topic_conquered',
    title: 'Weak Topic Conquered',
    description: 'Turned a weak area into a strength.',
    category: CATEGORIES.MASTERY,
    icon: 'TrendingUp',
  },
  {
    id: 'retry_redemption',
    title: 'Retry Redemption',
    description: 'Bounced back on a retry — you improved by 2 points or more.',
    category: CATEGORIES.MASTERY,
    icon: 'RotateCcw',
  },
];

/**
 * normalizeBadges — accepts both the legacy String[] and the Sprint-4
 * {id, unlockedAt}[] shapes and returns a Map<id, unlockedAt|null>. Every
 * frontend read path goes through this so the migration is invisible.
 */
export function normalizeBadges(badges) {
  const map = new Map();
  if (!Array.isArray(badges)) return map;
  for (const b of badges) {
    if (typeof b === 'string') map.set(b, null);
    else if (b?.id) map.set(b.id, b.unlockedAt || null);
  }
  return map;
}
