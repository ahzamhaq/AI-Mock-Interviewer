import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Panel, PanelHeader } from '../common/Panel';

/**
 * ContinueWorking — "resume where you left off" surface. Uses the most recent
 * interview from the dashboard payload. Renders nothing when there is no
 * prior session; the Primary Actions and Recent Interviews sections handle
 * the empty case elsewhere on the page.
 */
const ContinueWorking = ({ lastInterview }) => {
  const navigate = useNavigate();
  if (!lastInterview) return null;

  const when = lastInterview.completedAt
    ? formatDistanceToNow(new Date(lastInterview.completedAt), { addSuffix: true })
    : '—';

  return (
    <Panel>
      <PanelHeader icon={Play} label="continue where you left off" />
      <motion.button
        onClick={() => navigate(`/interview/${lastInterview._id}/results`)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 px-3 py-3 text-left transition-colors w-full"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        >
          <Play size={13} style={{ color: '#58A6FF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: '#F0F6FC' }}>
            {lastInterview.title}
          </div>
          <div className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
            {when}
            {lastInterview.config?.interviewType && (
              <>
                <span style={{ color: '#30363D' }}> · </span>
                <span>{lastInterview.config.interviewType}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={12} style={{ color: '#484F58' }} />
      </motion.button>
    </Panel>
  );
};

export default ContinueWorking;
