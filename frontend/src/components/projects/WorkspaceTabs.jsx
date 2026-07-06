import React from 'react';

/**
 * WorkspaceTabs — tab strip for the Workspace shell.
 *
 * Sprint 2 ships Overview as the only real tab. The reserved-tab philosophy
 * from Sprint 1 applies here too: tabs that aren't shippable are NOT
 * rendered. Later sprints add tabs by extending the `tabs` array.
 *
 * Props:
 *   tabs      — [{ id, label, disabled? }]
 *   activeId  — currently active tab id
 *   onSelect  — (id) => void
 */
const WorkspaceTabs = ({ tabs, activeId, onSelect }) => (
  <div
    className="flex items-center gap-px overflow-x-auto"
    style={{ borderBottom: '1px solid #21262D' }}
  >
    {tabs.map((t) => {
      const active = t.id === activeId;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => !t.disabled && onSelect(t.id)}
          disabled={t.disabled}
          className="relative px-3 py-2 text-xs font-medium transition-colors flex-shrink-0"
          style={{
            color: active ? '#F0F6FC' : t.disabled ? '#484F58' : '#9CA3AF',
            background: 'transparent',
            border: 'none',
            cursor: t.disabled ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!active && !t.disabled) e.currentTarget.style.color = '#F0F6FC';
          }}
          onMouseLeave={(e) => {
            if (!active && !t.disabled) e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          {t.label}
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
        </button>
      );
    })}
  </div>
);

export default WorkspaceTabs;
