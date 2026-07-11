import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, X, ArrowRight, Mic, GitBranch, Compass, BarChart3, Clock,
  Play, Trophy, User, Github, LayoutDashboard, HelpCircle,
} from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useAuth } from '../../context/AuthContext';
import {
  interviewAPI, projectsAPI, integrationsAPI,
} from '../../services/api';
import { resolveAction } from '../../services/coachActions';

/**
 * CommandPalette — global ⌘K launcher.
 *
 * Client-side fuzzy match over five item pools loaded on FIRST open (then
 * cached in state for the session):
 *   • Actions  — quick-start interview shortcuts (contextually gated)
 *   • Nav      — top-level destinations
 *   • Sessions — recent interviews (title + role + subMode + topic)
 *   • Projects — connected workspaces
 *   • Help     — a small hard-coded set of "how do I…" entries
 *
 * All navigation and creation goes through resolveAction — the same helper
 * the Continue Learning rail, Coach page, and unlock toasts use. One
 * dispatcher for every surface that renders actions.
 *
 * Keyboard:
 *   ↑ / ↓ — move selection
 *   Enter — execute selected
 *   Esc   — close
 */

// ── Fuzzy scorer ────────────────────────────────────────────────────────────
//
// Tiny in-house scorer. Not a real fuzzy library — 30 lines does 95% of the
// value for the palette's data sizes. Ranks matches by (a) contiguous
// substring hit, (b) starts-with, (c) subsequence-with-gaps, in that order.
function score(text, query) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === 0) return 100;
  if (idx > 0) return 80 - Math.min(idx, 40);

  // Subsequence with gaps — lets "conint" match "continue interview".
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    while (ti < t.length && t[ti] !== q[qi]) ti++;
    if (ti === t.length) return 0;
    ti++;
  }
  return 30;
}

// ── Static data ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',   route: '/dashboard',   icon: LayoutDashboard },
  { label: 'Interviews',  route: '/interviews',  icon: Mic },
  { label: 'Projects',    route: '/projects',    icon: GitBranch },
  { label: 'Analytics',   route: '/analytics',   icon: BarChart3 },
  { label: 'Coach',       route: '/coach',       icon: Compass },
  { label: 'History',     route: '/history',     icon: Clock },
  { label: 'Leaderboard', route: '/leaderboard', icon: Trophy },
  { label: 'Profile',     route: '/profile',     icon: User },
];

const HELP_ITEMS = [
  { label: 'Keyboard shortcuts',  route: '/profile', icon: HelpCircle,
    subtitle: 'Palette: ⌘K · Nav via arrow keys' },
  { label: 'Connect GitHub',      route: '/profile?tab=connections', icon: Github,
    subtitle: 'Import your own repositories' },
  { label: 'Analyze a repository',route: '/projects/new', icon: GitBranch,
    subtitle: 'Paste a URL or pick a repo' },
];

const ROLE_QUICK_STARTS = [
  { label: 'Start Frontend Interview',       role: 'frontend_developer' },
  { label: 'Start Backend Interview',        role: 'backend_developer' },
  { label: 'Start Full Stack Interview',     role: 'fullstack_developer' },
  { label: 'Start SDE Interview',            role: 'sde' },
  { label: 'Start System Design Interview',  role: 'sde', round: 'system_design' },
];

// ── Component ───────────────────────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');

