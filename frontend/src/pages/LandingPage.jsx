import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mic, ArrowRight, ChevronRight,
  TerminalSquare,
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

// ── Terminal log feed ─────────────────────────────────────────────────────────

const LOG_LINES = [
  { t: '[12:04:18]', tag: 'SYSTEM', msg: 'Initialising session · Frontend / FAANG / Medium', tone: '#9CA3AF' },
  { t: '[12:04:19]', tag: 'AI',     msg: 'Provider: ready · session initialised',                tone: '#58A6FF' },
  { t: '[12:04:21]', tag: 'MEMORY', msg: '3 recent sessions loaded · 2 weak topics matched',    tone: '#D29922' },
  { t: '[12:04:22]', tag: 'AI',     msg: 'Generating question 1/5 (technical)',                  tone: '#58A6FF' },
  { t: '[12:04:24]', tag: 'SYSTEM', msg: 'Semantic similarity check passed · 0.31',              tone: '#3FB950' },
  { t: '[12:04:25]', tag: 'TTS',    msg: 'Speaking question · 7.2s',                              tone: '#9CA3AF' },
  { t: '[12:04:33]', tag: 'VOICE',  msg: 'Listening · transcript active',                        tone: '#F85149' },
  { t: '[12:04:51]', tag: 'VOICE',  msg: '2 filler words detected · WPM 142',                    tone: '#D29922' },
  { t: '[12:05:08]', tag: 'AI',     msg: 'Evaluating · technical 8.4 · comm 7.9 · confidence 82%', tone: '#3FB950' },
];

const TerminalFeed = () => {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN(v => (v >= LOG_LINES.length ? 1 : v + 1)), 1100);
    return () => clearInterval(id);
  }, []);
  const visible = LOG_LINES.slice(0, n);
  return (
    <div
      className="font-mono text-xs leading-relaxed space-y-1 max-h-44 overflow-hidden"
      style={{ color: '#9CA3AF' }}
    >
      {visible.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
          className="flex gap-2"
        >
          <span style={{ color: '#484F58' }}>{l.t}</span>
          <span style={{ color: l.tone, width: 52, flexShrink: 0 }}>{l.tag}</span>
          <span style={{ color: '#9CA3AF' }}>{l.msg}</span>
        </motion.div>
      ))}
      <div className="flex gap-2">
        <span style={{ color: '#484F58' }}>[12:05:..]</span>
        <span style={{ color: '#58A6FF' }}>SYSTEM</span>
        <span style={{ color: '#9CA3AF' }}>
          ready<span className="animate-blink" style={{ color: '#58A6FF' }}>▌</span>
        </span>
      </div>
    </div>
  );
};

// ── Live workspace preview ────────────────────────────────────────────────────

