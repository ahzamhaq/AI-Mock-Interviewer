import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';

/**
 * DashboardHero — sub-toolbar with the workspace breadcrumb, session meta,
 * and the primary "New session" CTA. Extracted verbatim from DashboardPage.
 */
const DashboardHero = ({ userName, totalSessions, streak, points }) => {
  const navigate = useNavigate();
  const displayName = userName?.split(' ')[0]?.toLowerCase() || 'guest';

  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 lg:px-8"
      style={{ height: 40, borderBottom: '1px solid #21262D', background: '#161B22' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-2xs" style={{ color: '#484F58' }}>~/workspace</span>
        <span style={{ color: '#30363D' }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: '#F0F6FC' }}>
          {displayName}
        </span>
        <span className="font-mono text-2xs hidden md:inline" style={{ color: '#6B7280' }}>
          · {totalSessions} sessions · streak {streak}d · {points} pts
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/interviews')}
          className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Play size={11} /> New session
        </button>
      </div>
    </div>
  );
};

export default DashboardHero;
