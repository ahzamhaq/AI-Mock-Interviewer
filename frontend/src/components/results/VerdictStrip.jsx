import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';

/**
 * VerdictStrip — the above-the-fold "did I do well? what next?" surface,
 * inserted between the hero and the existing score breakdown as part of
 * the Sprint 3 tiered layout.
 *
 * Three columns:
 *   • Top strength (first entry of results.strengths)
 *   • Top improvement (first entry of results.weaknesses)
 *   • Primary CTA — "Retry weakest question" — jumps into a new short
 *     interview seeded from the lowest-scored answered question of this
 *     one. If no question qualifies, the button falls back to "Practice
 *     again" which routes to /interviews.
 *
 * The full list of strengths/weaknesses remains below the fold in
 * ResultsPage. This strip is the fast-scan layer.
 *
 * Props:
 *   strengths     — [String]
 *   weaknesses    — [String]
 *   weakestIndex  — number | null. Passed in so the parent can decide
 *                   which question qualifies (needs userAnswer + score).
 *   onRetryWeakest— async () => void. Parent owns the retry call because
 *                   the retry API is scoped to interview id, which lives
 *                   on the parent.
 *   onPracticeAgain — () => void
 *   busy          — parent's "retry in flight" state
 */
const VerdictStrip = ({
  strengths = [],
  weaknesses = [],
  weakestIndex = null,
  onRetryWeakest,
  onPracticeAgain,
  busy = false,
}) => {
  const topStrength = strengths[0];
  const topImprovement = weaknesses[0];
  const hasWeakest = weakestIndex != null;

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* Strength */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(63,185,80,0.06)',
          border: '1px solid rgba(63,185,80,0.25)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: '#3FB950' }}>
          <CheckCircle size={12} /> strongest
        </div>
        {topStrength ? (
          <p className="text-sm leading-relaxed" style={{ color: '#F0F6FC' }}>
            {topStrength}
          </p>
        ) : (
          <p className="text-xs" style={{ color: '#6B7280' }}>
            No strengths identified yet.
          </p>
        )}
      </div>

      {/* Improvement */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(248,81,73,0.06)',
          border: '1px solid rgba(248,81,73,0.25)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: '#F85149' }}>
          <XCircle size={12} /> top improvement
        </div>
        {topImprovement ? (
          <p className="text-sm leading-relaxed" style={{ color: '#F0F6FC' }}>
            {topImprovement}
          </p>
        ) : (
          <p className="text-xs" style={{ color: '#6B7280' }}>
            No specific improvements suggested.
          </p>
        )}
      </div>

      {/* Primary CTA */}
      <div
        className="rounded-2xl p-4 flex flex-col"
        style={{
          background: 'rgba(88,166,255,0.06)',
          border: '1px solid rgba(88,166,255,0.25)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: '#58A6FF' }}>
          next step
        </div>
        {hasWeakest ? (
          <>
            <p className="text-sm leading-relaxed mb-3" style={{ color: '#F0F6FC' }}>
              Retry your weakest question and try again.
            </p>
            <button
              type="button"
              onClick={onRetryWeakest}
              disabled={busy}
              className="btn-accent flex items-center justify-center gap-1.5 px-3 py-2 text-xs mt-auto"
            >
              {busy ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Retry weakest question <ArrowRight size={11} />
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed mb-3" style={{ color: '#F0F6FC' }}>
              Ready for another round?
            </p>
            <button
              type="button"
              onClick={onPracticeAgain}
              className="btn-accent flex items-center justify-center gap-1.5 px-3 py-2 text-xs mt-auto"
            >
              Practice again <ArrowRight size={11} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default VerdictStrip;
