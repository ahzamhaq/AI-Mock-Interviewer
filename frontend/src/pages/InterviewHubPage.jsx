import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, GitBranch, Upload, Play } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import InterviewHubCard from '../components/interview/InterviewHubCard';
import TemplateCard from '../components/interview/TemplateCard';
import RecentConfigCard from '../components/interview/RecentConfigCard';
import { INTERVIEW_TYPES } from '../data/interviewTypes';
import { INTERVIEW_TEMPLATES, templateToDraft } from '../data/interviewTemplates';
import { useAuth } from '../context/AuthContext';
import { projectsAPI, presetsAPI, recommendationsAPI } from '../services/api';

/**
 * InterviewHubPage — the entry point for every interview.
 *
 * Sprint 5 Commit 2: sits BEFORE the wizard. Users pick a type first; only
 * then do they land in the appropriate downstream flow. The Hub is data-
 * driven by data/interviewTypes.js — enabling DSA later is one flag flip.
 *
 * Routing per type:
 *   • resume   → wizard preselected with useResume=true (via router state)
 *                (falls back to soft prompt when no resume is uploaded)
 *   • project  → /projects if any exist, /projects/new otherwise
 *   • custom   → /interviews/quick (Sprint 5 Commit 3 will wire real AI)
 *   • reserved → disabled cards, non-interactive
 *
 * The Hub never blocks the user. Every "empty state" (no resume / no
 * projects) offers a non-blocking path forward.
 */

const InterviewHubPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);        // null = loading, [] = loaded empty
  const [prompt, setPrompt] = useState(null);            // one of: null | 'resume' | 'project'
  const [presets, setPresets] = useState([]);            // saved presets (Sprint 5 Commit 5)
  const [inProgress, setInProgress] = useState(null);    // most recent in-progress interview

  // Load project count for the Project card's context info + validation.
  useEffect(() => {
    let alive = true;
    projectsAPI.list()
      .then((res) => { if (alive) setProjects(res.projects || []); })
      .catch(() => { if (alive) setProjects([]); });
    return () => { alive = false; };
  }, []);

  // Sprint 5 Commit 5: load saved presets + detect an in-progress interview.
  // Both calls are best-effort — failures degrade to hidden sections, not
  // toasts. The Hub must always render even when its optional widgets
  // can't populate.
  useEffect(() => {
    let alive = true;
    presetsAPI.list()
      .then((res) => { if (alive) setPresets(res.presets || []); })
      .catch(() => { if (alive) setPresets([]); });
    // The recommendations endpoint already surfaces a `resume` card for
    // in-progress interviews (Sprint 3). We piggyback on that rather than
    // building a dedicated endpoint.
    recommendationsAPI.list()
      .then((res) => {
        if (!alive) return;
        const resume = (res.recommendations || []).find((r) => r.kind === 'resume');
        setInProgress(resume || null);
      })
      .catch(() => { if (alive) setInProgress(null); });
    return () => { alive = false; };
  }, []);

  const hasResume = !!user?.resumeUrl;
  const hasProjects = Array.isArray(projects) && projects.length > 0;
  const latestProject = hasProjects ? projects[0] : null;

  // ── Handlers ─────────────────────────────────────────────────────────
  //
  // Sprint 5 Commit 3: Resume and Custom route through the reusable
  // Setup Method page. Project keeps its Sprint 2 flow (Projects list →
  // Workspace → project-setup) untouched — Task 2.
  //
  // Router-state initialConfig is forwarded through SetupMethod so
  // Guided → Wizard still receives the Resume preselect from Commit 2.

  const handleResume = () => {
    if (!hasResume) {
      setPrompt('resume');
      return;
    }
    navigate('/interviews/new/setup?type=resume', {
      state: { initialConfig: { useResume: true } },
    });
  };

  const handleProject = () => {
    if (!hasProjects) {
      setPrompt('project');
      return;
    }
    navigate('/projects');
  };

  const handleCustom = () => {
    navigate('/interviews/new/setup?type=custom');
  };

  // Sprint 7 Commit 1 — DSA routes through the shared SetupMethod page
  // just like every other type. The wizard reads `mode` from router state
  // to show the DSA configuration step.
  const handleDsa = () => {
    navigate('/interviews/new/setup?type=dsa', {
      state: { initialConfig: { mode: 'dsa' } },
    });
  };

  const clickHandlers = {
    resume: handleResume,
    project: handleProject,
    custom: handleCustom,
    dsa: handleDsa,
  };

  // ── Card info blocks ─────────────────────────────────────────────────

  const infoFor = (id) => {
    if (id === 'resume') {
      return hasResume ? (
        <div className="flex items-center gap-1.5 font-mono text-2xs" style={{ color: '#3FB950' }}>
          <CheckCircle size={10} /> Resume uploaded
        </div>
      ) : (
        <div className="font-mono text-2xs" style={{ color: '#6B7280' }}>
          No resume uploaded yet
        </div>
      );
    }
    if (id === 'project') {
      if (projects === null) {
        return <div className="font-mono text-2xs" style={{ color: '#484F58' }}>Checking projects…</div>;
      }
      if (!hasProjects) {
        return <div className="font-mono text-2xs" style={{ color: '#6B7280' }}>No analyzed projects yet</div>;
      }
      return (
        <div className="font-mono text-2xs" style={{ color: '#6B7280' }}>
          <span style={{ color: '#3FB950' }}>{projects.length}</span>
          {` project${projects.length === 1 ? '' : 's'} available`}
          {latestProject && (
            <>
              <span style={{ color: '#30363D' }}> · </span>
              latest: <span style={{ color: '#9CA3AF' }}>{latestProject.repoOwner}/{latestProject.repoName}</span>
            </>
          )}
        </div>
      );
    }
    if (id === 'dsa') {
      return (
        <div
          className="px-2 py-1.5 font-mono text-2xs"
          style={{
            background: '#161B22',
            border: '1px dashed #30363D',
            borderRadius: 4,
            color: '#6B7280',
          }}
        >
          30 topics · 9 languages · 1&ndash;20 questions
        </div>
      );
    }
    if (id === 'custom') {
      return (
        <div
          className="px-2 py-1.5 font-mono text-2xs"
          style={{
            background: '#161B22',
            border: '1px dashed #30363D',
            borderRadius: 4,
            color: '#6B7280',
          }}
        >
          e.g. &quot;Behavioral round for a senior backend role at a fintech&quot;
        </div>
      );
    }
    return null;
  };

  const primary = INTERVIEW_TYPES.filter((t) => t.category === 'primary');
  const reserved = INTERVIEW_TYPES.filter((t) => t.category === 'reserved');

  // Sprint 5 Commit 5: pull recent configs off the user object (populated
  // by getMe). Newest-first by convention (createInterview pushes with
  // $position: 0). Cap to the last 4 on the Hub — the full history is
  // available on the Presets/History surfaces.
  const recentConfigs = useMemo(
    () => (Array.isArray(user?.recentConfigs) ? user.recentConfigs.slice(0, 4) : []),
    [user?.recentConfigs],
  );

  const templatesToShow = INTERVIEW_TEMPLATES.slice(0, 6);

  // Reuse a recent config → skip the parser, land in Review with a
  // fully-populated draft. Presets follow the same code path. Sprint 5
  // Commit 6: attach sourceKind so Review can persist a proper origin.
  const openInReview = (payload, sourceLabel, kind = 'recent') => {
    navigate('/interviews/review', {
      state: {
        draft: {
          company:       payload.targetCompany || null,
          role:          payload.role,
          interviewType: payload.interviewType,
          experience:    payload.experienceLevel,
          difficulty:    payload.difficulty,
          duration:      Math.round((payload.totalQuestions || 5) * 5),
          questionCount: payload.totalQuestions,
          personality:   null,
          pressure:      payload.pressure,
          round:         payload.round,
          topics:        [],
          useResume:     !!payload.useResume,
          useProjects:   false,
          followUps:     false,
          feedbackMode:  null,
          companyType:   payload.companyType,
        },
        confidence: Object.fromEntries(
          ['company','role','interviewType','experience','difficulty','duration',
           'questionCount','pressure','round','topics','useResume','useProjects',
           'followUps','feedbackMode','companyType'].map((k) => [k, 1]),
        ),
        unknown: [],
        sourceKind: kind,
        sourceLabel,
      },
    });
  };

  const handleTemplate = (template) => {
    // Templates skip the parser: build the draft in-memory + navigate.
    const { draft, confidence, unknown } = templateToDraft(template);
    navigate('/interviews/review', {
      state: {
        draft, confidence, unknown,
        sourceTemplate:   template.name,
        sourceTemplateId: template.id,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          {/* ── Continue Last Interview ─────────────────────────────
              Sourced from the recommendations endpoint's `resume` card
              (Sprint 3). Renders only when there's an in-progress
              interview; hides silently otherwise. */}
          {inProgress?.route && (
            <div className="mb-6">
              <SectionHeader
                eyebrow="in progress"
                title="Continue your last interview"
              />
              <button
                type="button"
                onClick={() => navigate(inProgress.route)}
                className="flex items-center gap-3 w-full text-left p-4 transition-colors"
                style={{
                  background: '#0D1117',
                  border: '1px solid #58A6FF',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#161B22'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0D1117'; }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32, height: 32,
                    background: '#161B22', border: '1px solid #30363D', borderRadius: 6,
                  }}
                >
                  <Play size={13} style={{ color: '#58A6FF' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#F0F6FC' }}>
                    {inProgress.subtitle || inProgress.title || 'Resume interview'}
                  </div>
                  <div className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                    {inProgress.meta || 'in progress'}
                  </div>
                </div>
                <span
                  className="font-mono text-2xs uppercase tracking-wide flex-shrink-0"
                  style={{ color: '#58A6FF' }}
                >
                  Continue →
                </span>
              </button>
            </div>
          )}

          {/* ── Interview Templates ─────────────────────────────────
              Static, code-defined starting points. Click → Review page
              with a synthesized high-confidence Draft (no AI call). */}
          <div className="mb-6">
            <SectionHeader
              eyebrow="templates"
              title="Interview Templates"
              subtitle="Common configurations you can start from. Everything is editable on the Review page."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templatesToShow.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplate(template)}
                />
              ))}
            </div>
          </div>

          {/* ── Recent & Saved ──────────────────────────────────────
              Two stacked lists on a single row: recent configs (auto)
              and saved presets (user-named). Renders only when either
              list has data — new users don't see empty sections. */}
          {(recentConfigs.length > 0 || presets.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {recentConfigs.length > 0 && (
                <div>
                  <SectionHeader
                    eyebrow="recent"
                    title="Recent Configurations"
                  />
                  <div className="flex flex-col gap-2">
                    {recentConfigs.map((rc, i) => (
                      <RecentConfigCard
                        key={`recent-${i}`}
                        variant="recent"
                        title={rc.label || 'Recent interview'}
                        subtitle={[
                          rc.payload?.role?.replace(/_/g, ' '),
                          rc.payload?.interviewType,
                          rc.payload?.difficulty,
                        ].filter(Boolean).join(' · ')}
                        createdAt={rc.createdAt}
                        onClick={() => openInReview(rc.payload, rc.label || 'Recent interview')}
                      />
                    ))}
                  </div>
                </div>
              )}
              {presets.length > 0 && (
                <div>
                  <SectionHeader
                    eyebrow="saved"
                    title="Saved Presets"
                    action={
                      <Link
                        to="/presets"
                        className="font-mono text-2xs"
                        style={{ color: '#58A6FF' }}
                      >
                        manage →
                      </Link>
                    }
                  />
                  <div className="flex flex-col gap-2">
                    {presets.slice(0, 4).map((preset) => (
                      <RecentConfigCard
                        key={preset.id}
                        variant="preset"
                        title={preset.name}
                        subtitle={[
                          preset.payload?.role?.replace(/_/g, ' '),
                          preset.payload?.interviewType,
                          preset.payload?.difficulty,
                        ].filter(Boolean).join(' · ')}
                        createdAt={preset.updatedAt || preset.createdAt}
                        onClick={() => navigate('/interviews/review', {
                          state: {
                            draft: {
                              company:       preset.payload?.targetCompany || null,
                              role:          preset.payload?.role,
                              interviewType: preset.payload?.interviewType,
                              experience:    preset.payload?.experienceLevel,
                              difficulty:    preset.payload?.difficulty,
                              duration:      Math.round((preset.payload?.totalQuestions || 5) * 5),
                              questionCount: preset.payload?.totalQuestions,
                              personality:   null,
                              pressure:      preset.payload?.pressure,
                              round:         preset.payload?.round,
                              topics:        [],
                              useResume:     !!preset.payload?.useResume,
                              useProjects:   false,
                              followUps:     false,
                              feedbackMode:  null,
                              companyType:   preset.payload?.companyType,
                            },
                            confidence: Object.fromEntries(
                              ['company','role','interviewType','experience','difficulty','duration',
                               'questionCount','pressure','round','topics','useResume','useProjects',
                               'followUps','feedbackMode','companyType'].map((k) => [k, 1]),
                            ),
                            unknown: [],
                            sourcePreset:   preset.name,
                            sourcePresetId: preset.id,
                          },
                        })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SectionHeader
            eyebrow="interviews"
            title="What kind of interview do you want?"
            subtitle="Pick a type. Each one adapts to your role, experience, and goals."
          />

          {/* Available */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {primary.map((type) => (
              <InterviewHubCard
                key={type.id}
                type={type}
                info={infoFor(type.id)}
                onClick={clickHandlers[type.id]}
              />
            ))}
          </div>

          {/* Reserved / coming soon */}
          <div
            className="font-mono text-2xs uppercase tracking-wide mb-2"
            style={{ color: '#6B7280' }}
          >
            coming soon
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {reserved.map((type) => (
              <InterviewHubCard key={type.id} type={type} />
            ))}
          </div>

          <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
            {'// more modes ship progressively — Sprint 5+ activates them one at a time'}
          </p>
        </div>
      </div>

      {/* ── Prompts (non-blocking) ─────────────────────────────────────── */}
      {prompt === 'resume' && (
        <SoftPrompt
          onClose={() => setPrompt(null)}
          icon={Upload}
          title="No resume uploaded yet"
          description="Add a resume so your interview can be personalized to your background — or start without one."
          primary={{
            label: 'Upload resume',
            onClick: () => navigate('/profile?tab=resume'),
          }}
          secondary={{
            label: 'Continue without resume',
            onClick: () => {
              setPrompt(null);
              // Route through SetupMethod so the user still gets Quick vs
              // Guided — even without a resume they may prefer the AI
              // prompt path. useResume=false is preserved via router state.
              navigate('/interviews/new/setup?type=resume', {
                state: { initialConfig: { useResume: false } },
              });
            },
          }}
        />
      )}
      {prompt === 'project' && (
        <SoftPrompt
          onClose={() => setPrompt(null)}
          icon={GitBranch}
          title="No analyzed projects found"
          description="Analyze a GitHub repository first to unlock project-grounded interviews — or continue with a general one."
          primary={{
            label: 'Import a project',
            onClick: () => navigate('/projects/new'),
          }}
          secondary={{
            label: 'Continue with general interview',
            onClick: () => {
              setPrompt(null);
              // Fall through to the Custom/AI flow so a projectless user
              // still gets both configuration options.
              navigate('/interviews/new/setup?type=custom');
            },
          }}
        />
      )}
    </div>
  );
};

/**
 * SoftPrompt — inline modal used for the resume/project soft blocks. Kept
 * local because it is only used in two spots on this page; promoting to a
 * shared primitive is premature.
 */
const SoftPrompt = ({ onClose, icon: Icon, title, description, primary, secondary }) => (
  <div
    className="fixed inset-0 flex items-center justify-center px-4"
    style={{ zIndex: 90, background: 'rgba(1,4,9,0.6)', backdropFilter: 'blur(4px)' }}
    onClick={onClose}
  >
    <div
      className="w-full max-w-[440px] p-5"
      style={{
        background: '#161B22',
        border: '1px solid #30363D',
        borderRadius: 10,
        boxShadow: '0 24px 60px rgba(1,4,9,0.85)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={16} style={{ color: '#58A6FF' }} />}
        <h3 className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>
          {title}
        </h3>
      </div>
      <p className="text-xs leading-relaxed mb-4" style={{ color: '#9CA3AF' }}>
        {description}
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={secondary.onClick}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          {secondary.label}
        </button>
        <button
          type="button"
          onClick={primary.onClick}
          className="btn-accent text-xs px-3 py-1.5"
        >
          {primary.label}
        </button>
      </div>
    </div>
  </div>
);

export default InterviewHubPage;