const CommandPalette = () => {
  const { open, closePalette } = useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ghConnected, setGhConnected] = useState(false);
  const [inProgress, setInProgress] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load data lazily on first open. Cached in state for the session.
  useEffect(() => {
    if (!open || loaded) return;
    let alive = true;
    Promise.all([
      interviewAPI.getHistory({ page: 1, limit: 50 }).catch(() => ({ interviews: [] })),
      projectsAPI.list().catch(() => ({ projects: [] })),
      integrationsAPI.githubStatus().catch(() => ({ connected: false })),
    ]).then(([hist, projList, gh]) => {
      if (!alive) return;
      const all = hist.interviews || [];
      setSessions(all.filter((s) => s.status !== 'in_progress'));
      setInProgress(all.find((s) => s.status === 'in_progress') || null);
      setProjects(projList.projects || []);
      setGhConnected(!!gh?.connected);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [open, loaded]);

  // Focus input on open; reset query when closed.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Defer to give the modal a tick to mount.
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // ── Build items ────────────────────────────────────────────────────────

  const items = useMemo(() => {
    if (!loaded && !open) return [];

    const groups = [];

    // Actions — contextually gated.
    const actions = [];
    if (inProgress) {
      actions.push({
        id: `action:continue:${inProgress._id}`,
        group: 'Actions', icon: Play,
        label: 'Continue in-progress interview',
        subtitle: inProgress.title,
        action: { kind: 'continue_interview', route: `/interview/${inProgress._id}` },
      });
    }
    ROLE_QUICK_STARTS.forEach((qs) => {
      actions.push({
        id: `action:qs:${qs.label}`,
        group: 'Actions', icon: Mic,
        label: qs.label,
        subtitle: 'Quick-start with sensible defaults',
        action: {
          kind: 'practice_now',
          payload: {
            role: qs.role,
            experienceLevel: user?.experience || '1-2_years',
            companyType: 'any',
            targetCompany: user?.targetCompany || '',
            interviewType: qs.round === 'system_design' ? 'system_design' : 'mixed',
            difficulty: 'medium',
            totalQuestions: 5,
            jobDescription: '',
            useResume: false,
            lengthIntent: 'auto',
            pressure: 'standard',
            personalityId: '',
            round: qs.round || 'general',
          },
        },
      });
    });
    actions.push({
      id: 'action:coach',
      group: 'Actions', icon: Compass,
      label: 'Open AI Coach',
      subtitle: 'See your personalized roadmap',
      action: { kind: 'nav', route: '/coach' },
    });
    if (!ghConnected) {
      actions.push({
        id: 'action:connect-github',
        group: 'Actions', icon: Github,
        label: 'Connect GitHub',
        subtitle: 'Import your own repositories',
        action: { kind: 'connect_github', route: '/profile?tab=connections' },
      });
    }
    groups.push(actions);

    // Projects.
    groups.push(projects.map((p) => ({
      id: `project:${p._id}`,
      group: 'Projects', icon: GitBranch,
      label: `${p.repoOwner}/${p.repoName}`,
      subtitle: p.metadata?.description || p.metadata?.language || 'workspace',
      action: { kind: 'continue_project', route: `/projects/${p._id}` },
    })));

    // Sessions.
    groups.push(sessions.slice(0, 40).map((s) => ({
      id: `session:${s._id}`,
      group: 'Sessions', icon: Mic,
      label: s.title,
      subtitle: [
        s.config?.role?.replace(/_/g, ' '),
        s.config?.interviewType,
        s.results?.overallScore != null ? `${s.results.overallScore}/10` : null,
      ].filter(Boolean).join(' · '),
      action: { kind: 'review_feedback', route: `/interview/${s._id}/results` },
    })));

    // Nav + Help.
    groups.push(NAV_ITEMS.map((n) => ({
      id: `nav:${n.route}`,
      group: 'Navigate', icon: n.icon,
      label: n.label,
      subtitle: n.route,
      action: { kind: 'nav', route: n.route },
    })));
    groups.push(HELP_ITEMS.map((h) => ({
      id: `help:${h.label}`,
      group: 'Help', icon: h.icon,
      label: h.label,
      subtitle: h.subtitle || '',
      action: { kind: 'nav', route: h.route },
    })));

    return groups.flat();
  }, [loaded, open, inProgress, sessions, projects, ghConnected, user]);

  // ── Filter + sort ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query) return items;
    const scored = items.map((it) => ({
      it,
      s: Math.max(
        score(it.label, query),
        it.subtitle ? score(it.subtitle, query) * 0.6 : 0,
      ),
    }));
    return scored
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);
  }, [items, query]);

  // Reset cursor when the filtered list changes.
  useEffect(() => { setCursor(0); }, [query]);

  // Keep the selected row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [cursor, filtered]);

  // ── Dispatch ───────────────────────────────────────────────────────────

  const execute = useCallback(async (item) => {
    if (!item) return;
    closePalette();
    await resolveAction(navigate, item.action);
  }, [closePalette, navigate]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); execute(filtered[cursor]); return; }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 flex items-start justify-center pt-8 sm:pt-24 px-3"
          style={{ zIndex: 100, background: 'rgba(1,4,9,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closePalette}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 480, damping: 40 }}
            className="w-full max-w-[560px] flex flex-col overflow-hidden"
            style={{
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: 10,
              boxShadow: '0 24px 60px rgba(1,4,9,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ borderBottom: '1px solid #21262D' }}
            >
              <Search size={14} style={{ color: '#6B7280' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions, projects, actions…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#F0F6FC' }}
              />
              <kbd
                className="px-1.5 py-0.5 font-mono text-2xs"
                style={{
                  color: '#9CA3AF',
                  background: '#0D1117',
                  border: '1px solid #30363D',
                  borderRadius: 3,
                }}
              >
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
              <button
                type="button"
                onClick={closePalette}
                className="p-1 rounded"
                style={{ color: '#6B7280', background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="overflow-y-auto"
              // Cap slightly lower on mobile so the input + footer stay in
              // view even on short mobile-landscape viewports.
              style={{ maxHeight: 'min(60vh, 480px)' }}
            >
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs" style={{ color: '#6B7280' }}>
                  {loaded ? 'No matches.' : 'Loading…'}
                </p>
              ) : (
                <ResultsList filtered={filtered} cursor={cursor} setCursor={setCursor} execute={execute} />
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-3 py-2 font-mono text-2xs"
              style={{
                background: '#0D1117',
                borderTop: '1px solid #21262D',
                color: '#484F58',
              }}
            >
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Extracted so React can memoize row rendering when nothing but cursor changed.
const ResultsList = ({ filtered, cursor, setCursor, execute }) => {
  let lastGroup = null;
  return (
    <div>
      {filtered.map((it, i) => {
        const showHeader = it.group !== lastGroup;
        lastGroup = it.group;
        const selected = i === cursor;
        const Icon = it.icon || ArrowRight;
        return (
          <React.Fragment key={it.id}>
            {showHeader && (
              <div
                className="px-3 pt-3 pb-1 font-mono text-2xs uppercase tracking-wide"
                style={{ color: '#6B7280' }}
              >
                {it.group}
              </div>
            )}
            <div
              data-idx={i}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setCursor(i)}
              onClick={() => execute(it)}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              style={{
                background: selected ? '#1C2128' : 'transparent',
                borderLeft: `2px solid ${selected ? '#58A6FF' : 'transparent'}`,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  background: '#0D1117',
                  border: '1px solid #30363D',
                  borderRadius: 6,
                }}
              >
                <Icon size={12} style={{ color: selected ? '#58A6FF' : '#9CA3AF' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: '#F0F6FC' }}>
                  {it.label}
                </div>
                {it.subtitle && (
                  <div className="text-xs truncate" style={{ color: '#6B7280' }}>
                    {it.subtitle}
                  </div>
                )}
              </div>
              <ArrowRight size={11} style={{ color: '#30363D' }} />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default CommandPalette;
