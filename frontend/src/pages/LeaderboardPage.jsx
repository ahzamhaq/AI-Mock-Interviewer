import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, Hash, EyeOff } from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const RANK_COLORS = {
  0: '#D29922',
  1: '#6B7280',
  2: '#9B6942',
};

const LeaderboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userAPI.getLeaderboard()
      .then(res => setLeaders(res.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const topThree = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        {/* Sub-toolbar */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 lg:px-8"
          style={{ height: 40, borderBottom: '1px solid #21262D', background: '#161B22' }}
        >
          <div className="flex items-center gap-2">
            <Trophy size={12} style={{ color: '#D29922' }} />
            <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
              leaderboard
            </span>
            {!loading && (
              <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                · {leaders.length} ranked
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
              sorted by points · avg score tiebreaker
            </span>
            <Link
              to="/profile"
              className="font-mono text-2xs flex items-center gap-1 transition-colors"
              style={{ color: '#6B7280' }}
              onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
            >
              <EyeOff size={10} /> privacy settings
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <motion.div
                className="w-6 h-6 rounded-full"
                style={{ border: '2px solid #21262D', borderTopColor: '#58A6FF' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : leaders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24"
              style={{ border: '1px solid #21262D', borderRadius: 6, background: '#161B22' }}
            >
              <Trophy size={28} style={{ color: '#30363D' }} className="mb-4" />
              <p className="text-sm font-medium mb-1" style={{ color: '#F0F6FC' }}>No rankings yet</p>
              <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
                Complete interviews to appear here
              </p>
              <button
                onClick={() => navigate('/interviews/new')}
                className="btn-accent text-xs px-4 py-2"
              >
                Start first session
              </button>
            </div>
          ) : (
            <>
              {/* Podium — top 3 */}
              {topThree.length >= 1 && (
                <div
                  className="mb-4 p-4"
                  style={{ border: '1px solid #30363D', borderRadius: 6, background: '#161B22' }}
                >
                  <div className="font-mono text-2xs uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
                    / top performers
                  </div>
                  <div className="flex items-end justify-center gap-3">
                    {/* Arrange: 2nd, 1st, 3rd */}
                    {[topThree[1], topThree[0], topThree[2]].map((u, podiumIdx) => {
                      if (!u) return null;
                      const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                      const heights = { 1: 80, 2: 56, 3: 44 };
                      const isYou = u._id === user?._id;
                      return (
                        <motion.div
                          key={u._id}
                          className="flex flex-col items-center"
                          style={{ flex: 1 }}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: podiumIdx * 0.12 }}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-1.5 flex-shrink-0"
                            style={{
                              background: isYou ? 'rgba(31,111,235,0.3)' : '#21262D',
                              border: `1px solid ${RANK_COLORS[rank - 1] || '#30363D'}`,
                              color: '#F0F6FC',
                            }}
                          >
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <p className="text-xs font-medium truncate w-full text-center" style={{ color: '#F0F6FC' }}>
                            {isYou ? 'You' : u.name}
                          </p>
                          <p className="font-mono text-2xs mb-2" style={{ color: SCORE_COLOR(u.averageScore) }}>
                            {u.averageScore?.toFixed(1)}/10
                          </p>
                          <div
                            className="w-full flex flex-col items-center justify-end rounded-t"
                            style={{
                              height: heights[rank],
                              background: rank === 1 ? 'rgba(210,153,34,0.12)' : '#0D1117',
                              border: `1px solid ${RANK_COLORS[rank - 1] || '#21262D'}`,
                              borderBottom: 'none',
                            }}
                          >
                            <span className="text-xl mb-1">
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                            </span>
                            <span className="font-mono text-2xs pb-2" style={{ color: RANK_COLORS[rank - 1] || '#6B7280' }}>
                              #{rank}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full ranked list */}
              <div style={{ border: '1px solid #30363D', borderRadius: 6, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  className="grid px-4 py-2 font-mono text-2xs uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: '40px 1fr 72px 72px 64px 56px',
                    background: '#161B22',
                    borderBottom: '1px solid #21262D',
                    color: '#484F58',
                  }}
                >
                  <span>#</span>
                  <span>name</span>
                  <span className="text-right">points</span>
                  <span className="text-right">avg</span>
                  <span className="text-right">sessions</span>
                  <span className="text-right">streak</span>
                </div>

                {leaders.map((u, i) => {
                  const isYou = u._id === user?._id;
                  return (
                    <motion.div
                      key={u._id}
                      className="grid px-4 py-2.5 items-center"
                      style={{
                        gridTemplateColumns: '40px 1fr 72px 72px 64px 56px',
                        borderBottom: i < leaders.length - 1 ? '1px solid #21262D' : 'none',
                        background: isYou ? 'rgba(31,111,235,0.06)' : 'transparent',
                        borderLeft: isYou ? '2px solid #1F6FEB' : '2px solid transparent',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                    >
                      {/* Rank */}
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: RANK_COLORS[i] || '#484F58' }}
                      >
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}
                      </span>

                      {/* Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: isYou ? '#1F6FEB' : '#21262D', color: '#F0F6FC' }}
                        >
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm truncate" style={{ color: isYou ? '#58A6FF' : '#F0F6FC' }}>
                          {u.name}
                          {isYou && (
                            <span className="font-mono text-2xs ml-1.5" style={{ color: '#484F58' }}>
                              (you)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Points */}
                      <span className="font-mono text-sm font-bold text-right" style={{ color: '#D29922' }}>
                        {u.points}
                      </span>

                      {/* Avg score */}
                      <span className="font-mono text-sm text-right" style={{ color: SCORE_COLOR(u.averageScore) }}>
                        {u.averageScore?.toFixed(1)}
                      </span>

                      {/* Sessions */}
                      <span className="font-mono text-xs text-right" style={{ color: '#6B7280' }}>
                        {u.totalInterviews}
                      </span>

                      {/* Streak */}
                      <span className="font-mono text-xs text-right flex items-center justify-end gap-1" style={{ color: u.streak > 0 ? '#D29922' : '#484F58' }}>
                        {u.streak > 0 && <Flame size={10} />}
                        {u.streak}d
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Privacy note */}
              <p className="font-mono text-2xs text-center mt-4" style={{ color: '#484F58' }}>
                Not want to appear here?{' '}
                <Link to="/profile" style={{ color: '#6B7280' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                >
                  Turn off in Profile → Privacy
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
