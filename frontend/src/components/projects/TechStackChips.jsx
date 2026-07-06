import React from 'react';

/**
 * TechStackChips — flat list of detected technologies rendered as chips.
 * Uses the same chip visual language already established elsewhere (badge
 * with a hairline border on #0D1117). Category becomes a subtle prefix so
 * the eye can scan groupings without needing colored variants.
 *
 * Props:
 *   items — [{ name, category, confidence }]
 */
const TechStackChips = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={`${t.category}:${t.name}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-2xs"
          style={{
            color: '#F0F6FC',
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 3,
          }}
          title={`${t.category} · ${(t.confidence * 100).toFixed(0)}% confidence`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#58A6FF' }}
          />
          {t.name}
        </span>
      ))}
    </div>
  );
};

export default TechStackChips;
