import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GitBranch } from 'lucide-react';
import ActionCard from '../common/ActionCard';
import SectionHeader from '../common/SectionHeader';
import { projectsAPI } from '../../services/api';

/**
 * PrimaryActions — "What would you like to do today?" row. Two equally
 * weighted ActionCards routing to General Interview and Project Interview.
 *
 * The Project card's destination depends on whether the user has any
 * projects yet: existing users land on the list, new users go straight to
 * the create flow so their first touch isn't an empty page. Mirrors the
 * same logic on InterviewsPage.
 */
const ACTIONS = [
  {
    id: 'general',
    icon: Mic,
    eyebrow: 'interview · general',
    title: 'Start a General Interview',
    description: 'Configure by role, experience, and company. The classic mock flow.',
    route: () => '/interviews/new',
  },
  {
    id: 'project',
    icon: GitBranch,
    eyebrow: 'interview · project',
    title: 'Start a Project Interview',
    description: 'Practice grounded in a real repository from your GitHub.',
    route: ({ hasProjects }) => (hasProjects ? '/projects' : '/projects/new'),
  },
];

const PrimaryActions = () => {
  const navigate = useNavigate();
  const [hasProjects, setHasProjects] = useState(false);

  useEffect(() => {
    let alive = true;
    projectsAPI.list()
      .then((res) => { if (alive) setHasProjects((res.projects || []).length > 0); })
      .catch(() => { if (alive) setHasProjects(false); });
    return () => { alive = false; };
  }, []);

  const context = { hasProjects };

  return (
    <div className="mb-4">
      <SectionHeader
        eyebrow="today"
        title="What would you like to do today?"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <ActionCard
            key={a.id}
            icon={a.icon}
            eyebrow={a.eyebrow}
            title={a.title}
            description={a.description}
            onClick={() => navigate(a.route(context))}
          />
        ))}
      </div>
    </div>
  );
};

export default PrimaryActions;
