import React from 'react';
import { Link } from 'react-router-dom';

/**
 * WorkspaceTabs — tab strip for the Workspace shell.
 *
 * Sprint 2 ships Overview as the only real tab. The reserved-tab philosophy
 * from Sprint 1 applies here too: tabs that aren't shippable are NOT
 * rendered. Later sprints add tabs by extending the `tabs` array.
 *
 * Sprint 6 Commit 1: added optional `href` on a tab entry. When present
 * the tab renders as a react-router Link (navigates away from the
 * Workspace shell) instead of an in-page state toggle. Used for Chat,
 * which lives at its own /projects/:id/chat route rather than being a
 * tabbed panel inside WorkspacePage.
 *
 * Props:
 *   tabs      — [{ id, label, disabled?, href?, badge? }]
 *   activeId  — currently active tab id (in-page tabs only)
 *   onSelect  — (id) => void (called only for in-page tabs)
 */
const WorkspaceTabs = ({ tabs, activeId, onSelect }) => (
  <div
    className="flex items-center gap-px overflow-x-auto"
    style={{ borderBottom: '1px solid #21262D' }}
  >
    {tabs.map((t) => {
      const active = t.id === activeId;
      const baseClass = 'relative px-3 py-2 text-xs font-medium transition-colors flex-shrink-0 inline-flex items-center gap-1.5';
      const baseStyle = {
        color: active ? '#F0F6FC' : t.disabled ? '#484F58' : '#9CA3AF',
        background: 'transparent',
        border: 'none',
        cursor: t.disabled ? 'not-allowed' : 'pointer',
        textDecoration: 'none',
      };
      const hoverEnter = (e) => {
        if (!active && !t.disabled) e.currentTarget.style.color = '#F0F6FC';
      };
      const hoverLeave = (e) => {
        if (!active && !t.disabled) e.currentTarget.style.color = '#9CA3AF';
      };
      const inner = (
        <>
          <span>{t.label}</span>
          {t.badge}
          {active && (
            <span
              className="absolute left-2 right-2"
              style={{
                bottom: -1,
                height: 2,
                background: '#58A6FF',
                borderRadius: '2px 2px 0 0',
              }}
            />
          )}
        </>
      );

      // Nav-style tab — renders a Link that navigates elsewhere. Used
      // for tabs whose destination is a separate route (e.g. Chat).
      if (t.href && !t.disabled) {
        return (
          <Link
            key={t.id}
            to={t.href}
            className={baseClass}
            style={baseStyle}
            onMouseEnter={hoverEnter}
            onMouseLeave={hoverLeave}
          >
            {inner}
          </Link>
        );
      }

      // Default in-page tab.
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => !t.disabled && onSelect(t.id)}
          disabled={t.disabled}
          className={baseClass}
          style={baseStyle}
          onMouseEnter={hoverEnter}
          onMouseLeave={hoverLeave}
        >
          {inner}
        </button>
      );
    })}
  </div>
);

export default WorkspaceTabs;
