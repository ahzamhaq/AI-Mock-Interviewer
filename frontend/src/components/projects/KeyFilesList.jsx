import React from 'react';
import { FileCode } from 'lucide-react';

/**
 * KeyFilesList — the list of files that shaped the analysis, each with the
 * short "purpose" the LLM assigned. Presented as a compact monospace list
 * so it reads like a file explorer, not a card grid.
 *
 * Props:
 *   items — [{ path, purpose, size }]
 */
const KeyFilesList = ({ items = [] }) => {
  if (!items.length) {
    return (
      <p className="text-xs" style={{ color: '#6B7280' }}>
        No key files identified.
      </p>
    );
  }
  return (
    <ul>
      {items.map((f, i) => (
        <li
          key={f.path}
          className="flex items-start gap-2 px-2 py-1.5"
          style={{
            borderTop: i === 0 ? 'none' : '1px solid #161B22',
          }}
        >
          <FileCode
            size={11}
            style={{ color: '#58A6FF', flexShrink: 0, marginTop: 3 }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="font-mono text-xs truncate"
              style={{ color: '#F0F6FC' }}
              title={f.path}
            >
              {f.path}
            </div>
            {f.purpose && (
              <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {f.purpose}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default KeyFilesList;
