import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play, RotateCcw, GitBranch, ArrowRight, Loader2,
} from 'lucide-react';
import SectionHeader from '../common/SectionHeader';
import { recommendationsAPI } from '../../services/api';
import { resolveAction } from '../../services/coachActions';

/**
 * ContinueLearning — the Dashboard's "what should I do next" rail.
 *
 * Reads GET /api/recommendations, which composes an ordered set of up to
 * three cards (Resume → Retry weak topic × 1–2 → Continue Project). The
 * rail hides entirely when the endpoint returns nothing — new users see
 * Primary Actions do the orienting work instead of a placeholder row.
 *
 * Card actions by kind:
 *   • resume            — navigate to the in-progress interview
 *   • retry_weak        — POST card.payload to /api/interviews, then jump
 *                         into the new interview room (matches how
 *                         InterviewSetupPage submits)
 *   • continue_project  — navigate to the workspace
 *
 * Only one card can be "starting" at a time. Prevents accidental double-
 * submits when the retry endpoint is slow.
 */

// Card kind → icon mapping. Keeping this here rather than on the payload so
// the backend stays icon-agnostic (a good design boundary).
const KIND_ICON = {
  resume: Play,
  retry_weak: RotateCcw,
  continue_project: GitBranch,
};

const ContinueLearning = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let alive = true;
    recommendationsAPI.list()
      .then((res) => { if (alive) setCards(res.recommendations || []); })
      .catch(() => { if (alive) setCards([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Stable id per card for the busy-state tracking. Backend does not send an
  // id (cards are derived, not stored) so we compose one from index+kind.
  const cardId = (card, i) => `${i}-${card.kind}`;

  // Sprint 4 refactor: all card dispatch goes through the shared
  // resolveAction helper. The rail's card shapes (kind: 'resume' |
  // 'retry_weak' | 'continue_project') are aliased to the CoachAction
  // vocabulary inside the resolver, so behavior is byte-identical to
  // the pre-refactor implementation. One dispatcher for every surface
  // that renders actions (rail, Coach page, ⌘K palette, notifications).
  const handleClick = async (card, i) => {
    if (startingId) return;
    const id = cardId(card, i);
    setStartingId(id);
    try {
      await resolveAction(navigate, card);
    } finally {
      // If navigation happened we unmount before this runs; if it didn't
      // (payload rejected, unknown kind) we release the busy state so the
      // user can click something else.
      setStartingId(null);
    }
  };

  if (loading) {
    // Deliberately quiet: no skeleton block. The rail is optional chrome;
    // showing a big skeleton would imply required content is loading.
    return null;
  }
  if (!cards.length) return null;

  return (
    <div className="mb-4">
      <SectionHeader
        eyebrow="continue learning"
        title="Pick up where you left off"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card, i) => {
          const id = cardId(card, i);
          const busy = startingId === id;
          const Icon = KIND_ICON[card.kind] || Play;
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => handleClick(card, i)}
              disabled={!!startingId}
              whileHover={startingId ? undefined : { y: -1 }}
              whileTap={startingId ? undefined : { scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex flex-col items-start text-left w-full h-full p-4 transition-colors"
              style={{
                background: '#0D1117',
                border: '1px solid #30363D',
                borderRadius: 6,
                cursor: startingId ? 'progress' : 'pointer',
                opacity: startingId && !busy ? 0.55 : 1,
              }}
              onMouseEnter={(e) => {
                if (startingId) return;
                e.currentTarget.style.background = '#161B22';
                e.currentTarget.style.borderColor = '#484F58';
              }}
              onMouseLeave={(e) => {
                if (startingId) return;
                e.currentTarget.style.background = '#0D1117';
                e.currentTarget.style.borderColor = '#30363D';
              }}
            >
              <div className="flex items-start justify-between w-full mb-3">
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
                  <Icon size={13} style={{ color: '#58A6FF' }} />
                </div>
                {busy ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: '#58A6FF' }} />
                ) : (
                  <ArrowRight size={12} style={{ color: '#30363D' }} />
                )}
              </div>

              <div
                className="text-sm font-semibold mb-1 truncate max-w-full"
                style={{ color: '#F0F6FC' }}
              >
                {card.title}
              </div>

              {card.subtitle && (
                <p
                  className="text-xs leading-relaxed mb-2"
                  style={{
                    color: '#9CA3AF',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {card.subtitle}
                </p>
              )}

              {card.meta && (
                <div
                  className="font-mono text-2xs mt-auto pt-1"
                  style={{ color: '#484F58' }}
                >
                  {card.meta}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ContinueLearning;
