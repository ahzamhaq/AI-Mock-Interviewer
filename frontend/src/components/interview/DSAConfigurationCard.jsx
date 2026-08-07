import React from 'react';
import { Code2, Gauge, Terminal, Hash, Lightbulb, Target } from 'lucide-react';
import {
  DSA_TOPICS,
  DSA_DIFFICULTIES,
  DSA_LANGUAGES,
  DSA_QUESTION_COUNT,
  DSA_FOCUS_AREA_SUGGESTIONS,
} from '../../data/dsaConstants';

/**
 * DSAConfigurationCard — the single DSA setup surface used by both the
 * Guided Setup wizard and (later) the Review page's mode-specific edit
 * region.
 *
 * Sprint 7 Commit 1: configuration only. No AI generation, no coding
 * editor, no execution. Language is metadata for now.
 *
 * The card is fully controlled: parent owns `config`, receives `onChange`
 * on every keystroke/click, and decides where to persist. Local sub-
 * selectors (topic, difficulty, language, count, hints, focus areas) live
 * inside this file — each is trivial and only meaningful in this context,
 * so promoting them to standalone modules is premature abstraction.
 *
 * Props:
 *   config   — { topic, difficulty, language, questionCount, allowHints, focusAreas }
 *   onChange — (patch: partial config) => void
 */
