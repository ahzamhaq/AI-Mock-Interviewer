import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart3, Trophy, Clock, Target,
  Play, Activity, AlertTriangle, Lightbulb, Hash, Sparkles, X,
} from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import { Panel, PanelHeader } from '../components/common/Panel';
import DashboardHero from '../components/dashboard/DashboardHero';
import PrimaryActions from '../components/dashboard/PrimaryActions';
import CoachPreview from '../components/dashboard/CoachPreview';
import ContinueLearning from '../components/dashboard/ContinueLearning';
import RecentInterviews from '../components/dashboard/RecentInterviews';
import RecentProjects from '../components/dashboard/RecentProjects';
import AnalyticsPreview from '../components/dashboard/AnalyticsPreview';
import EmptyState from '../components/common/EmptyState';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#9CA3AF';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const ONBOARDING_BANNER_KEY = 'onboarding_dashboard_dismissed';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_BANNER_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    analyticsAPI.getDashboard()
      .then((res) => setData(res))
      .catch((err) => {
        console.error('Dashboard fetch failed:', err);
        setLoadError(true);
        toast.error(err.message || 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, []);

  const dismissOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_BANNER_KEY, '1'); } catch { /* ignore */ }
    setOnboardingDismissed(true);
  };

  const avgScore = data?.stats?.averageScore || 0;
  const bestScore = data?.stats?.bestScore || 0;
  const totalSessions = data?.stats?.totalInterviews || 0;
  const streak = data?.stats?.streak || 0;
  const points = data?.stats?.points || 0;

  const weakTopics = data?.weakTopics?.slice(0, 5) || [];

  // First-time onboarding banner — only once the dashboard has actually
  // loaded and confirmed zero completed interviews, so it never flashes
  // for returning users while stats are still fetching.
  const showOnboarding = !!data && totalSessions === 0 && !onboardingDismissed;

  const suggestion = avgScore < 6
    ? { label: 'Easy · Fundamentals',   reason: 'Build confidence first' }
    : avgScore < 8
      ? { label: 'Medium · Weak topics', reason: weakTopics[0]?.topic ? `Target ${weakTopics[0].topic}` : 'Target weak areas' }
      : { label: 'Hard · FAANG-style',   reason: 'You are ready to push' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <main className="flex-1 pt-12">

        {/* ── Top · Welcome ─────────────────────────────────────────── */}
        <DashboardHero
          userName={user?.name}
          totalSessions={totalSessions}
          streak={streak}
          points={points}
        />

        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4">

          {/* ── Banner space reservation ──────────────────────────────
              loadError/showOnboarding below are unknown until the
              dashboard fetch resolves, so nothing occupies this spot
              during loading — then a banner (or neither) can appear and
              push PrimaryActions down (CLS). Reserving the same height
              here, invisibly, while loading avoids that shift. */}
          {loading && <div className="mb-4" style={{ height: 60 }} />}

          {/* ── Load error banner ─────────────────────────────────────
              Shown when the dashboard fetch fails outright, so a network
              hiccup doesn't silently read as "you have no history yet." */}
          {loadError && (
            <Panel className="mb-4">
              <div className="p-3 flex items-center gap-3">
                <AlertTriangle size={14} style={{ color: '#F85149' }} className="flex-shrink-0" />
                <p className="flex-1 text-xs" style={{ color: '#9CA3AF' }}>
                  Couldn't load your dashboard stats. Some sections may be showing stale or empty data.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-shrink-0 text-xs font-medium"
                  style={{ color: '#58A6FF', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            </Panel>
          )}

          {/* ── First-time onboarding banner ─────────────────────────
              Non-blocking, dismissible via localStorage. Shown only to
              users with zero completed interviews; never reappears once
              dismissed or once they complete their first session. */}
          {showOnboarding && (
            <Panel className="mb-4">
              <div className="p-3 flex items-center gap-3">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
                >
                  <Sparkles size={13} style={{ color: '#58A6FF' }} />
                </div>
                <p className="flex-1 text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                  <span style={{ color: '#F0F6FC', fontWeight: 500 }}>New here? </span>
                  Start with a General Interview to see how it works — it adapts to your role and experience as you go.
                </p>
                <button
                  onClick={() => navigate('/interviews/new')}
                  className="btn-accent flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <Play size={11} /> Start Interview
                </button>
                <button
                  onClick={dismissOnboarding}
                  className="flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{ width: 24, height: 24, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#9CA3AF')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
                  aria-label="Dismiss"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            </Panel>
          )}

          {/* ── Top · Primary Actions ─────────────────────────────── */}
          <PrimaryActions />

          {/* ── Coach preview (Sprint 4) ─────────────────────────────
              Top focus area from the roadmap. Hides entirely when the
              roadmap is empty or the fetch fails — new users see
              PrimaryActions unopposed by empty coach chrome. Reuses the
              same FocusAreaCard the Coach page renders (dense mode). */}
          <CoachPreview />

          {/* ── Continue Learning (Sprint 3) ─────────────────────────
              Data-driven rail: Resume in-progress · Retry weak topic ·
              Continue Project. Hides entirely when the endpoint returns
              nothing so new users see PrimaryActions unopposed. The Sprint
              1 ContinueWorking single-card is retired: its "resume" slot
              is now the first card of this rail. */}
          <ContinueLearning />

          {/* ── Middle · Recents ──────────────────────────────────── */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_300px] gap-3 mb-4">
            <RecentInterviews interviews={data?.recentInterviews} loading={loading} />
            <RecentProjects />

            {/* Right rail — insights preserved from previous dashboard so no
                functionality regresses. Weak topics, next session, system
                status, and the quick-nav list retain their exact behavior.
                On tablet the rail spans both columns as a 2×2 grid so it
                doesn't force a long single-column scroll. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 md:col-span-2 lg:col-span-1">
              <Panel>
                <PanelHeader icon={Lightbulb} label="next session" />
                <div className="p-3">
                  <div className="font-mono text-2xs mb-1" style={{ color: '#58A6FF' }}>{'// recommended'}</div>
                  <div className="text-sm font-medium mb-1" style={{ color: '#F0F6FC' }}>{suggestion.label}</div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: '#9CA3AF' }}>{suggestion.reason}</p>
                  <button
                    onClick={() => navigate('/interviews')}
                    className="btn-accent w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <Play size={11} /> Open setup
                  </button>
                </div>
              </Panel>

              <Panel>
                <PanelHeader icon={AlertTriangle} label="weak topics" />
                {weakTopics.length === 0 ? (
                  <EmptyState
                    compact
                    icon={AlertTriangle}
                    title="No weak topics yet"
                    description="Complete an interview and we'll surface areas to focus on."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate('/interviews/new')}
                        className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      >
                        <Play size={11} /> Start Interview
                      </button>
                    }
                  />
                ) : (
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
                        <div className="font-mono text-2xs mt-1" style={{ color: '#8B949E' }}>
                          {wt.attempts} attempts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader icon={Activity} label="system" />
                <div className="p-3 space-y-2 font-mono text-2xs">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#9CA3AF' }}>AI</span>
                    <span className="flex items-center gap-1.5" style={{ color: '#3FB950' }}>
                      <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                      ready
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#9CA3AF' }}>memory</span>
                    <span style={{ color: '#9CA3AF' }}>{totalSessions} indexed</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#9CA3AF' }}>weak topics</span>
                    <span style={{ color: '#D29922' }}>{weakTopics.length} tracked</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#9CA3AF' }}>latency</span>
                    <span style={{ color: '#3FB950' }}>~340ms</span>
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader icon={Hash} label="navigate" />
                <div>
                  {[
                    { to: '/analytics',   icon: BarChart3, label: 'Analytics',   k: 'A' },
                    { to: '/history',     icon: Clock,     label: 'History',     k: 'H' },
                    { to: '/leaderboard', icon: Trophy,    label: 'Leaderboard', k: 'L' },
                    { to: '/profile',     icon: Target,    label: 'Profile',     k: 'P' },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                      style={{ color: '#9CA3AF', borderTop: '1px solid #161B22' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#161B22';
                        e.currentTarget.style.color = '#F0F6FC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#9CA3AF';
                      }}
                    >
                      <item.icon size={12} />
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-2xs" style={{ color: '#8B949E' }}>⌘{item.k}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          {/* ── Bottom · Statistics ───────────────────────────────── */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px mb-4"
            style={{ background: '#21262D', borderRadius: 6, overflow: 'hidden', border: '1px solid #30363D' }}
          >
            {[
              { label: 'avg',      value: avgScore.toFixed(1),  sub: '/10',   color: SCORE_COLOR(avgScore) },
              { label: 'best',     value: bestScore.toFixed(1), sub: '/10',   color: '#D29922' },
              { label: 'sessions', value: totalSessions,        sub: 'total', color: '#F0F6FC' },
              { label: 'streak',   value: streak,               sub: 'days',  color: streak > 0 ? '#D29922' : '#9CA3AF' },
            ].map((m) => (
              <div key={m.label} className="px-3 py-2.5" style={{ background: '#0D1117' }}>
                <div className="font-mono text-2xs uppercase tracking-wide mb-1" style={{ color: '#8B949E' }}>
                  {m.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</span>
                  <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>{m.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Bottom · Analytics Preview ────────────────────────── */}
          <AnalyticsPreview scoreHistory={data?.scoreHistory} />

        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
