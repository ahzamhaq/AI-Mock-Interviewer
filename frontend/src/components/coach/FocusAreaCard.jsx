import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { resolveAction } from '../../services/coachActions';

/**
 * FocusAreaCard — one item of a Coach roadmap. Used by CoachPage (full
 * list) and CoachPreview (top-1 on Dashboard, Commit 7). Every action on
 * the card dispatches through the shared resolveAction helper so behavior
 * matches the Continue Learning rail exactly.
 *
 * Props:
 *   item — {
 *     title, reason, priority, estimatedMinutes,
 *     actions: [ CoachAction ]
 *   }
 *   dense — compact variant used on the Dashboard preview
 */
const PRIORITY_META = {
  high:   { label: 'high',   color: '#F85149', bg: 'rgba(248,81,73,0.1)',  border: 'rgba(248,81,73,0.3)' },
  medium: { label: 'medium', color: '#D29922', bg: 'rgba(210,153,34,0.1)', border: 'rgba(210,153,34,0.3)' },
  low:    { label: 'low',    color: '#3FB950', bg: 'rgba(63,185,80,0.1)',  border: 'rgba(63,185,80,0.3)' },
};

const FocusAreaCard = ({ item, dense = false }) => {
  const navigate = useNavigate();
  const [busyActionId, setBusyActionId] = useState(null);

  const prio = PRIORITY_META[item?.priority] || PRIORITY_META.medium;

  const dispatch = async (action) => {
    if (busyActionId) return;
    setBusyActionId(action.id);
    try {
      await resolveAction(navigate, action);
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={dense ? 'p-4' : 'p-5'}
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 6,
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="inline-flex items-center px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide"
              style={{
                color: prio.color,
                background: prio.bg,
                border: `1px solid ${prio.border}`,
                borderRadius: 4,
              }}
            >
              {prio.label}
            </span>
            {typeof item?.estimatedMinutes === 'number' && (
              <span
                className="inline-flex items-center gap-1 font-mono text-2xs"
                style={{ color: '#6B7280' }}
              >
                <Clock size={9} /> {item.estimatedMinutes}m
              </span>
            )}
          </div>
          <h3
            className={`font-semibold ${dense ? 'text-sm' : 'text-base'}`}
            style={{ color: '#F0F6FC' }}
          >
            {item?.title}
          </h3>
          {item?.reason && (
            <p
              className="text-xs leading-relaxed mt-1"
              style={{ color: '#9CA3AF' }}
            >
              {item.reason}
            </p>
          )}
        </div>
      </div>

      {Array.isArray(item?.actions) && item.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {item.actions.map((a, i) => {
            const busy = busyActionId === a.id;
            // First action gets primary treatment; rest are secondary.
            const primary = i === 0;
            return (
              <button
                key={a.id || `${a.kind}-${i}`}
                type="button"
                onClick={() => dispatch(a)}
                disabled={!!busyActionId}
                className={`${primary ? 'btn-accent' : 'btn-secondary'} flex items-center gap-1.5 px-3 py-1.5 text-xs`}
                style={busyActionId && !busy ? { opacity: 0.5 } : undefined}
              >
                {busy ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    {a.label} <ArrowRight size={11} />
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default FocusAreaCard;
