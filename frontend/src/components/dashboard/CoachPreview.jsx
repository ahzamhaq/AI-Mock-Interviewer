import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import SectionHeader from '../common/SectionHeader';
import FocusAreaCard from '../coach/FocusAreaCard';
import { coachAPI } from '../../services/api';

/**
 * CoachPreview — the Dashboard's Coach surface. Shows the single highest-
 * priority focus area from the roadmap, above the Continue Learning rail.
 *
 * Design-review mandate: the Dashboard answers one question — "what should
 * I do next?" Coach IS that answer; forcing users to navigate to the Coach
 * page to see it hides the value. The preview surfaces the top item; the
 * full 3–5 item roadmap remains one click away.
 *
 * The preview renders NOTHING when:
 *   • the roadmap fetch fails
 *   • the roadmap is empty
 *   • the fetch is still loading (quiet — matches ContinueLearning rail
 *     philosophy: optional chrome doesn't get skeleton blocks)
 */
const CoachPreview = () => {
  const [item, setItem] = useState(null);

  useEffect(() => {
    let alive = true;
    coachAPI.getRoadmap()
      .then((res) => {
        if (!alive) return;
        const items = res?.roadmap?.items || [];
        // Pick the highest-priority item; ties broken by array order (the
        // service already returns items in a sensible order).
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const sorted = [...items].sort(
          (a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1),
        );
        setItem(sorted[0] || null);
      })
      .catch(() => { if (alive) setItem(null); });
    return () => { alive = false; };
  }, []);

  if (!item) return null;

  return (
    <div className="mb-4">
      <SectionHeader
        eyebrow="coach"
        title="Top focus for today"
        action={
          <Link
            to="/coach"
            className="inline-flex items-center gap-1 font-mono text-2xs transition-colors"
            style={{ color: '#58A6FF' }}
          >
            <Compass size={10} /> full roadmap <ArrowRight size={9} />
          </Link>
        }
      />
      <FocusAreaCard item={item} dense />
    </div>
  );
};

export default CoachPreview;
