import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, GitCommit, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Panel, PanelHeader } from '../common/Panel';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

/**
 * RecentInterviews — extracted from DashboardPage's left panel. JSX and data
 * shape preserved verbatim so behavior is identical.
 */
const RecentInterviews = ({ interviews }) => {
  const navigate = useNavigate();

  return (
    <Panel>
      <PanelHeader
        icon={GitCommit}
        label="recent sessions"
        action={
          <Link to="/history" className="font-mono text-2xs transition-colors" style={{ color: '#58A6FF' }}>
            all →
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {interviews?.length > 0 ? (
          <div>
            {interviews.slice(0, 12).map((iv, i) => (
              <motion.button
                key={iv._id}
                onClick={() => navigate(`/interview/${iv._id}/results`)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
                style={{ borderBottom: '1px solid #161B22', background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="font-mono text-2xs flex-shrink-0 mt-0.5"
                  style={{ color: SCORE_COLOR(iv.results?.overallScore), width: 28 }}
                >
                  {iv.results?.overallScore?.toFixed(1) ?? '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" style={{ color: '#F0F6FC' }}>
                    {iv.title}
                  </div>
                  <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                    {formatDistanceToNow(new Date(iv.completedAt), { addSuffix: true })}
                    <span style={{ color: '#30363D' }}> · </span>
                    <span style={{ color: '#6B7280' }}>{iv.config?.interviewType}</span>
                  </div>
                </div>
                <ChevronRight size={11} style={{ color: '#30363D', flexShrink: 0, marginTop: 2 }} />
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Mic size={20} style={{ color: '#30363D' }} className="mx-auto mb-3" />
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>No sessions yet</p>
            <button onClick={() => navigate('/interviews')} className="btn-accent text-xs px-3 py-1.5">
              Start first session
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
};

export default RecentInterviews;