const WorkspacePreview = () => (
  <div
    className="rounded-lg overflow-hidden h-full flex flex-col"
    style={{ background: '#161B22', border: '1px solid #30363D', boxShadow: '0 24px 64px rgba(1,4,9,0.6)' }}
  >
    {/* Title bar */}
    <div
      className="flex items-center gap-2 px-3 flex-shrink-0"
      style={{ background: '#1C2128', borderBottom: '1px solid #30363D', height: 32 }}
    >
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F85149' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#D29922' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#3FB950' }} />
      </div>
      <div className="flex-1 text-center font-mono text-2xs" style={{ color: '#6B7280' }}>
        interviewai · live session · Frontend Engineer
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
        <span className="text-2xs font-mono" style={{ color: '#3FB950' }}>REC</span>
      </div>
    </div>

    {/* Three-pane body */}
    <div className="flex flex-1 min-h-0">
      {/* Left: AI state */}
      <div
        className="flex-shrink-0 p-3 flex flex-col gap-3"
        style={{ width: 100, borderRight: '1px solid #21262D', background: '#0D1117' }}
      >
        {/* Avatar dot */}
        <div className="flex items-center justify-center" style={{ height: 60 }}>
          <motion.div
            className="w-12 h-12 rounded-full relative"
            style={{ background: 'radial-gradient(circle, #1F6FEB 0%, #161B22 70%)', border: '1px solid #58A6FF' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(88,166,255,0.4) 0%, transparent 60%)' }}
            />
          </motion.div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>State</div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#58A6FF' }} />
            <span className="text-2xs" style={{ color: '#58A6FF' }}>speaking</span>
          </div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>Status</div>
          <div className="font-mono text-2xs" style={{ color: '#3FB950' }}>online</div>
        </div>
      </div>

      {/* Center: question + answer */}
      <div className="flex-1 p-3 min-w-0" style={{ background: '#0D1117' }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-mono text-2xs px-1.5 py-0.5 rounded"
            style={{ background: '#21262D', color: '#9CA3AF', border: '1px solid #30363D' }}
          >
            Q2/5
          </span>
          <span
            className="text-2xs px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(88,166,255,0.08)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.2)' }}
          >
            technical
          </span>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: '#F0F6FC' }}>
          Explain how React's reconciliation works and how the virtual DOM diffing affects render performance.
        </p>

        <div
          className="rounded p-2 font-mono text-2xs leading-relaxed"
          style={{ background: '#010409', border: '1px solid #21262D' }}
        >
          <div className="uppercase tracking-wide font-sans mb-1.5" style={{ color: '#484F58', fontSize: 9 }}>
            Live transcript
          </div>
          <span style={{ color: '#9CA3AF' }}>
            React uses a virtual DOM to batch updates. The reconciler compares the
            previous tree with the new one using keys and component types
          </span>
          <span className="animate-blink" style={{ color: '#58A6FF' }}>▌</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-end gap-0.5 h-3">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-sm"
                style={{ background: '#F85149', transformOrigin: 'bottom', height: 12 }}
                animate={{ scaleY: [0.3, 0.4 + Math.random() * 0.7, 0.3] }}
                transition={{ duration: 0.4 + Math.random() * 0.3, delay: i * 0.05, repeat: Infinity }}
              />
            ))}
          </div>
          <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>0:48</span>
        </div>
      </div>

      {/* Right: metrics */}
      <div
        className="flex-shrink-0 p-3 space-y-3"
        style={{ width: 110, borderLeft: '1px solid #21262D', background: '#0D1117' }}
      >
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>Avg</div>
          <div className="font-mono text-lg font-bold" style={{ color: '#F0F6FC' }}>8.4</div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>WPM</div>
          <div className="font-mono text-sm font-bold" style={{ color: '#3FB950' }}>142</div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>Filler</div>
          <div className="font-mono text-sm font-bold" style={{ color: '#D29922' }}>2</div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>Conf</div>
          <div className="font-mono text-sm font-bold" style={{ color: '#3FB950' }}>82%</div>
        </div>
        <div className="pt-2" style={{ borderTop: '1px solid #21262D' }}>
          <div className="text-2xs font-medium uppercase tracking-wide mb-1.5" style={{ color: '#484F58' }}>Scores</div>
          <div className="space-y-1">
            {[8.2, 8.4].map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>Q{i + 1}</span>
                <div className="flex-1 h-0.5 rounded" style={{ background: '#21262D' }}>
                  <div className="h-full rounded" style={{ width: `${s * 10}%`, background: '#3FB950' }} />
                </div>
                <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Status bar */}
    <div
      className="flex items-center justify-between px-2 flex-shrink-0 select-none"
      style={{ background: '#1F6FEB', height: 18, fontSize: 10, color: 'rgba(255,255,255,0.92)' }}
    >
      <div className="flex items-center gap-3 font-mono">
        <span className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full" style={{ background: '#F85149' }} />
          Recording
        </span>
        <span>Analyzing</span>
      </div>
      <div className="flex items-center gap-3 font-mono">
        <span>Google · FAANG</span>
        <span>Q2/5</span>
      </div>
    </div>
  </div>
);

// ── Landing Page ──────────────────────────────────────────────────────────────

const FEATURES = [
  { tag: 'voice',     label: 'Voice interviews',      desc: 'Speak naturally. Live transcription captures every word with sub-second latency.' },
  { tag: 'ai',        label: 'Multi-provider AI',     desc: 'Groq → Gemini → OpenRouter fallback chain. Sessions never fail mid-question.' },
  { tag: 'memory',    label: 'Adaptive memory',        desc: 'Tracks weak topics across sessions. Future questions bias toward areas you missed.' },
  { tag: 'analytics', label: 'Live diagnostics',       desc: 'WPM, filler words, confidence, technical depth — all monitored in realtime.' },
  { tag: 'topics',    label: 'Anti-repetition engine', desc: 'Hash-based embedding catches duplicate questions across your entire history.' },
  { tag: 'roles',     label: 'Company-specific',        desc: 'FAANG, product, startup, service — questions tuned to the target company type.' },
];

