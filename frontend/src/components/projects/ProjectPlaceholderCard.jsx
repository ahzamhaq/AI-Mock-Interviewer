import React from 'react';
import { GitBranch, Lock } from 'lucide-react';

/**
 * ProjectPlaceholderCard — ghost card shown on the Projects page before any
 * repositories are connected. Communicates the future layout of a real repo
 * card (name, language, meta) without implying fake data.
 *
 * Deliberately non-interactive and visually muted so it reads as a preview,
 * not a broken/empty card.
 *
 * Props:
 *   title    – ghost repo name (e.g. "your-repo-name")
 *   language – ghost language chip label
 *   meta     – ghost meta line
 */
const ProjectPlaceholderCard = ({
  title = 'your-repo-name',
  language = 'TypeScript',
  meta = 'connect a repo to populate',
}) => (
  <div
    className="p-4 relative overflow-hidden"
    style={{
      background: '#0D1117',
      border: '1px dashed #30363D',
      borderRadius: 6,
      opacity: 0.75,
    }}
    aria-hidden
  >
    <div className="flex items-start justify-between mb-3">
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
      >
        <GitBranch size={13} style={{ color: '#484F58' }} />
      </div>
      <Lock size={11} style={{ color: '#484F58' }} />
    </div>

    <div
      className="text-xs font-medium mb-1 truncate"
      style={{ color: '#6B7280' }}
    >
      {title}
    </div>

    <div className="flex items-center gap-2 font-mono text-2xs" style={{ color: '#484F58' }}>
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5"
        style={{
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 3,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#484F58' }}
        />
        {language}
      </span>
      <span>·</span>
      <span className="truncate">{meta}</span>
    </div>
  </div>
);

export default ProjectPlaceholderCard;
