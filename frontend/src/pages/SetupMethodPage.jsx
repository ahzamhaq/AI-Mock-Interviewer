import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Zap, Sliders, ArrowLeft } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import SetupMethodCard from '../components/interview/SetupMethodCard';
import { INTERVIEW_TYPES } from '../data/interviewTypes';

/**
 * SetupMethodPage — the reusable "how do you want to configure this?" page.
 *
 * Sprint 5 Commit 3: sits between the Interview Hub and the actual setup
 * flow. Two choices: Quick with AI (freeform prompt) or Guided Setup
 * (existing 5-step wizard).
 *
 * The page is TYPE-AGNOSTIC. It reads `?type=<id>` from the URL to look
 * up the interview type's display metadata; every routing choice below
 * behaves identically regardless of type. Enabling DSA in Sprint 5+ means
 * flipping the registry entry to `enabled: true` — no change here.
 *
 * Router state passthrough:
 *   • The Hub passes `initialConfig` (e.g. { useResume: true } for the
 *     Resume card). Guided Setup forwards that to the wizard verbatim,
 *     preserving Sprint 5 Commit 2's preselect behavior.
 *   • Quick Interview receives the same state so its resume/project
 *     toggles start in the right position when known.
 *
 * Design: mirrors InterviewHubPage exactly — same Navbar, same
 * SectionHeader, same card visual language. Feels native.
 */
const SetupMethodPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const typeId = searchParams.get('type') || 'custom';
  const type = INTERVIEW_TYPES.find((t) => t.id === typeId) || INTERVIEW_TYPES.find((t) => t.id === 'custom');

  // Router-state payload passed forward through both branches. Absent on
  // fresh navigation from unrelated callers — undefined initialConfig
  // means both destinations behave like they always have.
  const forwardState = location.state || {};

  const handleQuick = () => {
    navigate('/interviews/quick', {
      state: {
        // Carry the source type + any preselect hints forward so the
        // Quick page can initialize its resume/project toggles sensibly.
        sourceType: typeId,
        initialConfig: forwardState.initialConfig || {},
      },
    });
  };

  const handleGuided = () => {
    // Guided always terminates in the existing wizard. The wizard reads
    // initialConfig (Sprint 5 Commit 2) — for the Resume flow this
    // preserves useResume=true, for others it's absent and the wizard
    // uses its own defaults. Zero regression.
    navigate('/interview/setup', {
      state: forwardState,
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[960px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          <SectionHeader
            eyebrow={`interviews · ${type.title.toLowerCase()}`}
            title="How would you like to set this up?"
            subtitle="Two ways to define your interview. Both land in the same live session."
            action={
              <button
                type="button"
                onClick={() => navigate('/interviews/new')}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Back to Interview Hub
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SetupMethodCard
              icon={Zap}
              title="Quick with AI"
              description="Describe the interview you want using natural language."
              bullets={typeId === 'dsa' ? [
                '"Medium graph interview in C++."',
                '"Five hard DP questions."',
                '"Mixed arrays and strings in Python."',
              ] : [
                '"I have an Amazon Backend interview."',
                '"Focus on DSA."',
                '"Ask strict follow-up questions."',
              ]}
              ctaLabel="Continue"
              onClick={handleQuick}
            />
            <SetupMethodCard
              icon={Sliders}
              title="Guided Setup"
              description="Configure every aspect manually."
              bullets={[
                'Role · Company · Difficulty',
                'Interview style · Pressure',
                'Rounds · Topics',
              ]}
              ctaLabel="Continue"
              onClick={handleGuided}
            />
          </div>

          <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
            {'// both methods produce the same InterviewBlueprint on the backend'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupMethodPage;
