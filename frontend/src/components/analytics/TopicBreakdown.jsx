import React from 'react';

/**
 * TopicBreakdown — weak-topic list with score bars. Extracted so the same
 * visual can be used on Profile (all-time weak topics) and Dashboard
 * (right-rail widget — will be swapped over in a later commit).
 *
 * Score coloring matches the app-wide convention:
 *   >= 8   green   (#3FB950)
 *   >= 6   amber   (#D29922)
 *    < 6   red     (#F85149)
 *
 * Props:
 *   items    — [{ topic, avgScore, attempts }]
 *   emptyText — copy shown when items is empty
 */
const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const TopicBreakdown = ({ items = [], emptyText = 'No weak topics tracked yet.' }) => {
  if (!items.length) {
    return (
      <p className="text-xs" style={{ color: '#6B7280' }}>
        {emptyText}
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((wt, i) => (
        <div key={`${wt.topic}-${i}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs truncate" style={{ color: '#F0F6FC' }}>
              {wt.topic}
            </span>
            <span
              className="font-mono text-2xs"
              style={{ color: SCORE_COLOR(wt.avgScore) }}
            >
              {Number(wt.avgScore || 0).toFixed(1)}
            </span>
          </div>
          <div className="h-0.5 rounded" style={{ background: '#21262D' }}>
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(0, Math.min(100, ((wt.avgScore || 0) / 10) * 100))}%`,
                background: SCORE_COLOR(wt.avgScore),
              }}
            />
          </div>
          {typeof wt.attempts === 'number' && (
            <div className="font-mono text-2xs mt-1" style={{ color: '#484F58' }}>
              {wt.attempts} attempts
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TopicBreakdown;
