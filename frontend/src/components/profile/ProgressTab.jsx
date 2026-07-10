import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Target, Loader2, TrendingUp, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { analyticsAPI } from '../../services/api';
import SkillRadar from '../analytics/SkillRadar';
import TopicBreakdown from '../analytics/TopicBreakdown';

/**
 * ProgressTab — the "how am I doing" surface on Profile. Composes existing
 * primitives:
 *   • Streak summary  (from useAuth().user — current, longest, last date)
 *   • SkillRadar      (from analytics.radar — 5-axis skill picture)
 *   • TopicBreakdown  (from analytics.weakTopics — where to invest)
 *   • Type averages   (from analytics.typeAverages — score by question type)
 *
 * Reads analyticsAPI.getDetailed() with a 90-day window. All-time-ish
 * without being all-time: keeps queries fast and reflects the user's
 * current form rather than ancient history.
 *
 * Streak surfaces existing data — no milestone badges, no habit-loop
 * pressure. Interview prep is goal-oriented; users who succeed and stop
 * should not be punished by the UI.
 */
const WINDOW_DAYS = 90;

const StatTile = ({ icon: Icon, label, value, sub, color = '#F0F6FC' }) => (
  <div
    className="px-3 py-2.5"
    style={{ background: '#0D1117' }}
  >
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon size={11} style={{ color: '#6B7280' }} />}
      <span
        className="font-mono text-2xs uppercase tracking-wide"
        style={{ color: '#484F58' }}
      >
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-xl font-bold" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
          {sub}
        </span>
      )}
    </div>
  </div>
);

const ProgressTab = ({ user }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    analyticsAPI.getDetailed(WINDOW_DAYS)
      .then((res) => { if (alive) setData(res.analytics); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const streak = user?.streak ?? 0;
  const longestStreak = user?.longestStreak ?? 0;
  const lastInterviewDate = user?.lastInterviewDate ? new Date(user.lastInterviewDate) : null;
  const totalInterviews = user?.totalInterviews ?? 0;

  const radar = data?.radar || [];
  const weakTopics = (data?.weakTopics?.length ? data.weakTopics : data?.topicHeatmap || []).slice(0, 6);
  const typeAverages = data?.typeAverages || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      {/* Streak + basic counters */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-px"
        style={{ background: '#21262D', borderRadius: 6, overflow: 'hidden', border: '1px solid #30363D' }}
      >
        <StatTile
          icon={Flame}
          label="streak"
          value={streak}
          sub="days"
          color={streak > 0 ? '#D29922' : '#6B7280'}
        />
        <StatTile
          icon={Trophy}
          label="best streak"
          value={longestStreak}
          sub="days"
          color="#D29922"
        />
        <StatTile
          icon={Target}
          label="sessions"
          value={totalInterviews}
          sub="total"
        />
        <StatTile
          icon={Calendar}
          label="last session"
          value={lastInterviewDate ? formatDistanceToNow(lastInterviewDate, { addSuffix: false }) : '—'}
          sub={lastInterviewDate ? 'ago' : ''}
          color={lastInterviewDate ? '#F0F6FC' : '#6B7280'}
        />
      </div>

      {/* Loading / error surfaces */}
      {loading && (
        <div
          className="flex items-center justify-center py-10 rounded-xl"
          style={{ background: '#161B22', border: '1px solid #30363D' }}
        >
          <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
          <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>
            loading progress…
          </span>
        </div>
      )}

      {!loading && error && (
        <div
          className="p-4 text-xs rounded-xl"
          style={{
            background: 'rgba(248,81,73,0.08)',
            border: '1px solid rgba(248,81,73,0.3)',
            color: '#F0F6FC',
          }}
        >
          Couldn&apos;t load progress data. {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Skill radar */}
          <div
            className="p-4"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} style={{ color: '#6B7280' }} />
                <span
                  className="font-mono text-2xs uppercase tracking-wide"
                  style={{ color: '#9CA3AF' }}
                >
                  skill radar
                </span>
              </div>
              <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                last {WINDOW_DAYS} days
              </span>
            </div>
            <SkillRadar data={radar} />
          </div>

          {/* Weak topics */}
          <div
            className="p-4"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="font-mono text-2xs uppercase tracking-wide"
                style={{ color: '#9CA3AF' }}
              >
                weakest topics
              </span>
              <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                where to invest
              </span>
            </div>
            <TopicBreakdown items={weakTopics} />
          </div>

          {/* Type averages */}
          {typeAverages.length > 0 && (
            <div
              className="p-4 lg:col-span-2"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-mono text-2xs uppercase tracking-wide"
                  style={{ color: '#9CA3AF' }}
                >
                  average by question type
                </span>
                <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                  {typeAverages.reduce((s, t) => s + t.count, 0)} answered
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {typeAverages.map((t) => (
                  <div
                    key={t.type}
                    className="px-2.5 py-2"
                    style={{
                      background: '#0D1117',
                      border: '1px solid #30363D',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      className="font-mono text-2xs uppercase tracking-wide mb-1 truncate"
                      style={{ color: '#6B7280' }}
                    >
                      {t.type.replace(/_/g, ' ')}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-mono text-base font-bold"
                        style={{
                          color:
                            t.avgScore >= 8 ? '#3FB950' :
                            t.avgScore >= 6 ? '#D29922' : '#F85149',
                        }}
                      >
                        {Number(t.avgScore).toFixed(1)}
                      </span>
                      <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
                        /10
                      </span>
                    </div>
                    <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                      {t.count} answers
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && lastInterviewDate && (
        <p
          className="font-mono text-2xs mt-1"
          style={{ color: '#484F58' }}
        >
          {'// last session '}{format(lastInterviewDate, 'dd MMM yyyy')}
        </p>
      )}
    </motion.div>
  );
};

export default ProgressTab;
