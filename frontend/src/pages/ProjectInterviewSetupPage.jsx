import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Layers, Bug, Search, ArrowLeft, Play, Loader2, GitBranch, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { projectsAPI, interviewAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * ProjectInterviewSetupPage — the mini-setup for a project interview.
 *
 * Unlike the general InterviewSetupPage (5-step wizard), the project setup
 * is a single-screen picker because the repo already supplies most of the
 * context. The user picks:
 *   1. sub-mode (Architecture / Debugging / Code Review)
 *   2. difficulty (Easy / Medium / Hard)
 *   3. total questions (5 / 8 / 12)
 *
 * Everything else — role, experience, company, personality, round — is
 * derived: role comes from the user's profile, experience too, and the
 * backend maps sub-mode → engine round (architecture → system_design,
 * debugging/code_review → technical). Sensible defaults for the rest.
 *
 * On submit → POST /api/interviews with { projectId, subMode, ...config }
 * and navigate to the existing live interview flow.
 */

const SUB_MODES = [
  {
    id: 'architecture',
    icon: Layers,
    title: 'Architecture',
    description:
      'Talk through the system: layers, data flow, entry points, and the tradeoffs behind design decisions.',
  },
  {
    id: 'debugging',
    icon: Bug,
    title: 'Debugging',
    description:
      'Reason about failure modes and diagnostic strategy for realistic scenarios based on this codebase.',
  },
  {
    id: 'code_review',
    icon: Search,
    title: 'Code Review',
    description:
      'Walk through selected files and defend implementation choices as if in a review.',
  },
];

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   description: 'Warm-up · fundamentals' },
  { id: 'medium', label: 'Medium', description: 'Balanced · standard' },
  { id: 'hard',   label: 'Hard',   description: 'Deep probing · edge cases' },
];

const LENGTHS = [
  { id: 5,  label: '5 questions',  hint: '~15 min' },
  { id: 8,  label: '8 questions',  hint: '~25 min' },
  { id: 12, label: '12 questions', hint: '~40 min' },
];

// Small selectable card. Local to this page — the visual is one-off
// enough that promoting it to a shared primitive would be premature.
const PickCard = ({ selected, onClick, children }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.995 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="flex flex-col items-start text-left w-full h-full p-3 transition-colors"
    style={{
      background: selected ? '#161B22' : '#0D1117',
      border: `1px solid ${selected ? '#58A6FF' : '#30363D'}`,
      borderRadius: 6,
      cursor: 'pointer',
      boxShadow: selected ? '0 0 0 3px rgba(88,166,255,0.15)' : 'none',
    }}
    onMouseEnter={(e) => {
      if (!selected) e.currentTarget.style.borderColor = '#484F58';
    }}
    onMouseLeave={(e) => {
      if (!selected) e.currentTarget.style.borderColor = '#30363D';
    }}
  >
    {children}
  </motion.button>
);

const ProjectInterviewSetupPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [subMode, setSubMode] = useState('architecture');
  const [difficulty, setDifficulty] = useState('medium');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    projectsAPI.getById(id)
      .then((res) => {
        if (!alive) return;
        setProject(res.project);
        setAnalysis(res.analysis);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const analysisReady = analysis?.status === 'ready';
  const repoLabel = project ? `${project.repoOwner}/${project.repoName}` : '';

  // Interview title is set by the backend from projectId + subMode; the
  // rest of the payload uses the user's profile defaults so the engine has
  // real values to work with.
  const start = async () => {
    if (!analysisReady) return;
    setSubmitting(true);
    try {
      const payload = {
        // Profile-derived (safe defaults if the user's profile is sparse)
        role: user?.targetRole || 'sde',
        experienceLevel: user?.experience || '1-2_years',
        companyType: 'any',
        targetCompany: user?.targetCompany || '',
        // Project-mode drives interview type + round on the backend; keep
        // interviewType at 'mixed' so the engine chooses freely.
        interviewType: 'mixed',
        difficulty,
        totalQuestions,
        jobDescription: '',
        useResume: false,
        lengthIntent: 'auto',
        pressure: 'standard',
        personalityId: '',
        // Sprint 2 — the two fields that switch this interview into project mode.
        projectId: id,
        subMode,
      };
      const res = await interviewAPI.create(payload);
      navigate(`/interview/${res.interview.id}`, { state: { greeting: res.greeting || '' } });
    } catch (err) {
      toast.error(err.message || 'Failed to start interview');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[960px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          <SectionHeader
            eyebrow="project · setup"
            title={project ? `Project Interview — ${repoLabel}` : 'Project Interview'}
            subtitle="Pick a focus and difficulty. The questions will draw on this repository's code."
            action={
              <Link
                to={`/projects/${id}`}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Back to workspace
              </Link>
            }
          />

          {loading && (
            <div
              className="flex items-center justify-center py-10"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
            </div>
          )}

          {!loading && error && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load project"
                description={error}
                action={
                  <Link to="/projects" className="btn-secondary text-xs px-3 py-1.5">
                    Back to projects
                  </Link>
                }
              />
            </div>
          )}

          {!loading && !error && project && !analysisReady && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Analysis not ready"
                description="This project's analysis is still processing or has failed. Return to the workspace to check status."
                action={
                  <Link
                    to={`/projects/${id}`}
                    className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    Back to workspace
                  </Link>
                }
              />
            </div>
          )}

          {!loading && !error && project && analysisReady && (
            <div className="flex flex-col gap-3">

              {/* Repo strip — visual anchor that reminds the user what they're prepping on. */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
              >
                <GitBranch size={13} style={{ color: '#58A6FF' }} />
                <span className="text-sm font-medium" style={{ color: '#F0F6FC' }}>
                  {repoLabel}
                </span>
                {project.metadata?.language && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs ml-1"
                    style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 3, color: '#6B7280' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#58A6FF' }} />
                    {project.metadata.language}
                  </span>
                )}
              </div>

              {/* Focus */}
              <Panel>
                <PanelHeader label="focus" />
                <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {SUB_MODES.map((m) => (
                    <PickCard
                      key={m.id}
                      selected={subMode === m.id}
                      onClick={() => setSubMode(m.id)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <m.icon size={13} style={{ color: '#58A6FF' }} />
                        <span className="text-xs font-semibold" style={{ color: '#F0F6FC' }}>
                          {m.title}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                        {m.description}
                      </p>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              {/* Difficulty */}
              <Panel>
                <PanelHeader label="difficulty" />
                <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <PickCard
                      key={d.id}
                      selected={difficulty === d.id}
                      onClick={() => setDifficulty(d.id)}
                    >
                      <span className="text-xs font-semibold" style={{ color: '#F0F6FC' }}>
                        {d.label}
                      </span>
                      <span className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                        {d.description}
                      </span>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              {/* Length */}
              <Panel>
                <PanelHeader label="length" />
                <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <PickCard
                      key={l.id}
                      selected={totalQuestions === l.id}
                      onClick={() => setTotalQuestions(l.id)}
                    >
                      <span className="text-xs font-semibold" style={{ color: '#F0F6FC' }}>
                        {l.label}
                      </span>
                      <span className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                        {l.hint}
                      </span>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              {/* Start */}
              <div className="flex items-center justify-end gap-2 mt-2">
                <Link to={`/projects/${id}`} className="btn-secondary text-xs px-3 py-1.5">
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={start}
                  disabled={submitting}
                  className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={11} className="animate-spin" /> Starting…
                    </>
                  ) : (
                    <>
                      <Play size={11} /> Start interview
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectInterviewSetupPage;
