import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GitBranch, Plus } from 'lucide-react';
import { Panel, PanelHeader } from '../common/Panel';
import EmptyState from '../common/EmptyState';

/**
 * RecentProjects — Sprint-1 placeholder. Real project data lands in Sprint 2;
 * today this surface reserves its position on the dashboard and offers a
 * discoverable entry point to the Projects module.
 */
const RecentProjects = ({ projects = [] }) => {
  const navigate = useNavigate();

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
        {projects.length > 0 ? (
          <div>
            {/* Real project rows will render here when the API ships in Sprint 2. */}
          </div>
        ) : (
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
        )}
      </div>
    </Panel>
  );
};

export default RecentProjects;
