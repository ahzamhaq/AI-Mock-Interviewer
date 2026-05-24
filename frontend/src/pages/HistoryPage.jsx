import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, Clock, ChevronRight, Calendar, GitCommit } from 'lucide-react';
import { interviewAPI } from '../services/api';
import Navbar from '../components/layout/Navbar';
import { format, formatDistanceToNow } from 'date-fns';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const HistoryPage = () => {
  const [interviews, setInterviews] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    interviewAPI.getHistory({ page, limit: 15 })
      .then(res => {
        setInterviews(res.interviews || []);
        setPagination(res.pagination || {});
      })
      .catch(err => console.error('History fetch failed:', err))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        {/* Sub-toolbar */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 lg:px-8"
          style={{ height: 40, borderBottom: '1px solid #21262D', background: '#161B22' }}
        >
          <div className="flex items-center gap-2">
            <GitCommit size={12} style={{ color: '#6B7280' }} />
            <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
              session history
            </span>
            {!loading && (
              <span className="font-mono text-2xs" style={{ color: '#484F58' }}>
                · {pagination.total || 0} completed
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/interview/setup')}
            className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <Mic size={11} /> New session
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <motion.div
                className="w-6 h-6 rounded-full"
                style={{ border: '2px solid #21262D', borderTopColor: '#58A6FF' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : interviews.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24"
              style={{ border: '1px solid #21262D', borderRadius: 6, background: '#161B22' }}
            >
              <Mic size={28} style={{ color: '#30363D' }} className="mb-4" />
              <p className="text-sm font-medium mb-1" style={{ color: '#F0F6FC' }}>No sessions yet</p>
              <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
                Complete your first interview to see history here
              </p>
              <button
                onClick={() => navigate('/interview/setup')}
                className="btn-accent text-xs px-4 py-2"
              >
                Start first session
              </button>
            </div>
          ) : (
            <>
              <div
                style={{ border: '1px solid #30363D', borderRadius: 6, overflow: 'hidden' }}
              >
                {interviews.map((iv, i) => (
                  <motion.button
                    key={iv._id}
                    onClick={() => navigate(`/interview/${iv._id}/results`)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      borderBottom: i < interviews.length - 1 ? '1px solid #21262D' : 'none',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < interviews.length - 1 ? '1px solid #21262D' : 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#161B22'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Score */}
                    <span
                      className="font-mono text-sm font-bold flex-shrink-0 w-10 text-right"
                      style={{ color: SCORE_COLOR(iv.results?.overallScore) }}
                    >
                      {iv.results?.overallScore?.toFixed(1) ?? '—'}
                    </span>

                    {/* Grade */}
                    <span
                      className="font-mono text-xs font-bold flex-shrink-0 w-6 text-center"
                      style={{ color: SCORE_COLOR(iv.results?.overallScore) }}
                    >
                      {iv.results?.grade || '—'}
                    </span>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: '#F0F6FC' }}>
                        {iv.title}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="font-mono text-2xs flex items-center gap-1" style={{ color: '#484F58' }}>
                          <Calendar size={10} />
                          {format(new Date(iv.completedAt), 'dd MMM yyyy')}
                        </span>
                        {iv.duration != null && (
                          <span className="font-mono text-2xs flex items-center gap-1" style={{ color: '#484F58' }}>
                            <Clock size={10} />
                            {Math.floor(iv.duration / 60)}m {iv.duration % 60}s
                          </span>
                        )}
                        {iv.config?.interviewType && (
                          <span
                            className="font-mono text-2xs px-1.5 py-0.5 rounded"
                            style={{ background: '#21262D', color: '#6B7280', border: '1px solid #30363D' }}
                          >
                            {iv.config.interviewType}
                          </span>
                        )}
                        {iv.config?.role && (
                          <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
                            {iv.config.role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="font-mono text-2xs flex-shrink-0" style={{ color: '#484F58' }}>
                      {formatDistanceToNow(new Date(iv.completedAt), { addSuffix: true })}
                    </span>

                    <ChevronRight size={14} style={{ color: '#30363D', flexShrink: 0 }} />
                  </motion.button>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-center gap-1.5 pt-5">
                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className="font-mono text-xs transition-colors"
                      style={{
                        width: 32, height: 32, borderRadius: 4, border: '1px solid',
                        borderColor: page === i + 1 ? '#58A6FF' : '#30363D',
                        background: page === i + 1 ? 'rgba(88,166,255,0.1)' : 'transparent',
                        color: page === i + 1 ? '#58A6FF' : '#6B7280',
                        cursor: 'pointer',
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
