import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import ProjectPlaceholderCard from '../components/projects/ProjectPlaceholderCard';

/**
 * PLACEHOLDER_PROJECTS — ghost cards previewing the future layout. Marked as
 * previews (dashed border, muted, aria-hidden inside the card) so users don't
 * mistake them for real data. When the Projects list ships in Sprint 2, this
 * page will read connected repos from the API and drop the placeholders.
 */
const PLACEHOLDER_PROJECTS = [
  { title: 'frontend-monorepo', language: 'TypeScript', meta: 'preview · not connected' },
  { title: 'api-gateway',       language: 'Go',         meta: 'preview · not connected' },
  { title: 'ml-experiments',    language: 'Python',     meta: 'preview · not connected' },
];

const ProjectsPage = () => {
  const navigate = useNavigate();

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

          {/* Empty state — primary surface today. Replaces with a real list in
              Sprint 2 once the GitHub integration lands. */}
          <div
            className="mb-6"
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

          {/* Preview grid — ghost cards demonstrating the future layout. */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-mono text-2xs uppercase tracking-wide"
              style={{ color: '#6B7280' }}
            >
              preview · layout
            </span>
            <span
              className="font-mono text-2xs"
              style={{ color: '#484F58' }}
            >
              {'// how connected repos will appear'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLACEHOLDER_PROJECTS.map((p) => (
              <ProjectPlaceholderCard
                key={p.title}
                title={p.title}
                language={p.language}
                meta={p.meta}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