const LandingPage = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen" style={{ background: '#0D1117' }}>
      <Navbar />

      {/* ── Hero: split workspace preview ─────────────────────────────── */}
      <section className="pt-20" style={{ borderBottom: '1px solid #21262D' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-10 items-stretch">

            {/* Left: technical copy */}
            <div className="flex flex-col">
              <div
                className="inline-flex items-center gap-2 px-2 py-1 rounded font-mono text-2xs w-fit mb-5"
                style={{ background: '#161B22', border: '1px solid #30363D', color: '#9CA3AF' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                v1.2 · adaptive memory + 3D avatar
              </div>

              <h1
                className="text-3xl lg:text-4xl font-semibold mb-4"
                style={{ color: '#F0F6FC', letterSpacing: '-0.025em', lineHeight: 1.15 }}
              >
                Realtime AI interviews<br />
                <span style={{ color: '#58A6FF' }}>for serious engineers.</span>
              </h1>

              <p className="text-sm mb-6 max-w-lg" style={{ color: '#9CA3AF', lineHeight: 1.65 }}>
                Voice-first technical interview practice. Adaptive AI tracks your weak areas, scores
                technical depth and communication, and gives diagnostic feedback after every answer.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Link to="/signup">
                  <button className="btn-accent flex items-center gap-1.5 px-4 py-2 text-sm">
                    <Mic size={13} /> Start session
                    <ArrowRight size={12} />
                  </button>
                </Link>
                <Link to="/login">
                  <button className="btn-secondary px-4 py-2 text-sm">Sign in</button>
                </Link>
                <a
                  href="#features"
                  className="text-xs ml-2 transition-colors"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F0F6FC'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                >
                  See feature list <ChevronRight size={11} className="inline" />
                </a>
              </div>

              {/* Terminal feed */}
              <div
                className="rounded mt-auto p-3 flex flex-col gap-1"
                style={{ background: '#010409', border: '1px solid #21262D' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <TerminalSquare size={12} style={{ color: '#6B7280' }} />
                  <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>
                    System log
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-2xs font-mono" style={{ color: '#3FB950' }}>
                    <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                    live
                  </span>
                </div>
                <TerminalFeed />
              </div>
            </div>

            {/* Right: live workspace preview */}
            <div className="min-h-[460px] lg:min-h-[520px]">
              <WorkspacePreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Capability strip ───────────────────────────────────────────── */}
      <section style={{ background: '#0D1117' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: '#21262D' }}>
            {[
              { k: 'Avg latency',   v: '<400ms', tag: 'AI'      },
              { k: 'Models',         v: '12+',    tag: 'providers' },
              { k: 'Sessions',       v: '50K+',   tag: 'completed' },
              { k: 'Reliability',    v: '99.7%',  tag: 'uptime'  },
            ].map((s, i) => (
              <div key={i} className="p-4" style={{ background: '#0D1117' }}>
                <div className="font-mono text-2xs uppercase tracking-wide mb-1.5" style={{ color: '#484F58' }}>
                  {s.k} · <span style={{ color: '#6B7280' }}>{s.tag}</span>
                </div>
                <div className="font-mono text-2xl font-bold" style={{ color: '#F0F6FC' }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" style={{ borderTop: '1px solid #21262D' }} className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
            <div>
              <div className="font-mono text-2xs uppercase tracking-widest mb-2" style={{ color: '#58A6FF' }}>
                / capabilities
              </div>
              <h2 className="text-xl font-semibold" style={{ color: '#F0F6FC' }}>
                Engineered for the interview loop
              </h2>
              <p className="text-sm mt-2" style={{ color: '#6B7280', lineHeight: 1.6 }}>
                Each feature is built around a real bottleneck in technical interview prep.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: '#21262D' }}>
              {FEATURES.map((f) => (
                <div
                  key={f.tag}
                  className="p-4 transition-colors"
                  style={{ background: '#0D1117' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161B22'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0D1117'}
                >
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="font-mono text-2xs" style={{ color: '#58A6FF' }}>--{f.tag}</span>
                    <span className="text-sm font-medium" style={{ color: '#F0F6FC' }}>{f.label}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <section id="workflow" style={{ background: '#161B22', borderTop: '1px solid #21262D', borderBottom: '1px solid #21262D' }} className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="font-mono text-2xs uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
            / workflow
          </div>
          <h2 className="text-xl font-semibold mb-6" style={{ color: '#F0F6FC' }}>
            From setup to scored in four steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px" style={{ background: '#30363D' }}>
            {[
              { n: '01', title: 'Configure', desc: 'Role, company type, difficulty, JD or resume.' },
              { n: '02', title: 'Interview', desc: 'AI speaks questions. You respond by voice or text.' },
              { n: '03', title: 'Diagnose',  desc: 'Per-answer score: technical, communication, confidence.' },
              { n: '04', title: 'Iterate',   desc: 'Weak topics tracked. Next session adapts automatically.' },
            ].map(s => (
              <div key={s.n} className="p-5" style={{ background: '#0D1117' }}>
                <div className="font-mono text-2xs mb-3" style={{ color: '#484F58' }}>{s.n}</div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: '#F0F6FC' }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip — only for guests ────────────────────────────────── */}
      {!user && (
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F0F6FC' }}>
              Open a session
            </h2>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
              Free to start. No credit card. Sessions run in under 2 minutes.
            </p>
            <Link to="/signup">
              <button className="btn-accent px-6 py-2.5 text-sm">Create account →</button>
            </Link>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #21262D', background: '#0D1117' }} className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#238636' }}>
              <Mic size={10} style={{ color: '#fff' }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#F0F6FC' }}>InterviewAI</span>
            <span className="font-mono text-2xs" style={{ color: '#484F58' }}>v1.2.0</span>
          </div>
          <p className="font-mono text-2xs" style={{ color: '#484F58' }}>
            © {new Date().getFullYear()} · built for placement preparation
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
