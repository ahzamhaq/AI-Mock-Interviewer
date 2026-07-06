import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Plus, ChevronRight, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Panel, PanelHeader } from '../common/Panel';
import EmptyState from '../common/EmptyState';
import { projectsAPI } from '../../services/api';

/**
 * RecentProjects — Dashboard panel showing up to 5 most recently updated
 * projects. Reads directly from projectsAPI.list() so the parent Dashboard
 * doesn't need to know about the projects domain.
 *
 * The panel intentionally owns its own fetch (a small deviation from the
 * dashboard-page-owns-fetching pattern used elsewhere) because:
 *   1. Dashboard's existing analyticsAPI.getDashboard() doesn't include
 *      project data and shouldn't be extended for one widget.
 *   2. This panel is used only on the Dashboard today; centralizing the
 *      fetch would be premature abstraction.
 */
const RecentProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    projectsAPI.list()
      .then((res) => { if (alive) setProjects((res.projects || []).slice(0, 5)); })
      .catch(() => { if (alive) setProjects([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <Panel>
      <PanelHeader
        icon={GitBranch}
        label="recent projects"
        action={
          <Link to="/projects" className="font-mono text-2xs transition-colors" style={{ color: '#58A6FF' }}>
            all →
          </Link>
        }
      />
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={12} className="animate-spin" style={{ color: '#6B7280' }} />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            compact
            icon={GitBranch}
            title="No projects yet"
            description="Connect a repo to practice interviews grounded in your code."
            action={
              <button
                type="button"
                onClick={() => navigate('/projects/new')}
                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus size={11} /> Analyze repository
              </button>
            }
          />
        ) : (
          <div>
            {projects.map((p, i) => {
              const processing = p.analysisStatus === 'processing';
              return (
                <motion.button
                  key={p._id}
                  onClick={() =>
                    navigate(processing ? `/projects/${p._id}/analyzing` : `/projects/${p._id}`)
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
                  style={{ borderBottom: '1px solid #161B22', background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <GitBranch size={11} style={{ color: '#58A6FF', flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: '#F0F6FC' }}>
                      {p.repoOwner}/{p.repoName}
                    </div>
                    <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                      {processing ? 'analyzing…' : (p.updatedAt
                        ? formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })
                        : '—')}
                      {p.metadata?.language && (
                        <>
                          <span style={{ color: '#30363D' }}> · </span>
                          <span style={{ color: '#6B7280' }}>{p.metadata.language}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={11} style={{ color: '#30363D', flexShrink: 0, marginTop: 2 }} />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
};

export default RecentProjects;
