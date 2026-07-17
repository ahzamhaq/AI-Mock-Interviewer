import React from 'react';
import { motion } from 'framer-motion';

/**
 * PromptSuggestionChips — clickable chip row for the Quick Interview page.
 * Kept pure/presentational: the parent owns the chip data + click handler.
 *
 * Behavior: clicking a chip REPLACES the current prompt text (per Task 4).
 * Handler receives the chip's `prompt` string.
 *
 * Props:
 *   suggestions — [{ label, prompt }]
 *   onSelect    — (prompt) => void
 *   disabled    — greys out the row (e.g. while a modal is open)
 */
const PromptSuggestionChips = ({ suggestions = [], onSelect, disabled = false }) => {
  if (!suggestions.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <motion.button
          key={s.label}
          type="button"
          onClick={() => !disabled && onSelect(s.prompt)}
          disabled={disabled}
          whileHover={disabled ? undefined : { y: -1 }}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="inline-flex items-center px-2 py-1 font-mono text-2xs transition-colors"
          style={{
            color: '#9CA3AF',
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 4,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
          }}
          onMouseEnter={(e) => {
            if (disabled) return;
            e.currentTarget.style.background = '#161B22';
            e.currentTarget.style.borderColor = '#484F58';
            e.currentTarget.style.color = '#F0F6FC';
          }}
          onMouseLeave={(e) => {
            if (disabled) return;
            e.currentTarget.style.background = '#0D1117';
            e.currentTarget.style.borderColor = '#30363D';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          {s.label}
        </motion.button>
      ))}
    </div>
  );
};

export default PromptSuggestionChips;
