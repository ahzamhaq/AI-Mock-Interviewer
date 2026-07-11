import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  ACHIEVEMENTS, CATEGORIES, CATEGORY_LABEL, normalizeBadges,
} from '../../data/achievements';

/**
 * AchievementsTab — the Profile "Achievements" tab. Renders every badge in
 * the registry, grouped by category. Unlocked badges are colored + show
 * their unlock time; locked badges are muted with a padlock affordance.
 *
 * Badge storage tolerates BOTH shapes:
 *   • Legacy String[]                (pre-Sprint-4)
 *   • Sprint 4 [{ id, unlockedAt }]  (Commit 8 migration)
 *
 * normalizeBadges() flattens them into a Map for lookup. When the backend
 * fully migrates every user's badges to objects, the legacy branch simply
 * becomes cold — no code change needed.
 */

const CATEGORY_ORDER = [
  CATEGORIES.GETTING_STARTED,
  CATEGORIES.CONSISTENCY,
  CATEGORIES.MASTERY,
];

const BadgeIcon = ({ name, unlocked }) => {
  // Resolve icon by name string from the registry — Lucide exports each
  // icon as a PascalCase component. Falls back to Award for safety.
  const Icon = Icons[name] || Icons.Award;
  return (
    <Icon
      size={18}
      style={{ color: unlocked ? '#58A6FF' : '#484F58' }}
    />
  );
};

const BadgeCard = ({ def, unlocked, unlockedAt, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="p-4 flex flex-col items-start"
    style={{
      background: unlocked ? '#0D1117' : 'rgba(13,17,23,0.5)',
      border: `1px solid ${unlocked ? '#30363D' : '#21262D'}`,
      borderRadius: 8,
      opacity: unlocked ? 1 : 0.55,
    }}
  >
    <div className="flex items-center justify-between w-full mb-3">
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 36,
          height: 36,
          background: unlocked ? '#161B22' : 'transparent',
          border: `1px solid ${unlocked ? '#30363D' : '#21262D'}`,
          borderRadius: 8,
        }}
      >
        <BadgeIcon name={def.icon} unlocked={unlocked} />
      </div>
      {!unlocked && (
        <Icons.Lock size={11} style={{ color: '#484F58' }} aria-label="Locked" />
      )}
    </div>
    <h4
      className="text-sm font-semibold mb-1"
      style={{ color: unlocked ? '#F0F6FC' : '#9CA3AF' }}
    >
      {def.title}
    </h4>
    <p
      className="text-xs leading-relaxed"
      style={{ color: unlocked ? '#9CA3AF' : '#6B7280' }}
    >
      {def.description}
    </p>
    {unlocked && unlockedAt && (
      <p
        className="font-mono text-2xs mt-2"
        style={{ color: '#484F58' }}
      >
        unlocked {formatDistanceToNow(new Date(unlockedAt), { addSuffix: true })}
      </p>
    )}
    {unlocked && !unlockedAt && (
      <p
        className="font-mono text-2xs mt-2"
        style={{ color: '#484F58' }}
      >
        unlocked
      </p>
    )}
  </motion.div>
);

const AchievementsTab = ({ user }) => {
  const badges = useMemo(() => normalizeBadges(user?.badges), [user?.badges]);
  const totalUnlocked = badges.size;
  const totalAvailable = ACHIEVEMENTS.length;

  const byCategory = useMemo(() => {
    const groups = {};
    for (const def of ACHIEVEMENTS) {
      (groups[def.category] ||= []).push(def);
    }
    return groups;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      {/* Summary strip */}
      <div
        className="p-4 rounded-2xl"
        style={{ background: '#161B22', border: '1px solid #30363D' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold" style={{ color: '#F0F6FC' }}>
              Achievements
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              Small milestones on your prep journey.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-bold" style={{ color: '#58A6FF' }}>
              {totalUnlocked}
              <span className="text-sm" style={{ color: '#6B7280' }}>
                {' / '}{totalAvailable}
              </span>
            </div>
            <div
              className="font-mono text-2xs uppercase tracking-wide mt-0.5"
              style={{ color: '#484F58' }}
            >
              unlocked
            </div>
          </div>
        </div>
      </div>

      {/* Per-category grids */}
      {CATEGORY_ORDER.map((cat) => {
        const defs = byCategory[cat] || [];
        if (!defs.length) return null;
        return (
          <div key={cat}>
            <div
              className="font-mono text-2xs uppercase tracking-wide mb-2"
              style={{ color: '#9CA3AF' }}
            >
              {CATEGORY_LABEL[cat]}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {defs.map((def, i) => (
                <BadgeCard
                  key={def.id}
                  def={def}
                  unlocked={badges.has(def.id)}
                  unlockedAt={badges.get(def.id)}
                  delay={i * 0.03}
                />
              ))}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};

export default AchievementsTab;
