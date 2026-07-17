import React from 'react';
import { motion } from 'framer-motion';
import { Clock, RotateCw, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * RecentConfigCard — one row representing either a recent-interview
 * config OR a saved preset. Same visual, different `variant`:
 *
 *   variant='recent' — muted, "Reuse" CTA, "yesterday · 5 questions"
 *   variant='preset' — bookmark icon, "Start" CTA, name-first
 *
 * One card component for both because the shapes rhyme: both point at
 * the same POST /api/interviews payload; only the labeling differs.
 *
 * Props:
 *   variant  — 'recent' | 'preset'
 *   title    — display name
 *   subtitle — role · type · difficulty
 *   createdAt— timestamp
 *   onClick  — primary action
 */
const RecentConfigCard = ({ variant = 'recent', title, subtitle, createdAt, onClick }) => {
  const isPreset = variant === 'preset';
  const Icon = isPreset ? Bookmark : Clock;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-center gap-3 w-full text-left p-3 transition-colors"
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
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
      >
        <Icon size={12} style={{ color: isPreset ? '#D29922' : '#58A6FF' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: '#F0F6FC' }}>
          {title || 'Untitled'}
        </div>
        <div
          className="font-mono text-2xs mt-0.5 truncate"
          style={{ color: '#6B7280' }}
        >
          {subtitle}
          {createdAt && (
            <>
              <span style={{ color: '#30363D' }}> · </span>
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <RotateCw size={11} style={{ color: '#58A6FF' }} />
        <span
          className="font-mono text-2xs uppercase tracking-wide"
          style={{ color: '#58A6FF' }}
        >
          {isPreset ? 'Start' : 'Reuse'}
        </span>
      </div>
    </motion.button>
  );
};

export default RecentConfigCard;
