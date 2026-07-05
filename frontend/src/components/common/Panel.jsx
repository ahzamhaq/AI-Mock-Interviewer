import React from 'react';

/**
 * Panel — canonical bordered surface used across the dashboard workspace.
 * Extracted from DashboardPage where it previously lived inline. All existing
 * consumers keep identical visual output.
 */
export const Panel = ({ children, className = '' }) => (
  <div
    className={`flex flex-col overflow-hidden ${className}`}
    style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
  >
    {children}
  </div>
);

/**
 * PanelHeader — icon + uppercase mono label + optional action, sitting on the
 * top edge of a Panel. Matches the existing header used throughout the app.
 */
export const PanelHeader = ({ icon: Icon, label, action }) => (
  <div
    className="flex items-center justify-between px-3 py-2 flex-shrink-0"
    style={{ borderBottom: '1px solid #21262D', background: '#161B22' }}
  >
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={12} style={{ color: '#6B7280' }} />}
      <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
        {label}
      </span>
    </div>
    {action}
  </div>
);

export default Panel;
