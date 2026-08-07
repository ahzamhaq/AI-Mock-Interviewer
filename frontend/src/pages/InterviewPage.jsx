import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Volume2, VolumeX, SkipForward, CheckCircle,
  AlertCircle, Clock, ChevronRight, Zap, Brain, MessageSquare,
  Activity, Wifi, WifiOff, Circle, Square, Play, TerminalSquare,
  Lightbulb,
} from 'lucide-react';
import { interviewAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { applyBadgeUnlocks } from '../services/badgeUnlocks';
import { useSpeechSynthesis, useSpeechRecognition } from '../hooks/useVoice';
import { useAmplitudeAnalyzer } from '../hooks/useAmplitudeAnalyzer';
import { speak as ttsSpeak, cancelTTS } from '../services/tts';
import toast from 'react-hot-toast';
// Sprint 7 Commit 3 — Live Coding Workspace helpers. The workspace +
// split components are lazy-loaded further below so Monaco only enters
// memory during DSA interviews. Storage helpers stay static because
// they don't touch Monaco.
import { splitStorageKeyFor, storageKeyFor, clearCodingWorkspace } from '../components/interview/coding/storage';

// Lazy chunk — Monaco lives inside CodingWorkspace, so only DSA
// interviews pay the bundle cost. Non-DSA interviews never fetch it.
const CodingWorkspace = lazy(() => import('../components/interview/coding/CodingWorkspace'));

// Layout constants for the DSA coding column (desktop only).
const DSA_COL_MIN_PCT = 25;
const DSA_COL_MAX_PCT = 60;
const DSA_COL_DEFAULT_PCT = 40; // spec: 60% conversation / 40% editor
const DSA_DESKTOP_MIN_PX = 1024;

const TalkingAvatar = lazy(() => import('../components/avatar/TalkingAvatar'));

const PHASE = {
  LOADING: 'loading',
  AI_SPEAKING: 'ai_speaking',
  WAITING: 'waiting',
  USER_SPEAKING: 'user_speaking',
  PROCESSING: 'processing',
  FEEDBACK: 'feedback',
};

// ── Small reusable atoms ──────────────────────────────────────────────────────

const ScorePill = ({ score, max = 10 }) => {
  const pct = (score / max) * 100;
  const color = pct >= 75 ? '#3FB950' : pct >= 55 ? '#D29922' : '#F85149';
  return (
    <span
      className="metric text-sm font-bold px-2 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}
    >
      {score}{max === 100 ? '%' : `/${max}`}
    </span>
  );
};

const MiniBar = ({ value, max = 10, label }) => {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 75 ? '#3FB950' : pct >= 55 ? '#D29922' : '#F85149';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-2xs font-medium" style={{ color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span className="metric text-xs font-semibold" style={{ color }}>{value}{max === 100 ? '%' : `/${max}`}</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: '#21262D' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

const VoiceBar = ({ active, color = '#58A6FF' }) => (
  <div className="flex items-end gap-[3px] h-5">
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-sm"
        style={{ background: color, transformOrigin: 'bottom' }}
        animate={active ? {
          scaleY: [0.3, 1 + Math.random() * 0.8, 0.3],
          opacity: [0.6, 1, 0.6],
        } : { scaleY: 0.3, opacity: 0.3 }}
        transition={{
          duration: 0.5 + Math.random() * 0.3,
          delay: i * 0.08,
          repeat: active ? Infinity : 0,
          ease: 'easeInOut',
        }}
        initial={{ scaleY: 0.3, height: 20 }}
      />
    ))}
  </div>
);

const StatusDot = ({ active, color = '#3FB950' }) => (
  <span className="relative inline-flex h-2 w-2">
    {active && (
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ background: color }}
      />
    )}
    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: active ? color : '#30363D' }} />
  </span>
);

// ── Interview Page ────────────────────────────────────────────────────────────

const InterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const { stop: stopBrowserSpeaking, speaking: browserSpeaking } = useSpeechSynthesis();
  const { transcript, listening, startListening, stopListening, resetTranscript, supported: srSupported } = useSpeechRecognition();
  const { amplitude, start: startMic, stop: stopMic } = useAmplitudeAnalyzer();

  const [interview, setInterview] = useState(null);
  const [phase, setPhase] = useState(PHASE.LOADING);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [useTextInput, setUseTextInput] = useState(!srSupported);
  const [timer, setTimer] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [pendingMetrics, setPendingMetrics] = useState(null);
  const [greeting, setGreeting] = useState('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [showAvatar, setShowAvatar] = useState(true);
  const [sessionMetrics, setSessionMetrics] = useState({ wpm: 0, fillerCount: 0, confidence: 0, answers: [] });
  const [logs, setLogs] = useState([]);
  const [latency, setLatency] = useState(null);
  const timerRef = useRef(null);
  const logIdRef = useRef(0);

  // Sprint 7 Commit 2 — DSA hint state. `revealedHints` is a per-question
  // list of the hints the user has requested for the current question;
  // clears when we advance. `requestingHint` guards double-clicks.
  const [revealedHints, setRevealedHints] = useState([]);
  const [requestingHint, setRequestingHint] = useState(false);

  // Sprint 7 Commit 3 — coding-column width (desktop only). Percentage
  // of the outer row taken by the coding workspace. Loaded from
  // localStorage keyed by interview id so a refresh restores the layout.
  const [codingPct, setCodingPct] = useState(DSA_COL_DEFAULT_PCT);
  const [isDesktopWide, setIsDesktopWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= DSA_DESKTOP_MIN_PX : true,
  );
  const codingDragRef = useRef(false);
  const codingRowRef  = useRef(null);

  // ── Silence / thinking tracker ─────────────────────────────────────────
  // We track the user's idle time since the AI finished speaking. If a
  // threshold is crossed AND we're in WAITING phase, we fetch a nudge from
  // the backend.
  const silenceStartRef = useRef(null);  // ms timestamp when WAITING began (or last user activity)
  const lastNudgeAtRef  = useRef(0);     // ms since last nudge to avoid spam
  const prevNudgesRef   = useRef([]);    // nudges already issued for the current question
  const nudgeIntervalRef = useRef(null);

  const pushLog = useCallback((tag, msg, tone = '#9CA3AF') => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    setLogs(prev => [...prev.slice(-40), { id: ++logIdRef.current, t, tag, msg, tone }]);
  }, []);

  const speak = useCallback((text, onEnd) => {
    if (!voiceEnabled || !text) { onEnd?.(); return; }
    setAiSpeaking(true);
    ttsSpeak(text, {
      onStart: () => setAiSpeaking(true),
      onEnd: () => { setAiSpeaking(false); onEnd?.(); },
    });
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    cancelTTS();
    stopBrowserSpeaking();
    setAiSpeaking(false);
  }, [stopBrowserSpeaking]);

  const speaking = aiSpeaking || browserSpeaking;

  useEffect(() => {
    pushLog('SYSTEM', 'Loading session…', '#9CA3AF');
    const t0 = Date.now();
    interviewAPI.getById(id)
      .then(res => {
        setInterview(res.interview);
        setCurrentIdx(res.interview.currentQuestionIndex || 0);
        const greetingFromState = window.history.state?.usr?.greeting;
        if (greetingFromState) setGreeting(greetingFromState);
        const lat = Date.now() - t0;
        setLatency(lat);
        pushLog('SYSTEM', `Session ready · ${res.interview.questions?.length || 0} questions · ${lat}ms`, '#3FB950');
        if (greetingFromState) pushLog('MEMORY', 'Adaptive greeting loaded · weak topics matched', '#D29922');
        setPhase(PHASE.WAITING);
      })
      .catch(() => { toast.error('Failed to load interview'); navigate('/dashboard'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (phase === PHASE.USER_SPEAKING && !useTextInput) startMic();
    else stopMic();
  }, [phase, useTextInput, startMic, stopMic]);

  useEffect(() => () => { cancelTTS(); }, []);

  useEffect(() => {
    if (phase !== PHASE.AI_SPEAKING || !interview) return;
    const q = interview.questions[currentIdx];
    if (!q) return;
    pushLog('AI', `Speaking question ${currentIdx + 1} · ${q.questionType || 'technical'}`, '#58A6FF');

    // Build the spoken text with conversational layering:
    //   [reaction]   <pause>   [transition]   <pause>   [question]
    // For adaptive interviews, reaction/transition come from the backend.
    // For the first question we suppress the "Question N." preamble because the
    // greeting handled the lead-in.
    const parts = [];
    if (q.reaction)     parts.push(q.reaction);
    if (q.transition)   parts.push(q.transition);

    const isFirstQuestion = currentIdx === 0;
    if (interview.adaptive) {
      // Avoid "Question 1. ..." numbering for adaptive — feels less like a quiz
      parts.push(q.questionText);
    } else {
      parts.push(`Question ${currentIdx + 1}. ${q.questionText}`);
    }

    // Join with a punctuation pause that TTS engines naturally hold on
    const text = parts.filter(Boolean).join(' … ');

    if (voiceEnabled) {
      speak(text, () => setPhase(PHASE.WAITING));
    } else {
      setPhase(PHASE.WAITING);
    }
    return () => stopSpeaking();
  }, [phase, currentIdx, voiceEnabled]);

  useEffect(() => {
    if (phase === PHASE.USER_SPEAKING) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (phase !== PHASE.FEEDBACK) setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Silence / thinking nudge loop ──────────────────────────────────────
  // While in WAITING phase, poll every 4s. Compute idle time since the AI
  // finished speaking; if it crosses a threshold, fetch a backend nudge.
  // Only fires for adaptive interviews.
  useEffect(() => {
    if (!interview?.adaptive) return;
    if (phase !== PHASE.WAITING) {
      // Reset trackers when leaving WAITING — and when a new question starts
      if (phase === PHASE.AI_SPEAKING) {
        silenceStartRef.current = null;
        prevNudgesRef.current = [];
      }
      clearInterval(nudgeIntervalRef.current);
      return;
    }
    // Mark the moment WAITING began
    if (silenceStartRef.current == null) silenceStartRef.current = Date.now();

    nudgeIntervalRef.current = setInterval(async () => {
      // If the user is typing or transcript is filling, reset the idle timer
      if (textAnswer.length > 0 || (transcript && transcript.length > 0) || listening) {
        silenceStartRef.current = Date.now();
        return;
      }
      const silenceMs = Date.now() - silenceStartRef.current;
      if (silenceMs < 6000) return; // first tier is ~6s, don't bother below
      // Throttle nudge calls — at most once every ~10s
      if (Date.now() - lastNudgeAtRef.current < 10000) return;

      lastNudgeAtRef.current = Date.now();
      try {
        const res = await interviewAPI.nudge(id, {
          silenceMs,
          prevNudges: prevNudgesRef.current,
        });
        const nudge = res?.nudge;
        if (!nudge || !nudge.nudgeType) return;
        prevNudgesRef.current = [...prevNudgesRef.current, nudge.nudgeType];

        if (nudge.spoken && nudge.phrase) {
          pushLog('NUDGE', `${nudge.nudgeType}: "${nudge.phrase}"`, '#D29922');
          if (voiceEnabled) speak(nudge.phrase);
        } else if (nudge.nudgeType === 'silent') {
          // Silent tier — interviewer waits patiently; just log it
          pushLog('NUDGE', 'silent · waiting…', '#6B7280');
        }
      } catch {
        // Best-effort — silence-handling failures shouldn't break the interview
      }
    }, 4000);

    return () => clearInterval(nudgeIntervalRef.current);
    // We deliberately don't depend on textAnswer/transcript to avoid resetting
    // the interval; instead we read them inside the polling callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, interview?.adaptive]);

  const startQuestion = useCallback(() => {
    if (!interview?.questions[currentIdx]) return;
    resetTranscript();
    setTextAnswer('');
    setFeedback(null);
    setPhase(PHASE.AI_SPEAKING);
  }, [interview, currentIdx]);

  useEffect(() => {
    if (interview && phase === PHASE.WAITING && currentIdx === 0) {
      const begin = () => setTimeout(() => startQuestion(), 400);
      if (greeting && voiceEnabled) {
        speak(greeting, begin);
      } else {
        setTimeout(begin, 800);
      }
    }
  }, [interview, greeting]);

  const startRecording = () => {
    pushLog('VOICE', 'Microphone armed · listening', '#F85149');
    if (!useTextInput) {
      setPhase(PHASE.USER_SPEAKING);
      startListening(({ transcript: t, metrics }) => {
        setPendingMetrics(metrics);
        setTextAnswer(t);
        if (metrics?.fillerWordCount > 0) {
          pushLog('VOICE', `${metrics.fillerWordCount} filler word${metrics.fillerWordCount > 1 ? 's' : ''} · WPM ${metrics.wpm}`, '#D29922');
        }
        setPhase(PHASE.PROCESSING);
        submitAnswer(t, metrics);
      });
    } else {
      setPhase(PHASE.USER_SPEAKING);
    }
  };

  const stopRecording = () => {
    if (!useTextInput && listening) stopListening();
  };

  const submitAnswer = async (answer, metrics) => {
    setPhase(PHASE.PROCESSING);
    pushLog('AI', 'Evaluating answer…', '#58A6FF');
    const t0 = Date.now();
    try {
      const res = await interviewAPI.submitAnswer(id, currentIdx, {
        answer: answer || textAnswer,
        transcript: transcript || answer || textAnswer,
        voiceMetrics: metrics || pendingMetrics,
        skipped: false,
      });
      const lat = Date.now() - t0;
      setLatency(lat);
      pushLog('AI', `Score ${res.feedback?.score}/10 · ${lat}ms`, res.feedback?.score >= 7 ? '#3FB950' : '#D29922');
      setFeedback(res.feedback);
      setPhase(PHASE.FEEDBACK);
      // Update rolling session metrics
      if (metrics || pendingMetrics) {
        const m = metrics || pendingMetrics;
        setSessionMetrics(prev => {
          const answers = [...prev.answers, res.feedback?.score || 0];
          return {
            wpm: m.wpm || prev.wpm,
            fillerCount: (prev.fillerCount || 0) + (m.fillerWordCount || 0),
            confidence: m.confidenceScore || prev.confidence,
            answers,
          };
        });
      }
      if (voiceEnabled && res.feedback?.summary) {
        speak(`Score: ${res.feedback.score} out of 10. ${res.feedback.summary}`);
      }
    } catch {
      toast.error('Failed to evaluate answer');
      setPhase(PHASE.WAITING);
    }
  };

  const skipQuestion = async () => {
    try {
      await interviewAPI.submitAnswer(id, currentIdx, { answer: '', skipped: true });
      nextQuestion();
    } catch { nextQuestion(); }
  };

  const nextQuestion = async () => {
    stopSpeaking();
    if (!interview) return;

    // Adaptive mode: ask the backend for the next question (engine decides what)
    if (interview.adaptive) {
      setPhase(PHASE.PROCESSING);
      pushLog('AI', 'Selecting next question…', '#58A6FF');
      try {
        const res = await interviewAPI.nextQuestion(id);
        if (res.done || res.isComplete) {
          handleFinish();
          return;
        }
        const newQ = res.question;
        // Append the new question into local interview state and refresh liveState
        // (so toolbar flags like project-mode, pacing tempo stay up to date).
        setInterview(prev => ({
          ...prev,
          questions: [...prev.questions, newQ],
          liveState: { ...(prev.liveState || {}), ...(res.liveState || {}) },
        }));
        setCurrentIdx(newQ.index);
        setFeedback(null);
        resetTranscript();
        setTextAnswer('');
        setPendingMetrics(null);
        setRevealedHints([]);
        if (res.decision?.rationale) {
          const tag = res.decision.action === 'follow_up' ? 'FOLLOW-UP'
            : res.decision.action === 'revisit_weak' ? 'REVISIT'
            : res.decision.action === 'memorized_probe' ? 'PROBE'
            : 'PIVOT';
          pushLog(tag, res.decision.rationale, '#D29922');
        }
        if (res.liveState?.currentDifficulty) {
          const tempo = res.liveState.pacingTempo ? ` · ${res.liveState.pacingTempo} pace` : '';
          pushLog('ENGINE', `Difficulty: ${res.liveState.currentDifficulty} · avg ${res.liveState.rollingAvgScore}${tempo}`, '#9CA3AF');
        }
        if (res.liveState?.projectContext?.active && res.liveState.projectContext.coveredAxes?.length) {
          const axes = res.liveState.projectContext.coveredAxes.join(' → ');
          pushLog('PROJECT', `Deep-dive · ${axes}`, '#3FB950');
        }
        setPhase(PHASE.AI_SPEAKING);
      } catch (err) {
        toast.error('Failed to fetch next question');
        setPhase(PHASE.WAITING);
      }
      return;
    }

    // Legacy linear flow
    const nextIdx = currentIdx + 1;
    if (nextIdx >= interview.questions.length) { handleFinish(); return; }
    setCurrentIdx(nextIdx);
    setFeedback(null);
    resetTranscript();
    setTextAnswer('');
    setPendingMetrics(null);
    setRevealedHints([]);
    setPhase(PHASE.AI_SPEAKING);
  };

  // ── Sprint 7 Commit 3 — coding-column width lifecycle ──────────────
  // Load persisted width whenever the interview id becomes known; save
  // on change. Also track desktop vs stacked viewport for layout.
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(splitStorageKeyFor(id));
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= DSA_COL_MIN_PCT && n <= DSA_COL_MAX_PCT) {
        setCodingPct(n);
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    try { localStorage.setItem(splitStorageKeyFor(id), String(codingPct)); } catch { /* ignore */ }
  }, [id, codingPct]);

  useEffect(() => {
    const onResize = () => setIsDesktopWide(window.innerWidth >= DSA_DESKTOP_MIN_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Coding-column divider drag handlers.
  const onCodingPointerMove = useCallback((e) => {
    if (!codingDragRef.current || !codingRowRef.current) return;
    const rect = codingRowRef.current.getBoundingClientRect();
    // codingPct is measured from the RIGHT edge — dragging left grows it.
    const raw = ((rect.right - e.clientX) / rect.width) * 100;
    const clamped = Math.min(DSA_COL_MAX_PCT, Math.max(DSA_COL_MIN_PCT, raw));
    setCodingPct(clamped);
  }, []);
  const onCodingPointerUp = useCallback(() => {
    if (!codingDragRef.current) return;
    codingDragRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onCodingPointerMove);
    window.removeEventListener('pointerup', onCodingPointerUp);
  }, [onCodingPointerMove]);
  const startCodingDrag = (e) => {
    if (!isDesktopWide) return;
    e.preventDefault();
    codingDragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onCodingPointerMove);
    window.addEventListener('pointerup', onCodingPointerUp);
  };
  const onCodingDividerKey = (e) => {
    if (!isDesktopWide) return;
    const step = e.shiftKey ? 5 : 2;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCodingPct((p) => Math.min(DSA_COL_MAX_PCT, p + step)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setCodingPct((p) => Math.max(DSA_COL_MIN_PCT, p - step)); }
    else if (e.key === 'Home') { e.preventDefault(); setCodingPct(DSA_COL_MAX_PCT); }
    else if (e.key === 'End')  { e.preventDefault(); setCodingPct(DSA_COL_MIN_PCT); }
  };

  // Sprint 7 Commit 2 — request a progressive DSA hint for the current
  // question. Only meaningful when interview.mode === 'dsa' and
  // config.dsa.allowHints is on; the button is gated on both. The
  // returned hint is shown inline; up to 3 hints per question.
  const MAX_HINTS_UI = 3;
  const requestHint = async () => {
    if (requestingHint) return;
    if (revealedHints.length >= MAX_HINTS_UI) return;
    setRequestingHint(true);
    try {
      const res = await interviewAPI.requestHint(id);
      if (res?.hint) {
        setRevealedHints((prev) => [...prev, res.hint]);
        pushLog('HINT', `Hint #${res.hintsGiven || (revealedHints.length + 1)}: ${res.hint}`, '#D29922');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not fetch a hint.');
    } finally {
      setRequestingHint(false);
    }
  };

  const handleFinish = async () => {
    setPhase(PHASE.PROCESSING);
    // Sprint 7 Commit 5 — for DSA interviews, hand the final code
    // buffer to the backend so the Code Evaluation Engine can grade
    // exactly what the candidate ended with (not just what /submit last
    // saw). Read from localStorage BEFORE we clear it below.
    let sourceCode = '';
    if (interview?.mode === 'dsa') {
      try {
        const raw = localStorage.getItem(storageKeyFor(id));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.sourceCode === 'string') {
            sourceCode = parsed.sourceCode;
          }
        }
      } catch { /* ignore */ }
    }
    // Sprint 7 Commit 3 — clear the DSA coding workspace's localStorage
    // when the interview completes so a fresh interview on the same
    // machine starts with a clean editor. Safe to call for non-DSA
    // interviews (no-op when there's nothing under the key).
    clearCodingWorkspace(id);
    try {
      const res = await interviewAPI.complete(id, sourceCode ? { sourceCode } : {});
      // Sprint 4: server may include newly-unlocked badges on this response.
      // Toast them and merge into local user.badges so the Achievements
      // tab reflects the unlock without a page refresh.
      applyBadgeUnlocks(res?.unlockedBadges, {
        user,
        updateUser,
        onOpen: () => navigate('/profile?tab=achievements'),
      });
      navigate(`/interview/${id}/results`);
    } catch {
      toast.error('Failed to save results');
      navigate(`/interview/${id}/results`);
    }
  };

  const handleTextSubmit = () => {
    if (textAnswer.trim().length < 5) { toast.error('Write a more complete answer'); return; }
    submitAnswer(textAnswer, null);
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const phaseLabel = {
    [PHASE.LOADING]: 'Initializing',
    [PHASE.AI_SPEAKING]: 'AI Speaking',
    [PHASE.WAITING]: 'Your Turn',
    [PHASE.USER_SPEAKING]: 'Recording',
    [PHASE.PROCESSING]: 'Analyzing',
    [PHASE.FEEDBACK]: 'Feedback Ready',
  };

  if (phase === PHASE.LOADING || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#30363D', borderTopColor: '#58A6FF' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
          <span className="text-sm" style={{ color: '#6B7280' }}>Loading session…</span>
        </div>
      </div>
    );
  }

  const question = interview.questions[currentIdx];

  // For adaptive interviews, progress is measured against the BLUEPRINT's planned
  // count (number of primary questions), not the array length (which grows as
  // follow-ups are appended).
  const plannedCount = interview.adaptive
    ? (interview.blueprint?.totalPlanned || interview.config?.totalQuestions || 5)
    : interview.questions.length;
  const primaryAskedCount = interview.adaptive
    ? interview.questions.filter(q => !q.isFollowUp).length
    : currentIdx + 1;
  const progress = (Math.max(0, primaryAskedCount - 1) / plannedCount) * 100;
  // In adaptive mode we don't know if it's the "last" question — the engine decides.
  // We still flag the UI button so the user can finish manually if they want.
  const isLastQuestion = interview.adaptive
    ? primaryAskedCount >= plannedCount
    : currentIdx === interview.questions.length - 1;

  const avgScore = sessionMetrics.answers.length
    ? (sessionMetrics.answers.reduce((a, b) => a + b, 0) / sessionMetrics.answers.length).toFixed(1)
    : '—';

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0D1117' }}>

      {/* ── IDE Toolbar ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4"
        style={{
          height: 40,
          background: '#161B22',
          borderBottom: '1px solid #30363D',
          zIndex: 20,
        }}
      >
        {/* Left: session info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#F85149' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#D29922' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#3FB950' }} />
          </div>
          <div className="w-px h-4" style={{ background: '#30363D' }} />
          <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
            {interview.config?.role}
          </span>
          <span className="text-xs" style={{ color: '#30363D' }}>/</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {interview.config?.interviewType}
          </span>
          <span className="text-xs" style={{ color: '#30363D' }}>/</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {interview.adaptive
              ? (interview.liveState?.currentDifficulty || interview.config?.difficulty)
              : interview.config?.difficulty}
          </span>
          {interview.adaptive && interview.roundInfo && interview.roundInfo.id !== 'general' && (
            <>
              <span className="text-xs" style={{ color: '#30363D' }}>·</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(210,153,34,0.1)', color: '#D29922', border: '1px solid rgba(210,153,34,0.3)' }}
                title={interview.roundInfo.focus}
              >
                {interview.roundInfo.label}
              </span>
            </>
          )}
          {interview.adaptive && interview.personality?.label && (
            <>
              <span className="text-xs" style={{ color: '#30363D' }}>·</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(88,166,255,0.08)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.2)' }}
                title={interview.personality.style}
              >
                {interview.personality.label}
              </span>
            </>
          )}
          {interview.adaptive && interview.pressure && interview.pressure !== 'standard' && (
            <span
              className="text-2xs px-1.5 py-0.5 rounded font-mono"
              style={{
                background: interview.pressure === 'intense' ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)',
                color: interview.pressure === 'intense' ? '#F85149' : '#3FB950',
                border: `1px solid ${interview.pressure === 'intense' ? 'rgba(248,81,73,0.3)' : 'rgba(63,185,80,0.3)'}`,
              }}
            >
              {interview.pressure}
            </span>
          )}
          {interview.adaptive && interview.liveState?.projectContext?.active && (
            <span
              className="text-2xs px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'rgba(63,185,80,0.1)', color: '#3FB950', border: '1px solid rgba(63,185,80,0.3)' }}
              title="Project deep-dive in progress"
            >
              project
            </span>
          )}
          {interview.adaptive && question?.isFollowUp && (
            <>
              <span className="text-xs" style={{ color: '#30363D' }}>·</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(210,153,34,0.1)', color: '#D29922', border: '1px solid rgba(210,153,34,0.3)' }}
              >
                follow-up
              </span>
            </>
          )}
          {/* Sprint 7 Commit 2 — DSA header chips. Rendered only when
              interview.mode === 'dsa'. Shows the interview's root topic,
              language, and configured difficulty intent (easy/medium/hard/mixed). */}
          {interview.mode === 'dsa' && interview.config?.dsa && (
            <>
              <span className="text-xs" style={{ color: '#30363D' }}>·</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-mono uppercase"
                style={{ background: 'rgba(88,166,255,0.1)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.3)' }}
                title="DSA interview"
              >
                DSA
              </span>
              {interview.config.dsa.topic && (
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'rgba(88,166,255,0.06)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.2)' }}
                  title="Topic"
                >
                  {interview.config.dsa.topic}
                </span>
              )}
              {interview.config.dsa.language && (
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-mono uppercase"
                  style={{ background: 'rgba(139,92,246,0.08)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.25)' }}
                  title="Preferred language for discussion"
                >
                  {interview.config.dsa.language}
                </span>
              )}
            </>
          )}
        </div>

        {/* Center: progress */}
        <div className="flex items-center gap-2">
          <span className="metric text-xs" style={{ color: '#6B7280' }}>
            Q{primaryAskedCount}/{plannedCount}
          </span>
          <div className="w-24 h-1 rounded-full" style={{ background: '#21262D' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#58A6FF' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setVoiceEnabled(!voiceEnabled); stopSpeaking(); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
            style={{
              background: 'transparent',
              color: voiceEnabled ? '#9CA3AF' : '#484F58',
              border: '1px solid transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#21262D'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="hidden sm:inline">Voice</span>
          </button>
          <button
            onClick={() => setShowAvatar(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
            style={{ color: showAvatar ? '#9CA3AF' : '#484F58', border: '1px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = '#21262D'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Brain size={13} />
            <span className="hidden sm:inline">Avatar</span>
          </button>
          <div className="w-px h-4 mx-1" style={{ background: '#30363D' }} />
          <button
            onClick={() => {
              if (window.confirm('Abandon this interview?')) {
                interviewAPI.abandon(id).finally(() => navigate('/dashboard'));
              }
            }}
            className="px-2.5 py-1 rounded text-xs transition-colors"
            style={{ color: '#F85149', border: '1px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            End
          </button>
        </div>
      </div>

      {/* ── Three-Panel Workspace ─────────────────────────────────────────── */}
      <div ref={codingRowRef} className="flex flex-1 overflow-hidden">

        {/* LEFT: AI Interviewer Zone */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            width: 260,
            borderRight: '1px solid #30363D',
            background: '#0D1117',
          }}
        >
          {/* Avatar */}
          <div
            className="flex-shrink-0 flex items-center justify-center relative"
            style={{
              height: 200,
              borderBottom: '1px solid #21262D',
              background: '#010409',
            }}
          >
            {showAvatar ? (
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full" style={{ background: '#161B22', border: '2px solid #30363D' }} />
                </div>
              }>
                <TalkingAvatar
                  isSpeaking={speaking}
                  isListening={listening}
                  amplitude={speaking ? (0.35 + Math.sin(Date.now() / 180) * 0.25) : amplitude}
                  emotion={speaking ? 'happy' : listening ? 'thinking' : 'neutral'}
                />
              </Suspense>
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#161B22', border: '1px solid #30363D' }}
              >
                <Brain size={24} style={{ color: '#58A6FF' }} />
              </div>
            )}
            {/* Speaking indicator */}
            {speaking && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: '0 0 30px rgba(88,166,255,0.12)' }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>

          {/* AI State Panel */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* State */}
            <div>
              <div className="label mb-2">State</div>
              <div className="flex items-center gap-2">
                <StatusDot
                  active={speaking || phase === PHASE.PROCESSING}
                  color={speaking ? '#58A6FF' : phase === PHASE.PROCESSING ? '#D29922' : '#3FB950'}
                />
                <span className="text-xs font-medium" style={{ color: '#F0F6FC' }}>
                  {phaseLabel[phase]}
                </span>
              </div>
              {speaking && (
                <div className="mt-2 flex items-center gap-1.5">
                  <VoiceBar active={speaking} color="#58A6FF" />
                  <span className="text-2xs" style={{ color: '#58A6FF' }}>speaking</span>
                </div>
              )}
              {listening && (
                <div className="mt-2 flex items-center gap-1.5">
                  <VoiceBar active={listening} color="#F85149" />
                  <span className="text-2xs" style={{ color: '#F85149' }}>listening</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#21262D' }} />

            {/* Question info */}
            {question && (
              <div>
                <div className="label mb-1.5">Current Question</div>
                <div
                  className="metric text-2xs px-2 py-1 rounded mb-1.5"
                  style={{ background: 'rgba(88,166,255,0.08)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.2)' }}
                >
                  {question.questionType?.replace('_', ' ') || 'technical'}
                </div>
                {question.topic && (
                  <div className="text-2xs" style={{ color: '#6B7280' }}>Topic: {question.topic}</div>
                )}
              </div>
            )}

            {/* Timer */}
            {phase === PHASE.USER_SPEAKING && (
              <>
                <div style={{ height: 1, background: '#21262D' }} />
                <div>
                  <div className="label mb-1.5">Response Time</div>
                  <div className="metric text-xl font-bold" style={{ color: timer > 120 ? '#F85149' : '#F0F6FC' }}>
                    {formatTime(timer)}
                  </div>
                </div>
              </>
            )}

            {/* Latency */}
            {latency != null && (
              <>
                <div style={{ height: 1, background: '#21262D' }} />
                <div>
                  <div className="label mb-1">Latency</div>
                  <div className="metric text-xs font-bold" style={{ color: latency < 500 ? '#3FB950' : latency < 1500 ? '#D29922' : '#F85149' }}>
                    {latency}ms
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── System log feed ─────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex flex-col"
            style={{ borderTop: '1px solid #21262D', maxHeight: 180 }}
          >
            <div
              className="flex items-center justify-between px-3 py-1.5"
              style={{ background: '#161B22', borderBottom: '1px solid #21262D' }}
            >
              <div className="flex items-center gap-1.5">
                <TerminalSquare size={10} style={{ color: '#6B7280' }} />
                <span className="font-mono uppercase tracking-wide" style={{ color: '#9CA3AF', fontSize: 9 }}>
                  system log
                </span>
              </div>
              <span className="flex items-center gap-1 font-mono" style={{ color: '#3FB950', fontSize: 9 }}>
                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                live
              </span>
            </div>
            <div
              ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
              className="flex-1 overflow-y-auto px-2 py-1.5 font-mono space-y-0.5"
              style={{ background: '#010409', fontSize: 9.5, lineHeight: 1.5 }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#484F58' }}>// waiting for events…</div>
              ) : logs.slice(-30).map(l => (
                <div key={l.id} className="flex gap-1.5">
                  <span style={{ color: '#484F58' }}>{l.t}</span>
                  <span style={{ color: l.tone, width: 44, flexShrink: 0 }}>{l.tag}</span>
                  <span style={{ color: '#9CA3AF', wordBreak: 'break-word' }}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>

          {/* Question Area */}
          <div
            className="flex-shrink-0 overflow-y-auto p-5"
            style={{ borderBottom: '1px solid #30363D', maxHeight: '45%' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span
                    className="metric text-2xs px-2 py-0.5 rounded"
                    style={{ background: '#21262D', color: '#9CA3AF', border: '1px solid #30363D' }}
                  >
                    Q{primaryAskedCount} of {plannedCount}
                  </span>
                  {question?.isFollowUp && (
                    <span
                      className="text-2xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(210,153,34,0.1)', color: '#D29922', border: '1px solid rgba(210,153,34,0.3)' }}
                    >
                      follow-up
                    </span>
                  )}
                  {question?.selectionReason === 'revisit_weak' && (
                    <span
                      className="text-2xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(248,81,73,0.1)', color: '#F85149', border: '1px solid rgba(248,81,73,0.3)' }}
                    >
                      revisit
                    </span>
                  )}
                  {question?.selectionReason === 'memorized_probe' && (
                    <span
                      className="text-2xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(248,81,73,0.1)', color: '#F85149', border: '1px solid rgba(248,81,73,0.3)' }}
                    >
                      depth probe
                    </span>
                  )}
                  {question?.topic && (
                    <span
                      className="text-2xs px-2 py-0.5 rounded font-mono"
                      style={{ background: 'rgba(63,185,80,0.06)', color: '#3FB950', border: '1px solid rgba(63,185,80,0.2)' }}
                    >
                      {question.topic}
                    </span>
                  )}
                  {question?.questionType && (
                    <span
                      className="text-2xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(88,166,255,0.08)', color: '#58A6FF', border: '1px solid rgba(88,166,255,0.2)' }}
                    >
                      {question.questionType.replace('_', ' ')}
                    </span>
                  )}
                  {speaking && (
                    <span className="flex items-center gap-1 text-2xs" style={{ color: '#58A6FF' }}>
                      <VoiceBar active color="#58A6FF" />
                    </span>
                  )}
                </div>

                {/* Conversational lead-in: reaction + transition.
                    Shown as italic muted text above the question to mimic the
                    spoken layering of a real interviewer. */}
                {(question?.reaction || question?.transition) && (
                  <p
                    className="text-sm italic mb-2"
                    style={{ color: '#9CA3AF', lineHeight: 1.5 }}
                  >
                    {question.reaction && <span>{question.reaction} </span>}
                    {question.transition && <span style={{ color: '#6B7280' }}>{question.transition}</span>}
                  </p>
                )}

                <p className="text-base font-medium leading-relaxed" style={{ color: '#F0F6FC', lineHeight: 1.65 }}>
                  {question?.questionText}
                </p>
                {/* Pre-generated hints from the LLM appear only for
                    non-DSA modes. DSA hints are always progressive and
                    surfaced only when the candidate clicks Request Hint. */}
                {interview.mode !== 'dsa' && question?.hints?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {question.hints.map((h, i) => (
                      <span key={i} className="text-2xs px-2 py-0.5 rounded"
                        style={{ background: '#161B22', color: '#6B7280', border: '1px solid #30363D' }}>
                        {h}
                      </span>
                    ))}
                  </div>
                )}
                {/* DSA progressive hints — only what the user has
                    revealed for this question. Cleared on next question. */}
                {interview.mode === 'dsa' && revealedHints.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-3">
                    {revealedHints.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded"
                        style={{ background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.25)' }}
                      >
                        <span className="font-mono text-2xs mt-0.5" style={{ color: '#D29922' }}>
                          hint #{i + 1}
                        </span>
                        <span className="text-xs" style={{ color: '#F0F6FC', lineHeight: 1.5 }}>
                          {h}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Answer / Interaction Area */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">

              {phase === PHASE.WAITING && (
                <motion.div key="waiting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    Your turn. Answer verbally or type your response.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {srSupported && (
                      <button
                        className="btn-accent flex items-center gap-2 px-5 py-2.5"
                        onClick={startRecording}
                      >
                        <Mic size={15} /> Speak Answer
                      </button>
                    )}
                    <button
                      className="btn-secondary flex items-center gap-2 px-4 py-2.5"
                      onClick={() => { setUseTextInput(true); setPhase(PHASE.USER_SPEAKING); }}
                    >
                      <MessageSquare size={14} /> Type Answer
                    </button>
                    <button
                      onClick={() => {
                        if (voiceEnabled && question) {
                          pushLog('AI', `Repeating question ${currentIdx + 1}`, '#58A6FF');
                          speak(`Question ${currentIdx + 1}. ${question.questionText}`);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded transition-colors"
                      style={{ color: '#6B7280', border: '1px solid #30363D', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#161B22'; e.currentTarget.style.color = '#9CA3AF'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; }}
                      title="Repeat the question aloud"
                    >
                      <Volume2 size={13} /> Repeat
                    </button>
                    <button
                      onClick={skipQuestion}
                      className="text-xs px-3 py-2.5 rounded transition-colors"
                      style={{ color: '#6B7280' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                    >
                      <SkipForward size={13} className="inline mr-1" />
                      Skip
                    </button>
                    {/* Sprint 7 Commit 2 — DSA-only Request Hint button.
                        Hidden for non-DSA modes; disabled when hints are
                        turned off in config or the per-question cap is
                        reached. Progressive: hint 1 nudges direction,
                        hint 2 names the approach, hint 3 the trick. */}
                    {interview.mode === 'dsa' && (
                      <button
                        onClick={requestHint}
                        disabled={
                          !interview.config?.dsa?.allowHints
                          || requestingHint
                          || revealedHints.length >= MAX_HINTS_UI
                        }
                        className="text-xs px-3 py-2.5 rounded transition-colors flex items-center gap-1.5"
                        style={{
                          color: interview.config?.dsa?.allowHints ? '#D29922' : '#484F58',
                          border: '1px solid transparent',
                          background: 'transparent',
                          cursor: interview.config?.dsa?.allowHints ? 'pointer' : 'not-allowed',
                          opacity: revealedHints.length >= MAX_HINTS_UI ? 0.5 : 1,
                        }}
                        title={
                          !interview.config?.dsa?.allowHints
                            ? 'Hints are disabled for this interview.'
                            : revealedHints.length >= MAX_HINTS_UI
                              ? `Max ${MAX_HINTS_UI} hints per question.`
                              : `Request the next progressive hint (${revealedHints.length}/${MAX_HINTS_UI})`
                        }
                        aria-label="Request hint"
                        onMouseEnter={e => {
                          if (interview.config?.dsa?.allowHints && revealedHints.length < MAX_HINTS_UI) {
                            e.currentTarget.style.background = 'rgba(210,153,34,0.08)';
                          }
                        }}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Lightbulb size={13} />
                        {requestingHint
                          ? 'Thinking…'
                          : revealedHints.length > 0
                            ? `Hint (${revealedHints.length}/${MAX_HINTS_UI})`
                            : 'Request Hint'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {phase === PHASE.USER_SPEAKING && !useTextInput && (
                <motion.div key="speaking"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="recording-indicator">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#F85149' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#F85149' }}>Recording</span>
                    <span className="metric text-sm" style={{ color: '#9CA3AF' }}>{formatTime(timer)}</span>
                    <VoiceBar active={listening} color="#F85149" />
                  </div>

                  {transcript && (
                    <div
                      className="rounded p-3 font-mono text-sm leading-relaxed max-h-40 overflow-y-auto"
                      style={{ background: '#010409', border: '1px solid #21262D', color: '#9CA3AF' }}
                    >
                      <div className="text-2xs mb-2 font-sans uppercase tracking-wide" style={{ color: '#484F58' }}>
                        Live Transcript
                      </div>
                      {transcript}
                      <span className="animate-blink" style={{ color: '#58A6FF' }}>▌</span>
                    </div>
                  )}

                  <button
                    className="btn-danger flex items-center gap-2 w-fit px-5 py-2.5"
                    onClick={stopRecording}
                  >
                    <Square size={13} fill="currentColor" /> Stop & Submit
                  </button>
                </motion.div>
              )}

              {phase === PHASE.USER_SPEAKING && useTextInput && (
                <motion.div key="text-input"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  <div className="text-xs" style={{ color: '#6B7280' }}>Write your answer below</div>
                  <textarea
                    className="input-field resize-none font-mono text-sm leading-relaxed"
                    style={{ height: 180, background: '#010409', fontFamily: 'inherit' }}
                    placeholder="// Your answer here..."
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-4 py-2"
                      onClick={() => { setUseTextInput(false); setPhase(PHASE.WAITING); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-accent flex items-center gap-2 px-5 py-2"
                      onClick={handleTextSubmit}
                    >
                      <CheckCircle size={14} /> Submit Answer
                    </button>
                  </div>
                </motion.div>
              )}

              {phase === PHASE.PROCESSING && (
                <motion.div key="processing"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 py-2"
                >
                  <motion.div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: '#30363D', borderTopColor: '#58A6FF' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F0F6FC' }}>Analyzing response…</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      Evaluating technical accuracy, communication, confidence
                    </p>
                  </div>
                </motion.div>
              )}

              {phase === PHASE.FEEDBACK && feedback && (
                <motion.div key="feedback"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Score header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={15} style={{ color: '#58A6FF' }} />
                      <span className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>AI Feedback</span>
                    </div>
                    <ScorePill score={feedback.score} />
                  </div>

                  {/* Summary */}
                  {feedback.summary && (
                    <p
                      className="text-sm leading-relaxed p-3 rounded"
                      style={{ background: '#161B22', border: '1px solid #30363D', color: '#9CA3AF' }}
                    >
                      {feedback.summary}
                    </p>
                  )}

                  {/* Score breakdown */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { label: 'Technical', value: feedback.technicalScore, max: 10 },
                      { label: 'Communication', value: feedback.communicationScore, max: 10 },
                      { label: 'Completeness', value: feedback.completenessScore, max: 10 },
                      { label: 'Grammar', value: feedback.grammarScore, max: 10 },
                    ].map(item => (
                      <MiniBar key={item.label} label={item.label} value={item.value} max={item.max} />
                    ))}
                  </div>

                  {/* Strengths & weaknesses */}
                  {(feedback.strengths?.length > 0 || feedback.weaknesses?.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {feedback.strengths?.length > 0 && (
                        <div
                          className="rounded p-3"
                          style={{ background: 'rgba(63,185,80,0.05)', border: '1px solid rgba(63,185,80,0.2)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle size={12} style={{ color: '#3FB950' }} />
                            <span className="text-2xs font-semibold uppercase tracking-wide" style={{ color: '#3FB950' }}>
                              Strengths
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {feedback.strengths.map((s, i) => (
                              <li key={i} className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                                · {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {feedback.weaknesses?.length > 0 && (
                        <div
                          className="rounded p-3"
                          style={{ background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.2)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertCircle size={12} style={{ color: '#F85149' }} />
                            <span className="text-2xs font-semibold uppercase tracking-wide" style={{ color: '#F85149' }}>
                              Improve
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {feedback.weaknesses.map((w, i) => (
                              <li key={i} className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                                · {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model answer */}
                  {feedback.betterAnswer && (
                    <div
                      className="rounded p-3"
                      style={{ background: 'rgba(88,166,255,0.05)', border: '1px solid rgba(88,166,255,0.2)' }}
                    >
                      <div className="text-2xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#58A6FF' }}>
                        Model Answer
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                        {feedback.betterAnswer}
                      </p>
                    </div>
                  )}

                  <button
                    className="btn-accent w-full flex items-center justify-center gap-2 py-2.5"
                    onClick={nextQuestion}
                  >
                    {isLastQuestion ? (
                      <><CheckCircle size={14} /> Finish Interview</>
                    ) : (
                      <>Next Question <ChevronRight size={14} /></>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── DSA Coding Workspace column (Sprint 7 Commit 3) ────────
            Only rendered when the interview is a DSA interview. On
            desktop we place it BETWEEN the CENTER conversation and the
            RIGHT analytics panel with a draggable divider. On tablet/
            mobile the outer flex row wraps and this column stacks under
            CENTER at intrinsic height (the analytics panel is hidden by
            the layout below on narrow screens via existing CSS). */}
        {interview.mode === 'dsa' && (
          <>
            {isDesktopWide && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={Math.round(codingPct)}
                aria-valuemin={DSA_COL_MIN_PCT}
                aria-valuemax={DSA_COL_MAX_PCT}
                aria-label="Resize conversation and coding panels"
                tabIndex={0}
                onPointerDown={startCodingDrag}
                onKeyDown={onCodingDividerKey}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 6,
                  cursor: 'col-resize',
                  background: '#161B22',
                  borderLeft: '1px solid #30363D',
                  borderRight: '1px solid #30363D',
                  outline: 'none',
                }}
                title="Drag to resize"
              />
            )}
            <div
              className="flex-shrink-0 min-h-0"
              style={{
                flexBasis: isDesktopWide ? `${codingPct}%` : '100%',
                width: isDesktopWide ? undefined : '100%',
                minWidth: 0,
              }}
              aria-label="Coding workspace column"
            >
              <Suspense
                fallback={
                  <div
                    className="flex items-center justify-center h-full w-full"
                    style={{ background: '#1E1E1E', color: '#6B7280' }}
                  >
                    <span className="font-mono text-2xs">loading editor…</span>
                  </div>
                }
              >
                <CodingWorkspace
                  interviewId={id}
                  initialLanguage={interview.config?.dsa?.language || 'cpp'}
                  topic={interview.config?.dsa?.topic || ''}
                  theme="vs-dark"
                />
              </Suspense>
            </div>
          </>
        )}

        {/* RIGHT: Live Analytics Panel */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: 200,
            borderLeft: '1px solid #30363D',
            background: '#0D1117',
          }}
        >
          <div className="p-3 space-y-4">

            {/* Panel title */}
            <div className="flex items-center gap-1.5">
              <Activity size={12} style={{ color: '#6B7280' }} />
              <span className="label">Live Metrics</span>
            </div>

            {/* Session score avg */}
            <div>
              <div className="label mb-1">Session Avg</div>
              <div className="metric text-2xl font-bold" style={{ color: '#F0F6FC' }}>
                {avgScore}
                {avgScore !== '—' && <span className="text-sm font-normal ml-0.5" style={{ color: '#6B7280' }}>/10</span>}
              </div>
              <div className="text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                {sessionMetrics.answers.length} answer{sessionMetrics.answers.length !== 1 ? 's' : ''} scored
              </div>
            </div>

            <div style={{ height: 1, background: '#21262D' }} />

            {/* WPM */}
            <div>
              <div className="label mb-1">Speaking Speed</div>
              <div className="metric text-lg font-bold" style={{ color: sessionMetrics.wpm > 180 ? '#F85149' : sessionMetrics.wpm > 0 ? '#3FB950' : '#484F58' }}>
                {sessionMetrics.wpm || '—'}
                {sessionMetrics.wpm > 0 && <span className="text-xs font-normal ml-1" style={{ color: '#6B7280' }}>wpm</span>}
              </div>
              <div className="text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                {sessionMetrics.wpm > 180 ? 'Too fast' : sessionMetrics.wpm > 120 ? 'Ideal pace' : sessionMetrics.wpm > 0 ? 'Too slow' : 'Awaiting data'}
              </div>
            </div>

            <div style={{ height: 1, background: '#21262D' }} />

            {/* Filler words */}
            <div>
              <div className="label mb-1">Filler Words</div>
              <div className="metric text-lg font-bold" style={{ color: sessionMetrics.fillerCount > 5 ? '#F85149' : sessionMetrics.fillerCount > 0 ? '#D29922' : '#484F58' }}>
                {sessionMetrics.fillerCount || '0'}
              </div>
              <div className="text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                um, uh, like, basically…
              </div>
            </div>

            <div style={{ height: 1, background: '#21262D' }} />

            {/* Confidence */}
            <div>
              <div className="label mb-1">Confidence</div>
              <div className="metric text-lg font-bold" style={{ color: sessionMetrics.confidence > 70 ? '#3FB950' : sessionMetrics.confidence > 0 ? '#D29922' : '#484F58' }}>
                {sessionMetrics.confidence || '—'}
                {sessionMetrics.confidence > 0 && <span className="text-xs font-normal ml-0.5">%</span>}
              </div>
            </div>

            <div style={{ height: 1, background: '#21262D' }} />

            {/* Per-question scores */}
            {sessionMetrics.answers.length > 0 && (
              <div>
                <div className="label mb-2">Scores</div>
                <div className="space-y-1.5">
                  {sessionMetrics.answers.map((score, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="metric text-2xs w-6" style={{ color: '#6B7280' }}>Q{i + 1}</span>
                      <div className="flex-1 h-1 rounded-full" style={{ background: '#21262D' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(score / 10) * 100}%`,
                            background: score >= 8 ? '#3FB950' : score >= 6 ? '#D29922' : '#F85149',
                          }}
                        />
                      </div>
                      <span className="metric text-2xs w-6 text-right" style={{ color: '#9CA3AF' }}>{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VS Code Status Bar ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 select-none"
        style={{
          height: 22,
          background: '#1F6FEB',
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 500,
        }}
      >
        <div className="flex items-center">
          <div className="status-bar-item gap-1">
            <Circle size={8} fill={listening ? '#F85149' : 'transparent'} stroke="currentColor" />
            {listening ? 'Recording' : 'Mic Off'}
          </div>
          <div className="status-bar-item">
            {phase === PHASE.PROCESSING ? (
              <span style={{ color: '#D29922' }}>⟳ Analyzing…</span>
            ) : (
              phaseLabel[phase]
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div className="status-bar-item">
            <Wifi size={10} />
            Connected
          </div>
          <div className="status-bar-item">
            {interview.config?.targetCompany || interview.config?.companyType}
          </div>
          <div className="status-bar-item metric">
            Q{primaryAskedCount}/{plannedCount}
          </div>
        </div>
      </div>

    </div>
  );
};

export default InterviewPage;
