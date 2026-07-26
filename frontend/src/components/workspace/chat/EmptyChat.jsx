import React from 'react';
import { MessageSquare, Sparkles, Code2, GitBranch, HelpCircle, Layers } from 'lucide-react';

/**
 * EmptyChat — landing surface shown inside the chat window when no chat
 * is selected. Sprint 6 Commit 6 patch: capability rows are clickable
 * shortcuts. Clicking one asks the parent to create a new chat and
 * seed it with the corresponding prompt.
 *
 * When `onQuickStart` is not provided, rows render as static chips
 * (backward-compatible fallback).
 *
 * Props:
 *   onQuickStart(prompt) — optional; wires the row click through the
 *                          parent's "create chat + send" flow.
 */

const CAPABILITIES = [
  { icon: GitBranch,     label: 'Explain repository architecture', prompt: 'Explain the project architecture.' },
  { icon: Code2,         label: 'Ask coding questions',            prompt: 'How is a specific piece of this project implemented? Start with the most important module.' },
  { icon: HelpCircle,    label: 'Generate interview questions',    prompt: 'Generate five interview questions grounded in this codebase.' },
  { icon: Layers,        label: 'Review implementation',           prompt: 'Review this repository\'s implementation and highlight anything that stands out.' },
  { icon: MessageSquare, label: 'Explore project structure',       prompt: 'Walk me through the folder structure of this project.' },
];

const EmptyChat = ({ onQuickStart }) => {
  const interactive = typeof onQuickStart === 'function';

  return (
    <div className="flex flex-col items-center justify-center text-center h-full py-10 px-4">
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 48,
          height: 48,
          background: '#0D1117',
          border: '1px solid #30363D',
          borderRadius: 10,
        }}
      >
        <Sparkles size={20} style={{ color: '#D29922' }} />
      </div>

      <div
        className="font-mono text-2xs uppercase tracking-wide mb-1"
        style={{ color: '#58A6FF' }}
      >
        Workspace Chat
      </div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: '#F0F6FC' }}>
        Repository-aware AI Chat
      </h2>
      <p
        className="text-xs leading-relaxed max-w-sm mb-6"
        style={{ color: '#9CA3AF' }}
      >
        {interactive
          ? 'Pick one to start a new chat, or select an existing one on the left.'
          : 'Select a chat on the left or start a new one. Answers are grounded in this repository’s analysis.'}
      </p>

      <ul className="flex flex-col gap-2 w-full max-w-sm">
        {CAPABILITIES.map((c) => {
          const RowIcon = c.icon;
          if (interactive) {
            return (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => onQuickStart(c.prompt)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                  style={{
                    background: '#0D1117',
                    border: '1px solid #30363D',
                    borderRadius: 6,
                    color: '#F0F6FC',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#161B22';
                    e.currentTarget.style.borderColor = '#484F58';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#0D1117';
                    e.currentTarget.style.borderColor = '#30363D';
                  }}
                >
                  <RowIcon size={12} style={{ color: '#58A6FF', flexShrink: 0 }} />
                  <span className="text-xs">{c.label}</span>
                </button>
              </li>
            );
          }
          return (
            <li
              key={c.label}
              className="flex items-center gap-2 px-3 py-2"
              style={{
                background: '#0D1117',
                border: '1px dashed #30363D',
                borderRadius: 6,
                color: '#9CA3AF',
              }}
            >
              <RowIcon size={12} style={{ color: '#58A6FF', flexShrink: 0 }} />
              <span className="text-xs text-left">{c.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EmptyChat;
