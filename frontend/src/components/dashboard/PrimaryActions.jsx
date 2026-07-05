import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GitBranch } from 'lucide-react';
import ActionCard from '../common/ActionCard';
import SectionHeader from '../common/SectionHeader';

/**
 * PrimaryActions — "What would you like to do today?" row. Two equally
 * weighted ActionCards routing to General Interview and Project Interview.
 * The Project card carries a Sprint-2 badge (honest signalling) but is fully
 * clickable to the placeholder page.
 */
const ACTIONS = [
  {
    id: 'general',
    icon: Mic,
    eyebrow: 'interview · general',
    title: 'Start a General Interview',
    description: 'Configure by role, experience, and company. The classic mock flow.',
    route: '/interview/setup',
  },
  {
    id: 'project',
    icon: GitBranch,
    eyebrow: 'interview · project',
    title: 'Start a Project Interview',
    description: 'Practice grounded in a real repository from your GitHub.',
    route: '/projects/new',
    badge: (
      <span
        className="font-mono text-2xs uppercase tracking-wide px-1.5 py-0.5"
        style={{
          color: '#D29922',
          background: 'rgba(210,153,34,0.1)',
          border: '1px solid rgba(210,153,34,0.3)',
          borderRadius: 4,
        }}
      >
        Sprint 2
      </span>
    ),
  },
];

const PrimaryActions = () => {
  const navigate = useNavigate();

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
            onClick={() => navigate(a.route)}
            badge={a.badge}
          />
        ))}
      </div>
    </div>
  );
};

export default PrimaryActions;
