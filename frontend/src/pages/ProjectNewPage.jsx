import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GitBranch } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';

/**
 * ProjectNewPage — Sprint-2 placeholder. Users routed here from the Interviews
 * entry page (Project Interview option) and from the Projects page CTA. The
 * routing is finalized in Sprint 1; the flow itself ships in Sprint 2.
 */
const ProjectNewPage = () => (
  <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
    <Navbar />
    <div className="flex-1 pt-12">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
        <SectionHeader
          eyebrow="projects · new"
          title="Analyze a repository"
          subtitle="Connect a GitHub repo to generate a project-grounded interview."
          action={
            <Link
              to="/projects"
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
            >
              <ArrowLeft size={12} /> Back to projects
            </Link>
          }
        />
        <div
          style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
        >
          <EmptyState
            icon={GitBranch}
            title="Project Analysis · coming in Sprint 2"
            description="GitHub repository analysis and project-grounded interviews land in the next sprint. The entry flow is in place; the analysis pipeline is next."
          />
        </div>
      </div>
    </div>
  </div>
);

export default ProjectNewPage;
