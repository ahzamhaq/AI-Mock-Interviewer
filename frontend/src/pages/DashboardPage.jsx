import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mic, BarChart3, Trophy, TrendingUp, Clock, Zap, Target,
  ChevronRight, Flame, Play, Brain, Activity, GitCommit,
  AlertTriangle, Lightbulb, ArrowUpRight, Cpu, Hash
} from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, AreaChart, Area
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded px-2.5 py-1.5 font-mono text-2xs"
      style={{ background: '#1C2128', border: '1px solid #30363D' }}
    >
      <div style={{ color: '#6B7280' }}>{label}</div>
      <div className="font-bold" style={{ color: '#58A6FF' }}>{payload[0].value}/10</div>
    </div>
  );
};

// ── Section primitives ────────────────────────────────────────────────────────

const PanelHeader = ({ icon: Icon, label, action }) => (
  <div
    className="flex items-center justify-between px-3 py-2 flex-shrink-0"
    style={{ borderBottom: '1px solid #21262D', background: '#161B22' }}
  >
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={12} style={{ color: '#6B7280' }} />}
      <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
        {label}
      </span>
    </div>
    {action}
  </div>
);

const Panel = ({ children, className = '' }) => (
  <div
    className={`flex flex-col overflow-hidden ${className}`}
    style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
  >
    {children}
  </div>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getDashboard()
      .then(res => setData(res))
      .catch(err => console.error('Dashboard fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const scoreHistory = data?.scoreHistory?.slice(-14).map(s => ({
    date: format(new Date(s.date), 'dd MMM'),
    Score: s.overall,
  })) || [];

  const avgScore = data?.stats?.averageScore || 0;
  const bestScore = data?.stats?.bestScore || 0;
  const totalSessions = data?.stats?.totalInterviews || 0;
  const streak = data?.stats?.streak || 0;
  const points = data?.stats?.points || 0;

  // Mock weak topics until backend ships them in dashboard endpoint
  const weakTopics = data?.weakTopics?.length
    ? data.weakTopics.slice(0, 5)
    : [
        { topic: 'System Design',   avgScore: 5.2, attempts: 3 },
        { topic: 'Async / Promises', avgScore: 5.8, attempts: 4 },
        { topic: 'Data Structures', avgScore: 6.4, attempts: 6 },
      ];

  // Suggested next session — derived locally if backend doesn't provide
  const suggestion = avgScore < 6
    ? { label: 'Easy · Fundamentals',  reason: 'Build confidence first' }
    : avgScore < 8
      ? { label: 'Medium · Weak topics', reason: `Target ${weakTopics[0]?.topic || 'weak areas'}` }
      : { label: 'Hard · FAANG-style',   reason: 'You are ready to push' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        {/* ── Sub-toolbar ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 lg:px-8"
          style={{ height: 40, borderBottom: '1px solid #21262D', background: '#161B22' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-2xs" style={{ color: '#484F58' }}>~/workspace</span>
            <span style={{ color: '#30363D' }}>/</span>
            <span className="text-sm font-medium truncate" style={{ color: '#F0F6FC' }}>
              {user?.name?.split(' ')[0]?.toLowerCase() || 'guest'}
            </span>
            <span className="font-mono text-2xs hidden md:inline" style={{ color: '#6B7280' }}>
              · {totalSessions} sessions · streak {streak}d · {points} pts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/interview/setup')}
              className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Play size={11} /> New session
            </button>
          </div>
        </div>

        {/* ── 3-Panel Workspace ──────────────────────────────────────── */}
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-3">

            {/* LEFT: Session log */}
            <Panel>
              <PanelHeader
                icon={GitCommit}
                label="recent sessions"
                action={
                  <Link to="/history" className="font-mono text-2xs transition-colors" style={{ color: '#58A6FF' }}>
                    all →
                  </Link>
                }
              />
              <div className="flex-1 overflow-y-auto">
                {data?.recentInterviews?.length > 0 ? (
                  <div>
                    {data.recentInterviews.slice(0, 12).map((iv, i) => (
                      <motion.button
                        key={iv._id}
                        onClick={() => navigate(`/interview/${iv._id}/results`)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
                        style={{ borderBottom: '1px solid #161B22', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#161B22'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span
                          className="font-mono text-2xs flex-shrink-0 mt-0.5"
                          style={{ color: SCORE_COLOR(iv.results?.overallScore), width: 28 }}
                        >
                          {iv.results?.overallScore?.toFixed(1) ?? '—'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" style={{ color: '#F0F6FC' }}>
                            {iv.title}
                          </div>
                          <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                            {formatDistanceToNow(new Date(iv.completedAt), { addSuffix: true })}
                            <span style={{ color: '#30363D' }}> · </span>
                            <span style={{ color: '#6B7280' }}>{iv.config?.interviewType}</span>
                          </div>
                        </div>
                        <ChevronRight size={11} style={{ color: '#30363D', flexShrink: 0, marginTop: 2 }} />
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Mic size={20} style={{ color: '#30363D' }} className="mx-auto mb-3" />
                    <p className="text-xs mb-3" style={{ color: '#6B7280' }}>No sessions yet</p>
                    <button onClick={() => navigate('/interview/setup')} className="btn-accent text-xs px-3 py-1.5">
                      Start first session
                    </button>
                  </div>
                )}
              </div>
            </Panel>

            {/* CENTER: Performance + chart */}
            <div className="flex flex-col gap-3 min-w-0">

              {/* Metric strip */}
              <div className="grid grid-cols-4 gap-px" style={{ background: '#21262D', borderRadius: 6, overflow: 'hidden', border: '1px solid #30363D' }}>
                {[
                  { label: 'avg',     value: avgScore.toFixed(1),    sub: '/10',    color: SCORE_COLOR(avgScore) },
                  { label: 'best',    value: bestScore.toFixed(1),   sub: '/10',    color: '#D29922' },
                  { label: 'sessions', value: totalSessions,           sub: 'total',  color: '#F0F6FC' },
                  { label: 'streak',  value: streak,                  sub: 'days',  color: streak > 0 ? '#D29922' : '#6B7280' },
                ].map(m => (
                  <div key={m.label} className="px-3 py-2.5" style={{ background: '#0D1117' }}>
                    <div className="font-mono text-2xs uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>
                      {m.label}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</span>
                      <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>{m.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart panel */}
              <Panel className="flex-1">
                <PanelHeader
                  icon={TrendingUp}
                  label="score trend · last 14"
                  action={
                    <Link to="/analytics" className="font-mono text-2xs flex items-center gap-1" style={{ color: '#58A6FF' }}>
                      analytics <ArrowUpRight size={9} />
                    </Link>
                  }
                />
                <div className="p-3 flex-1 min-h-[200px]">
                  {scoreHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={scoreHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#58A6FF" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#58A6FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="#21262D" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#30363D', strokeDasharray: '2 2' }} />
                        <ReferenceLine y={7} stroke="#30363D" strokeDasharray="3 3" label={{ value: 'target', fill: '#484F58', fontSize: 9, position: 'right' }} />
                        <Area type="monotone" dataKey="Score" stroke="#58A6FF" strokeWidth={1.5} fill="url(#scoreFill)" dot={{ fill: '#58A6FF', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, fill: '#7CBDFF' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                      // no data — complete sessions to populate
                    </div>
                  )}
                </div>
              </Panel>

              {/* Quick session cards */}
              <Panel>
                <PanelHeader icon={Zap} label="quick start" />
                <div className="grid grid-cols-3 gap-px" style={{ background: '#21262D' }}>
                  {[
                    { label: 'Behavioral', desc: 'HR · soft skills',     type: 'behavioral' },
                    { label: 'Technical',   desc: 'DSA · system design',  type: 'technical'  },
                    { label: 'System Design', desc: 'Architecture',      type: 'system_design' },
                  ].map(t => (
                    <button
                      key={t.type}
                      onClick={() => navigate('/interview/setup')}
                      className="px-3 py-2.5 text-left transition-colors"
                      style={{ background: '#0D1117', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#161B22'}
                      onMouseLeave={e => e.currentTarget.style.background = '#0D1117'}
                    >
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#F0F6FC' }}>{t.label}</div>
                      <div className="font-mono text-2xs" style={{ color: '#6B7280' }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>

            {/* RIGHT: Insights & recommendations */}
            <div className="flex flex-col gap-3">

              {/* Suggestion */}
              <Panel>
                <PanelHeader icon={Lightbulb} label="next session" />
                <div className="p-3">
                  <div className="font-mono text-2xs mb-1" style={{ color: '#58A6FF' }}>// recommended</div>
                  <div className="text-sm font-medium mb-1" style={{ color: '#F0F6FC' }}>{suggestion.label}</div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: '#6B7280' }}>{suggestion.reason}</p>
                  <button
                    onClick={() => navigate('/interview/setup')}
                    className="btn-accent w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <Play size={11} /> Open setup
                  </button>
                </div>
              </Panel>

              {/* Weak topics */}
              <Panel>
                <PanelHeader icon={AlertTriangle} label="weak topics" />
                <div className="p-3 space-y-2.5">
                  {weakTopics.map((wt, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs truncate" style={{ color: '#F0F6FC' }}>{wt.topic}</span>
                        <span className="font-mono text-2xs" style={{ color: SCORE_COLOR(wt.avgScore) }}>
                          {wt.avgScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-0.5 rounded" style={{ background: '#21262D' }}>
                        <div
                          className="h-full rounded"
                          style={{ width: `${(wt.avgScore / 10) * 100}%`, background: SCORE_COLOR(wt.avgScore) }}
                        />
                      </div>
                      <div className="font-mono text-2xs mt-1" style={{ color: '#484F58' }}>
                        {wt.attempts} attempts
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* System status */}
              <Panel>
                <PanelHeader icon={Activity} label="system" />
                <div className="p-3 space-y-2 font-mono text-2xs">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#6B7280' }}>AI</span>
                    <span className="flex items-center gap-1.5" style={{ color: '#3FB950' }}>
                      <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                      ready
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#6B7280' }}>memory</span>
                    <span style={{ color: '#9CA3AF' }}>{totalSessions} indexed</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#6B7280' }}>weak topics</span>
                    <span style={{ color: '#D29922' }}>{weakTopics.length} tracked</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#6B7280' }}>latency</span>
                    <span style={{ color: '#3FB950' }}>~340ms</span>
                  </div>
                </div>
              </Panel>

              {/* Quick nav */}
              <Panel>
                <PanelHeader icon={Hash} label="navigate" />
                <div>
                  {[
                    { to: '/analytics',   icon: BarChart3, label: 'Analytics',   k: 'A' },
                    { to: '/history',     icon: Clock,      label: 'History',     k: 'H' },
                    { to: '/leaderboard', icon: Trophy,     label: 'Leaderboard', k: 'L' },
                    { to: '/profile',     icon: Target,     label: 'Profile',     k: 'P' },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                      style={{ color: '#9CA3AF', borderTop: '1px solid #161B22' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#161B22'; e.currentTarget.style.color = '#F0F6FC'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                      <item.icon size={12} />
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-2xs" style={{ color: '#484F58' }}>⌘{item.k}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
