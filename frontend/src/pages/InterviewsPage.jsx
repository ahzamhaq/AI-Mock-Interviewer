import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GitBranch } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import InterviewTypeCard from '../components/interview/InterviewTypeCard';
import { projectsAPI } from '../services/api';

/**
 * INTERVIEW_MODES — data-driven list. New modes (Mock Recruiter, Custom, etc.)
 * plug in here without touching the page layout. `route` is a function so a
 * mode can inspect runtime context (e.g. whether the user has projects) to
 * decide its destination.
 */
const INTERVIEW_MODES = [
  {
    id: 'general',
    icon: Mic,
    tagline: 'role · company · difficulty',
    title: 'General Interview',
    description:
      'Configure a mock interview by role, experience, company type, and topic. The classic practice flow.',
    route: () => '/interview/setup',
  },
  {
    id: 'project',
    icon: GitBranch,
    tagline: 'grounded in your repo',
    title: 'Project Interview',
    description:
      'Analyze a GitHub repository and practice interviews grounded in your real code, architecture, and decisions.',
    // Users with existing projects land on the list; new users go straight
    // to the creation flow to avoid an empty page as their first touch.
    route: ({ hasProjects }) => (hasProjects ? '/projects' : '/projects/new'),
  },
];

const InterviewsPage = () => {
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
                onClick={() => navigate(mode.route(context))}
                disabled={mode.disabled}
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
