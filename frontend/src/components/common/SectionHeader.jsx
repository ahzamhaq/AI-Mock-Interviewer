import React from 'react';

/**
 * SectionHeader — page-level section title used above content blocks on the
 * Dashboard, Interviews, and Projects pages. Complements PanelHeader (which
 * lives inside a Panel) by providing the higher-level heading rhythm.
 *
 * Props:
 *   eyebrow – optional short uppercase mono label above the title
 *   title   – section title
 *   subtitle – optional supporting copy
 *   action  – optional right-aligned action node (link, button)
 */
const SectionHeader = ({ eyebrow, title, subtitle, action }) => (
  <div className="flex items-end justify-between gap-4 mb-3">
    <div className="min-w-0">
      {eyebrow && (
        <div
          className="font-mono text-2xs uppercase tracking-wide mb-1"
          style={{ color: '#6B7280' }}
        >
          {eyebrow}
        </div>
      )}
      <h2
        className="text-base sm:text-lg font-semibold truncate"
        style={{ color: '#F0F6FC' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-xs mt-0.5"
          style={{ color: '#9CA3AF' }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

export default SectionHeader;
