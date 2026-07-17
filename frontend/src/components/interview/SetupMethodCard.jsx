import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/**
 * SetupMethodCard — a single option on the Setup Method page (Quick with
 * AI vs Guided Setup). Uses the same visual language as InterviewHubCard
 * so the two pages feel like siblings: same #0D1117 bg, same #30363D
 * border, same hover behavior, same primary CTA treatment.
 *
 * Props:
 *   icon       — Lucide icon component
 *   title      — bold headline
 *   description— one-line explanation
 *   bullets    — [String] rendered as a bulleted preview list
 *   ctaLabel   — text on the primary button
 *   onClick    — click handler
 */
const SetupMethodCard = ({ icon: Icon, title, description, bullets = [], ctaLabel, onClick }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.995 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="flex flex-col items-start text-left w-full h-full p-5 transition-colors"
    style={{
      background: '#0D1117',
      border: '1px solid #30363D',
      borderRadius: 6,
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#161B22';
      e.currentTarget.style.borderColor = '#484F58';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = '#0D1117';
      e.currentTarget.style.borderColor = '#30363D';
    }}
  >
    <div
      className="flex items-center justify-center flex-shrink-0 mb-3"
      style={{
        width: 36,
        height: 36,
        background: '#161B22',
        border: '1px solid #30363D',
        borderRadius: 6,
      }}
    >
      {Icon && <Icon size={16} style={{ color: '#58A6FF' }} />}
    </div>

    <h3
      className="text-sm sm:text-base font-semibold mb-1"
      style={{ color: '#F0F6FC' }}
    >
      {title}
    </h3>

    <p
      className="text-xs leading-relaxed mb-3"
      style={{ color: '#9CA3AF' }}
    >
      {description}
    </p>

    {bullets.length > 0 && (
      <ul className="mb-4 space-y-1 w-full">
        {bullets.map((b) => (
          <li
            key={b}
            className="font-mono text-2xs flex items-start gap-1.5"
            style={{ color: '#6B7280' }}
          >
            <span style={{ color: '#484F58' }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    )}

    <div className="w-full mt-auto flex items-center justify-between">
      <span
        className="font-mono text-2xs uppercase tracking-wide"
        style={{ color: '#58A6FF' }}
      >
        {ctaLabel}
      </span>
      <ArrowRight size={12} style={{ color: '#58A6FF' }} />
    </div>
  </motion.button>
);

export default SetupMethodCard;
