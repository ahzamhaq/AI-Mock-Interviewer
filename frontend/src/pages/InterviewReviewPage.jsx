import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, AlertTriangle, Sparkles, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import ReviewField from '../components/interview/ReviewField';
import InterviewOriginCard from '../components/interview/InterviewOriginCard';
import InterviewSummaryCard from '../components/interview/InterviewSummaryCard';
import SavePresetModal from '../components/interview/SavePresetModal';
import { interviewAPI, presetsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { applyBadgeUnlocks } from '../services/badgeUnlocks';
import DSAConfigurationCard from '../components/interview/DSAConfigurationCard';
import { DSA_QUESTION_COUNT } from '../data/dsaConstants';

/**
 * InterviewReviewPage — the human-in-the-loop review screen.
 *
 * Sprint 5 Commit 4: sits between the parser (POST /interviews/parse) and
 * the actual interview creation (POST /interviews). The parser hands us a
 * Draft; this page shows every field editable, flags low-confidence and
 * unknown fields, and only calls the existing createInterview endpoint
 * when the user presses Start Interview.
 *
 * The Draft shape is NOT the wizard payload — see toWizardPayload() below
 * for the mapping. This keeps the LLM output insulated from the wizard's
 * schema.
 *
 * Router state:
 *   { draft, confidence, unknown, sourcePrompt }
 * Missing state = user landed here directly. Falls back to a graceful
 * empty state that points back to the Quick page.
 */

// ── Option lists (mirror the parser's enums) ─────────────────────────────────

const ROLE_OPTS = [
  { value: 'frontend_developer',  label: 'Frontend Developer' },
  { value: 'backend_developer',   label: 'Backend Developer' },
  { value: 'fullstack_developer', label: 'Full Stack' },
  { value: 'sde',                 label: 'SDE' },
  { value: 'data_analyst',        label: 'Data Analyst' },
  { value: 'hr',                  label: 'HR' },
  { value: 'other',               label: 'Other' },
];
const EXPERIENCE_OPTS = [
  { value: 'fresher',   label: 'Fresher (0–1 yr)' },
  { value: '1-2_years', label: '1–2 years' },
  { value: '3+_years',  label: '3+ years' },
];
const INTERVIEW_TYPE_OPTS = [
  { value: 'technical',     label: 'Technical' },
  { value: 'hr',            label: 'HR' },
  { value: 'behavioral',    label: 'Behavioral' },
  { value: 'system_design', label: 'System Design' },
  { value: 'mixed',         label: 'Mixed' },
];
const DIFFICULTY_OPTS = [
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
];
const PRESSURE_OPTS = [
  { value: 'relaxed',  label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'intense',  label: 'Intense' },
];
const FEEDBACK_MODE_OPTS = [
  { value: 'live',     label: 'Live feedback' },
  { value: 'end_only', label: 'Feedback at end' },
];
const COMPANY_TYPE_OPTS = [
  { value: 'faang',         label: 'FAANG' },
  { value: 'product_based', label: 'Product-based' },
  { value: 'startup',       label: 'Startup' },
  { value: 'service_based', label: 'Service-based' },
  { value: 'any',           label: 'Any' },
];

/**
 * Map an edited Draft to the wizard payload accepted by POST /interviews.
 * The wizard's schema is stable (Commit 1's InterviewBlueprint reads from
 * it) — the parser's Draft is not. This function is where they meet.
 *
 * Sprint 5 Commit 6: also carries the creation source + metadata so the
 * backend can persist origin on the Interview document.
 */
function toWizardPayload(draft, origin = {}) {
  const isDsa = draft.mode === 'dsa';
  // DSA mode overrides a few upstream defaults so the persisted interview
  // is coherent: interviewType is forced 'technical', totalQuestions
  // comes from the DSA question count (1–20 range, not 3–15).
  const dsaQuestionCount = clampInt(
    draft.dsa?.questionCount ?? draft.dsaQuestionCount,
    DSA_QUESTION_COUNT.MIN,
    DSA_QUESTION_COUNT.MAX,
    DSA_QUESTION_COUNT.DEFAULT,
  );
  const payload = {
    role:            draft.role || 'sde',
    experienceLevel: draft.experience || 'fresher',
    companyType:     draft.companyType || 'any',
    targetCompany:   draft.company || '',
    interviewType:   isDsa ? 'technical' : (draft.interviewType || 'mixed'),
    difficulty:      isDsa
      ? (draft.dsa?.difficulty === 'mixed' ? 'medium' : (draft.dsa?.difficulty || 'medium'))
      : (draft.difficulty || 'medium'),
    totalQuestions:  isDsa
      ? dsaQuestionCount
      : clampInt(draft.questionCount, 3, 15, 5),
    jobDescription:  '',
    useResume:       !!draft.useResume,
    lengthIntent:    'auto',
    pressure:        draft.pressure || 'standard',
    personalityId:   '',                          // parser's `personality` is a hint, not an id
    round:           draft.round || 'general',
    // Origin passthrough — interviewBlueprint.fromRequest sanitizes.
    source:          origin.source || 'guided',
    sourceMetadata:  origin.sourceMetadata || {},
  };
  if (isDsa) {
    payload.mode = 'dsa';
    payload.dsa = {
      topic:         draft.dsa?.topic || '',
      difficulty:    draft.dsa?.difficulty || 'medium',
      language:      draft.dsa?.language || '',
      questionCount: dsaQuestionCount,
      allowHints:    draft.dsa?.allowHints !== false,
      focusAreas:    Array.isArray(draft.dsa?.focusAreas) ? draft.dsa.focusAreas : [],
    };
  }
  return payload;
}

/**
 * Derive origin from router state. Templates, presets, recents each land
 * on the Review page with a distinct state key; the parser lands with a
 * `sourcePrompt`. When nothing is set (e.g. deep link), we treat it as
 * Guided Setup.
 */
function deriveOrigin(state = {}) {
  if (state.sourcePrompt) {
    return {
      source: 'quick_ai',
      sourceMetadata: {
        prompt: state.sourcePrompt,
        parserVersion: '1.0',
      },
    };
  }
  if (state.sourceTemplate) {
    return {
      source: 'template',
      sourceMetadata: {
        templateId:   state.sourceTemplateId || '',
        templateName: state.sourceTemplate,
      },
    };
  }
  if (state.sourcePreset) {
    return {
      source: 'preset',
      sourceMetadata: {
        presetId:   state.sourcePresetId || '',
        presetName: state.sourcePreset,
      },
    };
  }
  if (state.sourceLabel && state.sourceKind === 'recent') {
    return {
      source: 'recent',
      sourceMetadata: { label: state.sourceLabel },
    };
  }
  if (state.sourceKind === 'coach') {
    return {
      source: 'coach',
      sourceMetadata: {
        recommendationId: state.sourceRecommendationId || '',
        focusAreaTitle:   state.sourceFocusAreaTitle || '',
      },
    };
  }
  return { source: 'guided', sourceMetadata: {} };
}

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

const InterviewReviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();

  const initial = location.state?.draft || null;

  // Sprint 7 Commit 1 — the parser emits DSA fields flat on the draft
  // (dsaTopic, dsaDifficulty, dsaLanguage, dsaQuestionCount) alongside a
  // top-level `mode`. Fold them into a nested `dsa` object so the
  // DSAConfigurationCard (which is fully controlled) can consume them
  // without every field being propped separately.
  const initialWithDsa = useMemo(() => {
    if (!initial) return null;
    // If a nested dsa already exists (e.g. from templates/presets that add
    // one later), leave it. Otherwise synthesize one from flat fields.
    if (initial.dsa) return initial;
    if (initial.mode !== 'dsa'
        && !initial.dsaTopic
        && !initial.dsaDifficulty
        && !initial.dsaLanguage) {
      return initial;
    }
    return {
      ...initial,
      mode: 'dsa',
      dsa: {
        topic:         initial.dsaTopic || '',
        difficulty:    initial.dsaDifficulty || 'medium',
        language:      initial.dsaLanguage || '',
        questionCount: initial.dsaQuestionCount || DSA_QUESTION_COUNT.DEFAULT,
        allowHints:    true,
        focusAreas:    Array.isArray(initial.topics) ? initial.topics : [],
      },
    };
  }, [initial]);

  const [draft, setDraft] = useState(initialWithDsa);
  const [confidence] = useState(location.state?.confidence || {});
  const [reasons] = useState(location.state?.reasons || {});
  const [unknown, setUnknown] = useState(new Set(location.state?.unknown || []));
  const [starting, setStarting] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // Sprint 5 Commit 6: origin travels with the draft. Templates, presets,
  // recents, coach, and the parser all set distinct router-state keys;
  // deriveOrigin normalizes to a { source, sourceMetadata } shape.
  const origin = useMemo(() => deriveOrigin(location.state || {}), [location.state]);

  // Suggested preset name — derived from the source (template / preset /
  // parser prompt). Empty string when we can't infer a good starting
  // point; the user is free to type anything.
  const suggestedPresetName = useMemo(() => {
    const s = location.state || {};
    if (s.sourcePreset) return s.sourcePreset;
    if (s.sourceTemplate) return s.sourceTemplate;
    if (s.sourceLabel) return s.sourceLabel;
    if (draft?.company && draft?.role) {
      return `${draft.company} · ${String(draft.role).replace(/_/g, ' ')}`;
    }
    return '';
  }, [location.state, draft?.company, draft?.role]);

  // Once the user edits an unknown field, drop it from the "unknown" set
  // so the visual highlight goes away.
  const update = (key) => (val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
    if (unknown.has(key)) {
      setUnknown((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const isUnknown = (key) => unknown.has(key);
  const conf = (key) => confidence[key];

  const problems = useMemo(() => {
    if (!draft) return [];
    const errors = [];
    if (!draft.role) errors.push('Role');
    if (!draft.experience) errors.push('Experience');
    if (draft.mode === 'dsa') {
      if (!draft.dsa?.topic) errors.push('DSA topic');
      if (!draft.dsa?.difficulty) errors.push('DSA difficulty');
      if (!draft.dsa?.language) errors.push('DSA language');
    }
    return errors;
  }, [draft]);

  const handleSavePreset = async (name) => {
    try {
      // Presets store the interview config only — origin is captured on
      // the resulting interview when the preset is later reused, not on
      // the preset itself. So we strip source/sourceMetadata here.
      const { source, sourceMetadata, ...payload } = toWizardPayload(draft);
      void source; void sourceMetadata;
      await presetsAPI.create(name, payload);
      toast.success(`Saved "${name}" as a preset.`);
      setSavePresetOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Could not save preset.');
      throw err;
    }
  };

  const handleStart = async () => {
    if (starting) return;
    if (problems.length) {
      toast.error(`Please set: ${problems.join(', ')}`);
      return;
    }
    setStarting(true);
    try {
      const payload = toWizardPayload(draft, origin);
      const res = await interviewAPI.create(payload);
      applyBadgeUnlocks(res?.unlockedBadges, {
        user,
        updateUser,
        onOpen: () => navigate('/profile?tab=achievements'),
      });
      navigate(`/interview/${res.interview.id}`, {
        state: { greeting: res.greeting || '' },
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to start interview.');
      setStarting(false);
    }
  };

  // ── Empty state — user landed here directly ────────────────────────

  if (!initial || !draft) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
        <Navbar />
        <div className="flex-1 pt-12">
          <div className="max-w-[720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
            <div
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <EmptyState
                icon={Sparkles}
                title="No interview draft to review"
                description="Draft interviews are created from a natural-language prompt. Head to the Quick Interview page to describe what you want."
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/interviews/quick')}
                    className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    Go to Quick Interview
                  </button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lowConfidenceCount =
    Object.values(confidence).filter((c) => typeof c === 'number' && c > 0 && c < 0.7).length
    + unknown.size;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1000px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          <SectionHeader
            eyebrow="interviews · review"
            title="Review Interview Configuration"
            subtitle="We parsed your prompt into a draft. Edit anything before we start."
            action={
              <button
                type="button"
                onClick={() => navigate('/interviews/quick')}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Edit prompt
              </button>
            }
          />

          {/* ── Interview Origin (Sprint 5 Commit 6) ────────────────
              Shows where this draft came from and — for Quick AI — the
              original prompt. Always renders so users can trace how
              the interview was configured. */}
          <div className="mb-4">
            <InterviewOriginCard
              creationSource={origin.source}
              sourceMetadata={origin.sourceMetadata}
            />
          </div>

          {/* Verify banner */}
          {lowConfidenceCount > 0 && (
            <div
              className="flex items-start gap-2 px-3 py-2 mb-4"
              style={{
                background: 'rgba(210,153,34,0.08)',
                border: '1px solid rgba(210,153,34,0.3)',
                borderRadius: 6,
              }}
            >
              <AlertTriangle size={12} style={{ color: '#D29922', flexShrink: 0, marginTop: 2 }} />
              <div className="text-xs" style={{ color: '#F0F6FC' }}>
                <span style={{ color: '#D29922', fontWeight: 500 }}>{lowConfidenceCount}</span>
                {` field${lowConfidenceCount === 1 ? '' : 's'} may need your attention. Edit anything that looks off before starting.`}
              </div>
            </div>
          )}

          {/* ── DSA Configuration (Sprint 7 Commit 1) ────────────────
              Rendered only when the draft is a DSA interview. Fully
              controlled by the DSAConfigurationCard — every keystroke
              updates the draft in place. Standard fields (role,
              company, experience) still render below for common config. */}
          {draft.mode === 'dsa' && draft.dsa && (
            <div
              className="p-4 mb-4"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <div
                className="font-mono text-2xs uppercase tracking-wide mb-3"
                style={{ color: '#6B7280' }}
              >
                DSA Configuration
              </div>
              <DSAConfigurationCard
                config={draft.dsa}
                onChange={(nextDsa) => setDraft((p) => ({ ...p, dsa: nextDsa }))}
              />
            </div>
          )}

          {/* Fields — two-column on lg, one on mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <ReviewField
              label="Company"
              kind="text"
              value={draft.company}
              confidence={conf('company')}
              unknown={isUnknown('company')}
              reason={reasons.company}
              onChange={update('company')}
              placeholder="e.g. Amazon, Razorpay…"
            />
            <ReviewField
              label="Role"
              kind="select"
              options={ROLE_OPTS}
              value={draft.role}
              confidence={conf('role')}
              unknown={isUnknown('role')}
              reason={reasons.role}
              onChange={update('role')}
            />
            <ReviewField
              label="Experience"
              kind="select"
              options={EXPERIENCE_OPTS}
              value={draft.experience}
              confidence={conf('experience')}
              unknown={isUnknown('experience')}
              reason={reasons.experience}
              onChange={update('experience')}
            />
            <ReviewField
              label="Interview Type"
              kind="select"
              options={INTERVIEW_TYPE_OPTS}
              value={draft.interviewType}
              confidence={conf('interviewType')}
              unknown={isUnknown('interviewType')}
              reason={reasons.interviewType}
              onChange={update('interviewType')}
            />
            <ReviewField
              label="Difficulty"
              kind="select"
              options={DIFFICULTY_OPTS}
              value={draft.difficulty}
              confidence={conf('difficulty')}
              unknown={isUnknown('difficulty')}
              reason={reasons.difficulty}
              onChange={update('difficulty')}
            />
            <ReviewField
              label="Company Type"
              kind="select"
              options={COMPANY_TYPE_OPTS}
              value={draft.companyType}
              confidence={conf('companyType')}
              unknown={isUnknown('companyType')}
              reason={reasons.companyType}
              onChange={update('companyType')}
            />
            <ReviewField
              label="Duration"
              kind="number"
              min={5} max={120}
              suffix="min"
              value={draft.duration}
              confidence={conf('duration')}
              unknown={isUnknown('duration')}
              reason={reasons.duration}
              onChange={update('duration')}
              placeholder="30"
            />
            <ReviewField
              label="Question Count"
              kind="number"
              min={3} max={15}
              suffix="questions"
              value={draft.questionCount}
              confidence={conf('questionCount')}
              unknown={isUnknown('questionCount')}
              reason={reasons.questionCount}
              onChange={update('questionCount')}
              placeholder="5"
              description="Between 3 and 15."
            />
            <ReviewField
              label="Pressure"
              kind="select"
              options={PRESSURE_OPTS}
              value={draft.pressure}
              confidence={conf('pressure')}
              unknown={isUnknown('pressure')}
              reason={reasons.pressure}
              onChange={update('pressure')}
            />
            <ReviewField
              label="Interviewer Personality"
              kind="text"
              value={draft.personality}
              confidence={conf('personality')}
              unknown={isUnknown('personality')}
              reason={reasons.personality}
              onChange={update('personality')}
              placeholder="e.g. Google, friendly, hiring manager…"
              description="Freeform hint. Guides the interviewer's tone."
            />

            <div className="lg:col-span-2">
              <ReviewField
                label="Topics"
                kind="tags"
                value={draft.topics || []}
                confidence={conf('topics')}
                unknown={isUnknown('topics')}
                reason={reasons.topics}
                onChange={update('topics')}
                placeholder="Add topic and press Enter"
              />
            </div>

            <ReviewField
              label="Resume"
              kind="toggle"
              value={draft.useResume}
              confidence={conf('useResume')}
              unknown={isUnknown('useResume')}
              reason={reasons.useResume}
              onChange={update('useResume')}
              description={user?.resumeUrl ? 'Use your uploaded resume as context.' : 'No resume uploaded — this will be a no-op.'}
            />
            <ReviewField
              label="Projects"
              kind="toggle"
              value={draft.useProjects}
              confidence={conf('useProjects')}
              unknown={isUnknown('useProjects')}
              reason={reasons.useProjects}
              onChange={update('useProjects')}
              description="Ground questions in your analyzed GitHub repos."
            />
            <ReviewField
              label="Follow-Ups"
              kind="toggle"
              value={draft.followUps}
              confidence={conf('followUps')}
              unknown={isUnknown('followUps')}
              reason={reasons.followUps}
              onChange={update('followUps')}
              description="Ask drilling follow-up questions."
            />
            <ReviewField
              label="Feedback Mode"
              kind="select"
              options={FEEDBACK_MODE_OPTS}
              value={draft.feedbackMode}
              confidence={conf('feedbackMode')}
              unknown={isUnknown('feedbackMode')}
              reason={reasons.feedbackMode}
              onChange={update('feedbackMode')}
              description="Live nudges vs single end-of-interview report."
            />
          </div>

          {/* ── Summary card (Sprint 5 Commit 6) ────────────────────
              Concise recap of the (possibly edited) config. Users see
              this before Start Interview so what they're about to run is
              unambiguous. Reused by History/Results in later commits. */}
          <div className="mb-4">
            <InterviewSummaryCard
              config={{
                role:            draft.role,
                targetCompany:   draft.company,
                experienceLevel: draft.experience,
                interviewType:   draft.interviewType,
                difficulty:      draft.difficulty,
                totalQuestions:  draft.questionCount,
                duration:        draft.duration,
                pressure:        draft.pressure,
                personality:     draft.personality,
                useResume:       draft.useResume,
                useProject:      draft.useProjects,
                topics:          draft.topics,
                // Sprint 7 Commit 1 — DSA passthrough so the summary card
                // renders topic/language/difficulty/hints when applicable.
                mode:            draft.mode,
                dsa:             draft.dsa,
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSavePresetOpen(true)}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              title="Save this configuration for reuse"
            >
              <Bookmark size={11} /> Save preset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/interviews/quick')}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Edit prompt
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={starting}
                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {starting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Play size={11} /> Start Interview
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Save preset modal */}
          <SavePresetModal
            open={savePresetOpen}
            onClose={() => setSavePresetOpen(false)}
            onSave={handleSavePreset}
            defaultName={suggestedPresetName}
          />

          <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
            {'// interview is created via the same endpoint as the guided wizard'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InterviewReviewPage;
