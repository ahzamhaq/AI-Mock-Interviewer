import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Compass, RefreshCw, Loader2, Sparkles, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import FocusAreaCard from '../components/coach/FocusAreaCard';
import { coachAPI } from '../services/api';

/**
 * CoachPage — the top-level "what should I do next?" surface. Reads the
 * cached-or-fresh roadmap from GET /coach/roadmap and renders 3–5 focus
 * areas. The refresh button forces regeneration via POST /roadmap/refresh
 * (bypasses the 24h cache).
 *
 * Every action button dispatches through the shared resolveAction helper
 * — same code path as the Continue Learning rail — so nothing new to wire
 * here for navigation.
 */
const CoachPage = () => {
  const [roadmap, setRoadmap] = useState(null); // { items, generatedAt, cached }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async ({ force = false } = {}) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = force ? await coachAPI.refresh() : await coachAPI.getRoadmap();
      setRoadmap(res.roadmap);
    } catch (err) {
      setError(err.message || 'Could not load your roadmap.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = roadmap?.items || [];
  const generatedAt = roadmap?.generatedAt ? new Date(roadmap.generatedAt) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1000px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          <SectionHeader
            eyebrow="coach"
            title="Your focus areas"
            subtitle="A personalized plan based on your interviews, weak topics, and projects."
            action={
              <div className="flex items-center gap-2 flex-wrap">
                {generatedAt && (
                  <span
                    className="inline-flex items-center gap-1 font-mono text-2xs"
                    style={{ color: '#484F58' }}
                  >
                    <Sparkles size={9} /> {roadmap?.cached ? 'cached · ' : ''}
                    updated {formatDistanceToNow(generatedAt, { addSuffix: true })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => load({ force: true })}
                  disabled={loading || refreshing}
                  className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Regenerating…' : 'Refresh'}
                </button>
              </div>
            }
          />

          {loading && !refreshing && (
            <div
              className="flex items-center justify-center py-16"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
              <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>
                composing your roadmap…
              </span>
            </div>
          )}

          {!loading && error && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load your roadmap"
                description={error}
                action={
                  <button
                    type="button"
                    onClick={() => load()}
                    className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <RefreshCw size={11} /> Try again
                  </button>
                }
              />
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={Compass}
                title="Your Coach is ready"
                description="Complete an interview and connect a project to unlock personalized focus areas."
              />
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {items.map((it, i) => (
                <FocusAreaCard key={`${i}-${it.title}`} item={it} />
              ))}
            </motion.div>
          )}

          <p
            className="font-mono text-2xs mt-4"
            style={{ color: '#484F58' }}
          >
            {'// roadmap regenerates every 24h · refresh anytime'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoachPage;
