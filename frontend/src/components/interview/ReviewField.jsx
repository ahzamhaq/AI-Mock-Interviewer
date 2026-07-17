import React, { useState } from 'react';
import { Info } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

/**
 * ReviewField — one row on the InterviewReviewPage.
 *
 * Renders a label, a confidence badge, and one of five input kinds
 * (select | text | number | tags | toggle). Every field is editable per
 * Task 8; there is no "regenerate" affordance.
 *
 * The visual matches the app-wide form pattern: uppercase mono label +
 * input-field styling + optional description below.
 *
 * Props:
 *   label       — visible label
 *   confidence  — 0–1 from parser
 *   unknown     — boolean, marks the field visually red
 *   kind        — 'select' | 'text' | 'number' | 'tags' | 'toggle'
 *   value       — current value
 *   options     — [{ value, label }] for select
 *   onChange    — (newValue) => void
 *   placeholder — for text/number
 *   description — small hint under the input
 *   suffix      — small text after number (e.g. "min", "questions")
 *   min, max    — for number
 */
const ReviewField = ({
  label,
  confidence,
  unknown,
  kind,
  value,
  options = [],
  onChange,
  placeholder,
  description,
  suffix,
  min,
  max,
  reason,          // Sprint 5 Commit 6 — 1-sentence parser explanation
}) => {
  const [reasonOpen, setReasonOpen] = useState(false);
  const borderColor = unknown
    ? '#F85149'
    : (typeof confidence === 'number' && confidence < 0.7)
      ? '#D29922'
      : '#30363D';

  const bg = unknown
    ? 'rgba(248,81,73,0.04)'
    : '#0D1117';

  return (
    <div
      className="p-3"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <label
            className="font-mono text-2xs uppercase tracking-wide truncate"
            style={{ color: '#9CA3AF' }}
          >
            {label}
          </label>
          {/* "Why?" affordance — visible only when the parser provided a
              reason. Click OR hover reveals the tooltip; click again to
              dismiss on touch devices. */}
          {reason && (
            <button
              type="button"
              onClick={() => setReasonOpen((v) => !v)}
              onMouseEnter={() => setReasonOpen(true)}
              onMouseLeave={() => setReasonOpen(false)}
              className="inline-flex items-center"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'help',
                color: '#6B7280',
                position: 'relative',
              }}
              aria-label={`Why: ${reason}`}
              title={reason}
            >
              <Info size={11} />
              {reasonOpen && (
                <span
                  className="absolute font-mono text-2xs"
                  style={{
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: 220,
                    maxWidth: 320,
                    padding: '6px 8px',
                    background: '#1C2128',
                    border: '1px solid #30363D',
                    borderRadius: 4,
                    color: '#F0F6FC',
                    lineHeight: 1.4,
                    boxShadow: '0 8px 24px rgba(1,4,9,0.85)',
                    zIndex: 20,
                    whiteSpace: 'normal',
                    textAlign: 'left',
                    pointerEvents: 'none',
                  }}
                >
                  {reason}
                </span>
              )}
            </button>
          )}
        </div>
        <ConfidenceBadge confidence={confidence} unknown={unknown} />
      </div>

      {kind === 'select' && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="input-field"
          style={{ padding: '6px 10px' }}
        >
          {value == null && (
            <option value="" disabled>
              — select —
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {kind === 'text' && (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          style={{ padding: '6px 10px' }}
        />
      )}

      {kind === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') { onChange(null); return; }
              const n = Number(raw);
              onChange(Number.isFinite(n) ? n : null);
            }}
            placeholder={placeholder}
            min={min}
            max={max}
            className="input-field"
            style={{ padding: '6px 10px', width: 100 }}
          />
          {suffix && (
            <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
              {suffix}
            </span>
          )}
        </div>
      )}

      {kind === 'tags' && (
        <TagsEditor value={value || []} onChange={onChange} placeholder={placeholder} />
      )}

      {kind === 'toggle' && (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ display: 'none' }}
          />
          <span
            className="flex items-center transition-colors"
            style={{
              width: 32,
              height: 18,
              borderRadius: 999,
              background: value ? '#1F6FEB' : '#21262D',
              border: `1px solid ${value ? '#1F6FEB' : '#30363D'}`,
              position: 'relative',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#F0F6FC',
                position: 'absolute',
                left: 2,
                transform: `translateX(${value ? 14 : 0}px)`,
                transition: 'transform 120ms',
              }}
            />
          </span>
          <span className="text-xs" style={{ color: '#F0F6FC' }}>
            {value ? 'On' : 'Off'}
          </span>
        </label>
      )}

      {description && (
        <p
          className="text-xs mt-2"
          style={{ color: '#6B7280' }}
        >
          {description}
        </p>
      )}
    </div>
  );
};

// Minimal chip-based tags editor — press Enter or "," to add. Backspace
// on empty input removes the last chip. No dep on a picker library.
const TagsEditor = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = React.useState('');

  const add = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t].slice(0, 12));
  };

  const removeAt = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-2xs"
            style={{
              color: '#F0F6FC',
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: 4,
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="opacity-60 hover:opacity-100"
              style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
              setDraft('');
            } else if (e.key === 'Backspace' && !draft && value.length) {
              removeAt(value.length - 1);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="input-field"
          style={{ padding: '4px 8px', flex: '1 1 120px', minWidth: 120 }}
        />
      </div>
      <p className="font-mono text-2xs mt-1.5" style={{ color: '#484F58' }}>
        Enter or comma to add
      </p>
    </div>
  );
};

export default ReviewField;
