import React from 'react';

/**
 * EmptyState — shared empty-state block used inside Panels and page sections
 * that have no data yet (e.g. Recent Projects on Dashboard, Projects page).
 *
 * Follows the existing empty-state pattern already used in DashboardPage's
 * "No sessions yet" block: muted icon + short copy + single primary CTA.
 *
 * Props:
 *   icon    – Lucide icon component
 *   title   – short headline
 *   description – supporting copy
 *   action  – optional CTA node (button/link)
 *   compact – tighter padding for in-panel usage
 */
const EmptyState = ({ icon: Icon, title, description, action, compact = false }) => (
  <div
    className="flex flex-col items-center justify-center text-center"
    style={{ padding: compact ? '24px 16px' : '48px 24px' }}
  >
    {Icon && (
      <div
        className="flex items-center justify-center mb-3"
        style={{
          width: compact ? 32 : 44,
          height: compact ? 32 : 44,
          background: '#0D1117',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
      >
        <Icon size={compact ? 14 : 18} style={{ color: '#484F58' }} />
      </div>
    )}
    {title && (
      <p
        className="text-xs font-medium mb-1"
        style={{ color: '#F0F6FC' }}
      >
        {title}
      </p>
    )}
    {description && (
      <p
        className="text-xs leading-relaxed max-w-xs mb-3"
        style={{ color: '#6B7280' }}
      >
        {description}
      </p>
    )}
    {action}
  </div>
);

export default EmptyState;
