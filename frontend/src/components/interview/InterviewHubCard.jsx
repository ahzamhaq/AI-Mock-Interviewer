import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { ArrowRight, Lock } from 'lucide-react';

/**
 * InterviewHubCard — a single interview-type card on the Interview Hub.
 *
 * Two visual states, one component:
 *   • enabled — clickable, borders brighten on hover, primary CTA
 *   • disabled — muted, non-interactive, `Coming Soon` badge, lock icon
 *
 * Optional info block shows contextual data (resume status, project count,
 * example prompt, etc.) rendered above the CTA. Kept as freeform React
 * nodes rather than a fixed schema so different cards can show different
 * telemetry without fighting the card layout.
 *
 * Reuses the same visual language as ActionCard (dashboard PrimaryActions)
 * — no new design introduced.
 */
const InterviewHubCard = ({
  type,           // entry from data/interviewTypes.js
  info,           // optional React node — rendered between description and CTA
  onClick,
}) => {
  const Icon = Icons[type.icon] || Icons.Circle;
  const disabled = !type.enabled;

  return (
    <motion.button
      type="button"
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative flex flex-col items-start text-left w-full h-full p-5 transition-colors"
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = '#161B22';
        e.currentTarget.style.borderColor = '#484F58';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = '#0D1117';
        e.currentTarget.style.borderColor = '#30363D';
      }}
      aria-disabled={disabled}
    >
      {/* Header row — icon + status badge */}
      <div className="flex items-start justify-between w-full mb-3">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        >
          <Icon size={15} style={{ color: disabled ? '#6B7280' : '#58A6FF' }} />
        </div>
        {disabled ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wide px-1.5 py-0.5"
            style={{
              color: '#D29922',
              background: 'rgba(210,153,34,0.1)',
              border: '1px solid rgba(210,153,34,0.3)',
              borderRadius: 4,
            }}
          >
            <Lock size={9} /> Coming Soon
          </span>
        ) : null}
      </div>

      {/* Title + description */}
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: '#F0F6FC' }}
      >
        {type.title}
      </h3>
      <p
        className="text-xs leading-relaxed mb-3"
        style={{ color: '#9CA3AF' }}
      >
        {type.description}
      </p>

      {/* Contextual info slot (resume/project/prompt hints) */}
      {info && (
        <div className="w-full mb-3">
          {info}
        </div>
      )}

      {/* CTA row — sits at the bottom via mt-auto */}
      <div className="w-full mt-auto flex items-center justify-between">
        <span
          className="font-mono text-2xs uppercase tracking-wide"
          style={{ color: disabled ? '#484F58' : '#58A6FF' }}
        >
          {type.actionLabel}
        </span>
        {!disabled && (
          <ArrowRight size={12} style={{ color: '#58A6FF' }} />
        )}
      </div>
    </motion.button>
  );
};

export default InterviewHubCard;
