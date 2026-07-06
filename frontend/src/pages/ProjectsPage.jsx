import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, Loader2 } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import ProjectCard from '../components/projects/ProjectCard';
import { projectsAPI } from '../services/api';

/**
 * ProjectsPage — real list backed by projectsAPI.list(). Sprint 1's
 * placeholder preview grid is retired; the empty state remains for users
 * with zero projects. Any project whose latest analysis is still
 * `processing` renders with a live "analyzing" chip on the card.
 */
const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    projectsAPI.list()
      .then((res) => { if (alive) setProjects(res.projects || []); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const startAnalyze = () => navigate('/projects/new');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <SectionHeader
            eyebrow="projects"
            title="Your projects"
            subtitle="Practice interviews grounded in your real code."
            action={
              <button
                type="button"
                onClick={startAnalyze}
                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus size={11} /> Analyze repository
              </button>
            }
          />

          {loading && (
            <div
              className="flex items-center justify-center py-10"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
              <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>loading…</span>
            </div>
          )}

          {!loading && error && (
            <div
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <EmptyState
                icon={GitBranch}
                title="Couldn't load projects"
                description={error}
              />
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <EmptyState
                icon={GitBranch}
                title="No projects yet"
                description="Connect a GitHub repository to unlock project-grounded interviews and future workspace features."
                action={
                  <button
                    type="button"
                    onClick={startAnalyze}
                    className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <Plus size={11} /> Analyze repository
                  </button>
                }
              />
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
