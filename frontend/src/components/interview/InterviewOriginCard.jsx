import React from 'react';
import {
  Sparkles, Sliders, Layers, Bookmark, Clock, RotateCcw, Compass, Info,
} from 'lucide-react';

/**
 * InterviewOriginCard — "Created From" block. Consumed by the Review page
 * (when an interview is being reviewed pre-creation, showing where the
 * draft came from) and by post-creation surfaces (Results, History
 * details) via the compact `dense` variant.
 *
 * Reads a `{ creationSource, sourceMetadata }` pair — the exact shape
 * that Interview.model.js now persists. When called from the Review page
 * before creation, the caller synthesizes the same shape from router
 * state (see InterviewReviewPage.originContext).
 *
 * Props:
 *   creationSource — enum string
 *   sourceMetadata — shape varies by source
 *   dense          — compact inline variant (single row, no title)
 */

const SOURCE_META = {
  guided:    { label: 'Guided Setup',           icon: Sliders,   accent: '#9CA3AF' },
  quick_ai:  { label: 'Quick AI',               icon: Sparkles,  accent: '#58A6FF' },
  template:  { label: 'Template',               icon: Layers,    accent: '#58A6FF' },
  preset:    { label: 'Preset',                 icon: Bookmark,  accent: '#D29922' },
  recent:    { label: 'Recent Configuration',   icon: Clock,     accent: '#58A6FF' },
  retry:     { label: 'Retry',                  icon: RotateCcw, accent: '#F85149' },
  coach:     { label: 'AI Coach',               icon: Compass,   accent: '#3FB950' },
};

const InterviewOriginCard = ({ creationSource, sourceMetadata = {}, dense = false }) => {
  const src = SOURCE_META[creationSource] || SOURCE_META.guided;
  const Icon = src.icon;

  // Best-effort primary detail line per source. Falls back to the label
  // when no specific metadata is available.
  const detail = describeSource(creationSource, sourceMetadata);

  if (dense) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-2xs"
        style={{ color: '#6B7280' }}
      >
        <Icon size={10} style={{ color: src.accent }} />
        <span>from</span>
        <span style={{ color: '#F0F6FC' }}>{src.label}</span>
        {detail && (
          <>
            <span style={{ color: '#30363D' }}>·</span>
            <span className="truncate" style={{ color: '#9CA3AF', maxWidth: 240 }}>
              {detail}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      className="p-4"
      style={{
        background: '#161B22',
        border: '1px solid #30363D',
        borderRadius: 6,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        >
          <Icon size={14} style={{ color: src.accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-2xs uppercase tracking-wide"
            style={{ color: '#6B7280' }}
          >
            Created From
          </div>
          <div className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>
            {src.label}
          </div>
          {detail && (
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{
                color: '#9CA3AF',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {creationSource === 'quick_ai' && sourceMetadata.prompt
                ? `"${sourceMetadata.prompt}"`
                : detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

function describeSource(source, meta) {
  switch (source) {
    case 'quick_ai':
      return meta?.prompt ? `Original prompt · ${truncate(meta.prompt, 200)}` : 'Natural-language prompt';
    case 'template':
      return meta?.templateName || null;
    case 'preset':
      return meta?.presetName || null;
    case 'recent':
      return meta?.label || null;
    case 'retry':
      return meta?.topic ? `Retry · ${meta.topic}` : 'Retry of an earlier question';
    case 'coach':
      return meta?.focusAreaTitle || null;
    case 'guided':
    default:
      return null;
  }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export default InterviewOriginCard;
