import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play, ChevronRight, Loader2, Mic,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Panel, PanelHeader } from '../common/Panel';
import EmptyState from '../common/EmptyState';

/**
 * InterviewsTab — full-width past-project-interviews list. Promoted from
 * the Sprint-2 Overview right-rail widget so it can breathe: full row per
 * session with score + focus + duration + relative date + link chevron.
 *
 * Data source (sessions[]) is the same the Overview used — the parent still
 * owns fetching and filtering. This tab is presentation-only.
 *
 * Props:
 *   sessions        — filtered Interview docs (already scoped to this project)
 *   sessionsLoaded  — parent's fetch-completed flag
 *   analysisReady   — analysis.status === 'ready' (gates the CTA)
 *   projectId       — for navigation on the "Start new" CTA
 */
const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const InterviewsTab = ({ sessions = [], sessionsLoaded, analysisReady, projectId }) => {
  const navigate = useNavigate();

  return (
    <div className="mt-4 flex flex-col gap-3">

      {/* Header + CTA. Deliberately outside the Panel so the CTA has room
          to breathe and doesn't fight the PanelHeader's action slot. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div
            className="font-mono text-2xs uppercase tracking-wide"
            style={{ color: '#6B7280' }}
          >
            project interviews
          </div>
          <div className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
            {sessionsLoaded
              ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}`
              : 'loading…'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}/interview/setup`)}
          disabled={!analysisReady}
          className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap"
          title={!analysisReady ? 'Analysis must complete first' : undefined}
        >
          <Play size={11} /> Start new interview
        </button>
      </div>

      <Panel>
        {!sessionsLoaded ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={14} className="animate-spin" style={{ color: '#6B7280' }} />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No interviews yet"
            description="Start your first project interview to see it here."
            action={
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/interview/setup`)}
                disabled={!analysisReady}
                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Play size={11} /> Start first interview
              </button>
            }
          />
        ) : (
          <div>
            {sessions.map((s, i) => {
              const subMode = s.config?.projectMode?.subMode?.replace('_', ' ') || 'project interview';
              const diff = s.config?.difficulty;
              return (
                <motion.button
                  key={s._id}
                  onClick={() => navigate(`/interview/${s._id}/results`)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 15) * 0.02 }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid #161B22',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      background: '#0D1117',
                      border: `1px solid ${SCORE_COLOR(s.results?.overallScore)}30`,
                      borderRadius: 6,
                    }}
                  >
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: SCORE_COLOR(s.results?.overallScore) }}
                    >
                      {s.results?.overallScore?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#F0F6FC' }}>
                      {subMode}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
                        {s.completedAt
                          ? formatDistanceToNow(new Date(s.completedAt), { addSuffix: true })
                          : 'in progress'}
                      </span>
                      {diff && (
                        <span
                          className="font-mono text-2xs px-1.5 py-0.5"
                          style={{
                            background: '#0D1117',
                            border: '1px solid #30363D',
                            borderRadius: 3,
                            color: '#6B7280',
                          }}
                        >
                          {diff}
                        </span>
                      )}
                      {typeof s.duration === 'number' && s.duration > 0 && (
                        <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                          {Math.floor(s.duration / 60)}m {s.duration % 60}s
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={13}
                    style={{ color: '#30363D', flexShrink: 0, marginTop: 12 }}
                  />
                </motion.button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default InterviewsTab;
