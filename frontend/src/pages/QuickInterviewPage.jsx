import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, ArrowLeft, FileText, GitBranch, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import PromptSuggestionChips from '../components/interview/PromptSuggestionChips';
import { useAuth } from '../context/AuthContext';
import { projectsAPI, interviewAPI } from '../services/api';

/**
 * QuickInterviewPage — the "describe your interview in words" surface.
 *
 * Sprint 5 Commit 3: real UI, no backend. Collects three fields:
 *   • prompt      (freeform text)
 *   • useResume   (boolean, disabled when user has no resume)
 *   • useProjects (boolean, disabled when user has no analyzed projects)
 *
 * Commit 4 will POST these to a new endpoint that runs the prompt through
 * the LLM, extracts a structured InterviewBlueprint (Sprint 5 Commit 1),
 * and launches the interview. Today: validate the prompt and toast.
 *
 * Router state (from SetupMethodPage):
 *   { sourceType, initialConfig: { useResume? } }
 * When present, we honor the initial toggle positions. When absent (e.g.
 * direct nav from ⌘K or a bookmarked URL), we default to off.
 */

const MIN_PROMPT_CHARS = 15;

const SUGGESTIONS = [
  { label: 'Amazon SDE',       prompt: 'I have an Amazon SDE-1 interview. Focus on DSA, OS and DBMS at medium difficulty for about 30 minutes.' },
  { label: 'Backend Node.js',  prompt: "I'm interviewing for a Backend Intern role. Focus on Node.js, Express, MongoDB and JWT. Keep it conversational." },
  { label: 'Frontend React',   prompt: 'Frontend interview with a focus on React performance, hooks, and accessibility. Medium difficulty, follow-ups on tradeoffs.' },
  { label: 'Campus Placement', prompt: 'Campus placement round for a fresher. Mix of DSA, DBMS and aptitude. Easy to medium difficulty, encouraging tone.' },
  { label: 'Google L3',        prompt: 'Strict Google-style L3 interview focused on Graphs and Dynamic Programming. Hard difficulty, terse feedback.' },
  { label: 'Behavioral',       prompt: 'Behavioral round using STAR method for a senior engineer. Ask about leadership, conflict resolution, and impact.' },
  { label: 'System Design',    prompt: 'System design interview for scaling a chat app to 10M users. Cover data model, sharding, and hot-key mitigation.' },
  { label: 'DSA Practice',     prompt: 'DSA practice session. Mix of arrays, trees, and dynamic programming. Medium difficulty, ask follow-ups on complexity.' },
];

const PLACEHOLDER_EXAMPLES = [
  "I'm preparing for Amazon SDE-1. Focus on DSA, OS and DBMS. Medium difficulty. Around 30 minutes.",
  "I'm interviewing for a Backend Intern role. Focus on Node.js, Express, MongoDB and JWT. Be conversational.",
  'I want a strict Google-style interview focused on Graphs and Dynamic Programming.',
];

const QuickInterviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Toggle initial values from router state (SetupMethodPage → Quick).
  // Falsy when the page is opened directly.
  const initialUseResume  = !!location.state?.initialConfig?.useResume;
  const initialUseProject = !!location.state?.initialConfig?.useProject;

  const [text, setText] = useState('');
  const [useResume, setUseResume] = useState(initialUseResume);
  const [useProjects, setUseProjects] = useState(initialUseProject);
  const [generating, setGenerating] = useState(false);

  const [projects, setProjects] = useState(null); // null while loading

  // Rotating placeholder — cycles through the examples every 5s. Purely
  // decorative; if the user has already typed anything the placeholder is
  // moot because the textarea shows the text.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length),
      5000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    projectsAPI.list()
      .then((res) => { if (alive) setProjects(res.projects || []); })
      .catch(() => { if (alive) setProjects([]); });
    return () => { alive = false; };
  }, []);

  const hasResume = !!user?.resumeUrl;
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  // Auto-disable a toggle whose data source is unavailable.
  useEffect(() => { if (!hasResume && useResume) setUseResume(false); }, [hasResume, useResume]);
  useEffect(() => { if (!hasProjects && useProjects) setUseProjects(false); }, [hasProjects, useProjects]);

  const charCount = text.trim().length;
  const isValid = charCount >= MIN_PROMPT_CHARS;

  const handleGenerate = async () => {
    if (generating) return;
    if (!text.trim()) {
      toast.error('Describe the interview you want first.');
      return;
    }
    if (!isValid) {
      toast.error('Please describe your interview in a little more detail.');
      return;
    }

    // Sprint 5 Commit 4: POST the prompt + toggles to the parser endpoint.
    // The parser returns { draft, confidence, unknown }. We navigate to
    // the Review page with that state — the Review page owns the last
    // mile of interview creation via the EXISTING createInterview API.
    setGenerating(true);
    try {
      const res = await interviewAPI.parse({
        prompt: text.trim(),
        useResume,
        useProjects,
      });
      navigate('/interviews/review', {
        state: {
          draft:        res.draft,
          confidence:   res.confidence,
          reasons:      res.reasons || {},  // Sprint 5 Commit 6 — per-field explanations
          unknown:      res.unknown || [],
          sourcePrompt: text.trim(),        // → origin: 'quick_ai' on Review page
        },
      });
    } catch (err) {
      toast.error(err?.message || 'Unable to understand interview request.');
      setGenerating(false);
    }
  };

  const handleSuggestion = (prompt) => setText(prompt);

  const placeholder = useMemo(
    () => PLACEHOLDER_EXAMPLES[placeholderIdx],
    [placeholderIdx],
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          <SectionHeader
            eyebrow="interviews · quick"
            title="Describe your interview"
            subtitle="Tell us what you want to practice in plain English. The AI will design a session around it."
            action={
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Back
              </button>
            }
          />

          {/* Prompt card */}
          <div
            className="p-4 mb-3"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
          >
            <label
              className="block font-mono text-2xs uppercase tracking-wide mb-2"
              style={{ color: '#6B7280' }}
            >
              Your prompt
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={placeholder}
              className="input-field"
              style={{ resize: 'vertical', minHeight: 140, lineHeight: 1.5 }}
              autoFocus
            />

            {/* Char counter + validation hint */}
            <div className="flex items-center justify-between mt-2">
              <span
                className="font-mono text-2xs"
                style={{
                  color: charCount === 0
                    ? '#484F58'
                    : isValid
                      ? '#3FB950'
                      : '#D29922',
                }}
              >
                {charCount} / {MIN_PROMPT_CHARS} min
              </span>
              {charCount > 0 && !isValid && (
                <span className="font-mono text-2xs" style={{ color: '#D29922' }}>
                  a little more detail helps the AI
                </span>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="mb-3">
            <div
              className="font-mono text-2xs uppercase tracking-wide mb-2"
              style={{ color: '#6B7280' }}
            >
              Try one of these
            </div>
            <PromptSuggestionChips
              suggestions={SUGGESTIONS}
              onSelect={handleSuggestion}
            />
          </div>

          {/* Toggles */}
          <div
            className="p-4 mb-3 flex flex-col gap-3"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
          >
            <ToggleRow
              icon={FileText}
              label="Use Resume"
              description={hasResume
                ? 'Ground questions in your uploaded resume.'
                : 'No resume uploaded.'}
              checked={useResume}
              disabled={!hasResume}
              onChange={setUseResume}
              actionLabel={hasResume ? null : 'Upload'}
              onAction={hasResume ? undefined : () => navigate('/profile?tab=resume')}
            />
            <ToggleRow
              icon={GitBranch}
              label="Use GitHub Projects"
              description={hasProjects
                ? `${projects.length} analyzed project${projects.length === 1 ? '' : 's'} available.`
                : 'No analyzed projects found.'}
              checked={useProjects}
              disabled={!hasProjects}
              onChange={setUseProjects}
              actionLabel={hasProjects ? null : 'Import'}
              onAction={hasProjects ? undefined : () => navigate('/projects/new')}
            />
          </div>

          {/* Generate */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {generating ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Parsing…
                </>
              ) : (
                <>
                  <Sparkles size={11} /> Generate Interview
                </>
              )}
            </button>
          </div>

          <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
            {'// AI parses your prompt into a draft you can review before starting'}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * ToggleRow — inline row used for the Use Resume / Use Projects toggles.
 * Local to this page: single visual pattern, single consumer. Promoting
 * would be premature.
 */
const ToggleRow = ({
  icon: Icon, label, description, checked, disabled, onChange, actionLabel, onAction,
}) => (
  <div className="flex items-center gap-3">
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
      {Icon && <Icon size={13} style={{ color: disabled ? '#484F58' : '#58A6FF' }} />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium" style={{ color: disabled ? '#9CA3AF' : '#F0F6FC' }}>
        {label}
      </div>
      <div className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
        {description}
      </div>
    </div>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="btn-secondary text-xs px-2.5 py-1"
      >
        {actionLabel}
      </button>
    )}
    {/* Simple styled checkbox — matches the app's dark aesthetic without
        pulling in a component library. */}
    <label
      className="flex items-center cursor-pointer"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <span
        className="flex items-center justify-center transition-colors"
        style={{
          width: 32,
          height: 18,
          borderRadius: 999,
          background: checked ? '#1F6FEB' : '#21262D',
          border: `1px solid ${checked ? '#1F6FEB' : '#30363D'}`,
          position: 'relative',
        }}
      >
        <span
          className="transition-transform"
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: '#F0F6FC',
            position: 'absolute',
            left: 2,
            transform: `translateX(${checked ? 14 : 0}px)`,
          }}
        />
        {checked && (
          <CheckCircle
            size={9}
            style={{
              color: '#fff',
              position: 'absolute',
              right: 4,
              opacity: 0.9,
              pointerEvents: 'none',
            }}
          />
        )}
      </span>
    </label>
  </div>
);

export default QuickInterviewPage;