const DSAConfigurationCard = ({ config, onChange }) => {
  const patch = (delta) => onChange({ ...config, ...delta });
  const toggleFocusArea = (area) => {
    const set = new Set(config.focusAreas || []);
    if (set.has(area)) set.delete(area);
    else set.add(area);
    patch({ focusAreas: Array.from(set) });
  };

  return (
    <div className="space-y-6">
      {/* Topic */}
      <SectionLabel icon={Code2} label="Topic" required>
        Pick the primary data structure or algorithm family.
      </SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DSA_TOPICS.map((topic) => (
          <TopicPill
            key={topic}
            active={config.topic === topic}
            onClick={() => patch({ topic })}
          >
            {topic}
          </TopicPill>
        ))}
      </div>

      {/* Any-topic input — the picker above lists the canonical set, but
          candidates are free to name any DSA topic they want ("segment
          tree lazy propagation", "kadane's algorithm", etc.). The typed
          value replaces the selected pill; clearing it falls back to the
          picker. */}
      <div className="mt-2">
        <label
          className="block font-mono text-2xs uppercase tracking-wide mb-1"
          style={{ color: '#6B7280' }}
          htmlFor="dsa-custom-topic"
        >
          Or type any topic
        </label>
        <input
          id="dsa-custom-topic"
          type="text"
          maxLength={80}
          value={DSA_TOPICS.includes(config.topic) ? '' : (config.topic || '')}
          onChange={(e) => patch({ topic: e.target.value })}
          placeholder="e.g. Kadane's algorithm, Segment Tree with lazy propagation"
          className="w-full px-2.5 py-1.5 text-xs"
          style={{
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 4,
            color: '#F0F6FC',
          }}
          aria-describedby="dsa-custom-topic-help"
        />
        <p
          id="dsa-custom-topic-help"
          className="font-mono text-2xs mt-1"
          style={{ color: '#6B7280' }}
        >
          Freeform topics are supported. Interviewer will focus questions here.
        </p>
      </div>

      {/* Difficulty */}
      <SectionLabel icon={Gauge} label="Difficulty" required>
        Overall difficulty target for the question set.
      </SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DSA_DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => patch({ difficulty: d.value })}
            className="py-2.5 px-3 text-xs font-medium transition-colors text-left"
            style={{
              background: config.difficulty === d.value ? '#161B22' : '#0D1117',
              border: `1px solid ${config.difficulty === d.value ? d.color : '#30363D'}`,
              borderRadius: 6,
              color: config.difficulty === d.value ? d.color : '#F0F6FC',
              cursor: 'pointer',
            }}
            aria-pressed={config.difficulty === d.value}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Language */}
      <SectionLabel icon={Terminal} label="Programming language" required>
        The language you&apos;d write solutions in.
      </SectionLabel>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {DSA_LANGUAGES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => patch({ language: l.value })}
            className="py-2 px-2 text-xs font-medium transition-colors"
            style={{
              background: config.language === l.value ? '#161B22' : '#0D1117',
              border: `1px solid ${config.language === l.value ? '#58A6FF' : '#30363D'}`,
              borderRadius: 6,
              color: config.language === l.value ? '#58A6FF' : '#F0F6FC',
              cursor: 'pointer',
            }}
            aria-pressed={config.language === l.value}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Question count */}
      <SectionLabel icon={Hash} label={`Number of questions: ${config.questionCount}`}>
        Between {DSA_QUESTION_COUNT.MIN} and {DSA_QUESTION_COUNT.MAX}.
      </SectionLabel>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={DSA_QUESTION_COUNT.MIN}
          max={DSA_QUESTION_COUNT.MAX}
          value={config.questionCount}
          onChange={(e) => patch({ questionCount: parseInt(e.target.value, 10) })}
          className="flex-1"
          style={{ accentColor: '#58A6FF' }}
          aria-label="Number of DSA questions"
        />
        <input
          type="number"
          min={DSA_QUESTION_COUNT.MIN}
          max={DSA_QUESTION_COUNT.MAX}
          value={config.questionCount}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n)) {
              patch({
                questionCount: Math.max(
                  DSA_QUESTION_COUNT.MIN,
                  Math.min(DSA_QUESTION_COUNT.MAX, n),
                ),
              });
            }
          }}
          className="w-16 px-2 py-1 text-xs text-center"
          style={{
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 4,
            color: '#F0F6FC',
          }}
          aria-label="Question count numeric input"
        />
      </div>

      {/* Hints */}
      <SectionLabel icon={Lightbulb} label="Allow hints">
        Interviewer may nudge you if you&apos;re stuck.
      </SectionLabel>
      <label
        className="flex items-center gap-3 p-3 cursor-pointer"
        style={{
          background: '#0D1117',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
      >
        <input
          type="checkbox"
          checked={!!config.allowHints}
          onChange={(e) => patch({ allowHints: e.target.checked })}
          className="w-4 h-4"
          style={{ accentColor: '#58A6FF' }}
        />
        <span className="text-xs" style={{ color: '#F0F6FC' }}>
          {config.allowHints ? 'Hints enabled' : 'Hints disabled'}
        </span>
      </label>

      {/* Focus areas */}
      <SectionLabel icon={Target} label="Focus areas (optional)">
        Steer the interviewer toward specific angles.
      </SectionLabel>
      <div className="flex flex-wrap gap-2">
        {DSA_FOCUS_AREA_SUGGESTIONS.map((area) => {
          const active = (config.focusAreas || []).includes(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => toggleFocusArea(area)}
              className="px-2.5 py-1 text-2xs font-mono transition-colors"
              style={{
                background: active ? '#161B22' : '#0D1117',
                border: `1px solid ${active ? '#58A6FF' : '#30363D'}`,
                borderRadius: 999,
                color: active ? '#58A6FF' : '#9CA3AF',
                cursor: 'pointer',
              }}
              aria-pressed={active}
            >
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SectionLabel = ({ icon: Icon, label, required, children }) => (
  <div className="mb-2">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon size={12} style={{ color: '#58A6FF' }} />}
      <span className="text-xs font-medium" style={{ color: '#F0F6FC' }}>
        {label}
        {required && <span style={{ color: '#F85149', marginLeft: 4 }} aria-hidden>*</span>}
      </span>
    </div>
    {children && (
      <p className="font-mono text-2xs" style={{ color: '#6B7280' }}>{children}</p>
    )}
  </div>
);

const TopicPill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-2 py-1.5 text-xs transition-colors text-left"
    style={{
      background: active ? '#161B22' : '#0D1117',
      border: `1px solid ${active ? '#58A6FF' : '#30363D'}`,
      borderRadius: 6,
      color: active ? '#58A6FF' : '#F0F6FC',
      cursor: 'pointer',
    }}
    aria-pressed={active}
  >
    {children}
  </button>
);

export default DSAConfigurationCard;
