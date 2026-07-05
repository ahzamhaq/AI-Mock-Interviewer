import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GitBranch } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import InterviewTypeCard from '../components/interview/InterviewTypeCard';

/**
 * INTERVIEW_MODES — data-driven list. New modes (Mock Recruiter, Custom, etc.)
 * plug in here without touching the page layout.
 *
 *   route     – destination on click
 *   badge     – optional right-corner label (used for "Sprint 2" placeholder)
 *   disabled  – renders muted (not used today; reserved for future gating)
 */
const INTERVIEW_MODES = [
  {
    id: 'general',
    icon: Mic,
    tagline: 'role · company · difficulty',
    title: 'General Interview',
    description:
      'Configure a mock interview by role, experience, company type, and topic. The classic practice flow.',
    route: '/interview/setup',
  },
  {
    id: 'project',
    icon: GitBranch,
    tagline: 'grounded in your repo',
    title: 'Project Interview',
    description:
      'Connect a GitHub repository and practice interviews grounded in your real code, architecture, and decisions.',
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

const InterviewsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <SectionHeader
            eyebrow="practice"
            title="Start an interview"
            subtitle="Choose how you want to practice today. Both modes carry equal weight."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INTERVIEW_MODES.map((mode) => (
              <InterviewTypeCard
                key={mode.id}
                icon={mode.icon}
                tagline={mode.tagline}
                title={mode.title}
                description={mode.description}
                onClick={() => navigate(mode.route)}
                disabled={mode.disabled}
                badge={mode.badge}
              />
            ))}
          </div>

          <p
            className="font-mono text-2xs mt-4"
            style={{ color: '#484F58' }}
          >
            {'// tip: both modes generate the same style of feedback report'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InterviewsPage;
