import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

/**
 * ActionCard — primary call-to-action card used on the Dashboard "What would
 * you like to do today?" row and on the Interviews entry page.
 *
 * Visual language mirrors the existing Panel/card-hover pattern: 1px #30363D
 * border on #0D1117, brightens to #484F58 on hover, #58A6FF accent for the
 * corner arrow. No gradients, no glassmorphism — consistent with the rest of
 * the app.
 *
 * Props:
 *   icon      – Lucide icon component
 *   eyebrow   – short uppercase mono label (e.g. "interview")
 *   title     – bold headline
 *   description – supporting copy
 *   onClick   – click handler (page owns navigation)
 *   disabled  – renders muted + non-interactive
 *   badge     – optional right-corner badge node (e.g. "Sprint 2")
 */
const ActionCard = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  onClick,
  disabled = false,
  badge = null,
}) => (
  <motion.button
    type="button"
    onClick={disabled ? undefined : onClick}
    whileHover={disabled ? undefined : { y: -1 }}
    whileTap={disabled ? undefined : { scale: 0.995 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="group relative flex flex-col items-start text-left w-full h-full p-4 sm:p-5 transition-colors"
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
    <div className="flex items-start justify-between w-full mb-3">
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 32,
          height: 32,
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
      >
        {Icon && <Icon size={15} style={{ color: '#58A6FF' }} />}
      </div>
      {badge}
    </div>

    {eyebrow && (
      <span
        className="font-mono text-2xs uppercase tracking-wide mb-1"
        style={{ color: '#6B7280' }}
      >
        {eyebrow}
      </span>
    )}

    <h3
      className="text-sm sm:text-base font-semibold mb-1"
      style={{ color: '#F0F6FC' }}
    >
      {title}
    </h3>

    {description && (
      <p
        className="text-xs leading-relaxed"
        style={{ color: '#9CA3AF' }}
      >
        {description}
      </p>
    )}

    <ArrowUpRight
      size={13}
      className="absolute top-4 right-4 transition-opacity"
      style={{
        color: '#58A6FF',
        opacity: 0,
      }}
      aria-hidden
    />

    <style>{`
      .group:hover > svg[aria-hidden="true"] { opacity: 1; }
    `}</style>
  </motion.button>
);

export default ActionCard;
