import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitBranch, Github, Star, Lock, ExternalLink, Play, RefreshCw,
  Loader2, AlertTriangle, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import { Panel, PanelHeader } from '../components/common/Panel';
import WorkspaceTabs from '../components/projects/WorkspaceTabs';
import TechStackChips from '../components/projects/TechStackChips';
import KeyFilesList from '../components/projects/KeyFilesList';
import ArchitectureSummary from '../components/projects/ArchitectureSummary';
import { projectsAPI, interviewAPI } from '../services/api';

/**
 * WorkspacePage — the Project (Workspace) detail view. Sprint 2 ships only
 * the Overview tab. Reserved tabs (Chat, Health, Diagram, etc.) are NOT
 * rendered until their features ship — matching the reserved-tab
 * philosophy from Sprint 1's design review.
 *
 * Data flow:
 *   1. Load the Project + its latest RepositoryAnalysis via projectsAPI.
 *   2. If analysis is still processing, redirect to the Analyzing page.
 *   3. Load interview history (existing endpoint) and filter to sessions
 *      that reference this project via config.projectMode.projectId.
 *
 * "Start Project Interview" routes to the interview setup page for this
 * project — that page is built in Commit 12.
 */

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const WorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');

  // Load project + analysis
  useEffect(() => {
    let alive = true;
    projectsAPI.getById(id)
      .then((res) => {
        if (!alive) return;
        setProject(res.project);
        setAnalysis(res.analysis);
        // If still processing, punt the user back to the analyzing view.
        if (res.analysis?.status === 'processing') {
          navigate(`/projects/${id}/analyzing`, { replace: true });
        }
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load interview history and filter to this project
  useEffect(() => {
    let alive = true;
    interviewAPI.getHistory({ page: 1, limit: 50 })
      .then((res) => {
        if (!alive) return;
        const all = res.interviews || [];
        const filtered = all.filter(
          (i) => String(i?.config?.projectMode?.projectId || '') === String(id),
        );
        setSessions(filtered);
      })
      .catch(() => { if (alive) setSessions([]); })
      .finally(() => { if (alive) setSessionsLoaded(true); });
    return () => { alive = false; };
  }, [id]);

  const reanalyze = async () => {
    setReanalyzing(true);
    try {
      await projectsAPI.reanalyze(id);
      navigate(`/projects/${id}/analyzing`, { replace: true });
    } catch (err) {
      setError(err.message);
      setReanalyzing(false);
    }
  };

  // Sprint 2 tabs — only Overview is real. When later sprints ship Chat /
  // Health / Diagram, they are added here (never rendered as ghost tabs).
  const tabs = useMemo(() => ([
    { id: 'overview', label: 'Overview' },
  ]), []);

  const repoLabel = project ? `${project.repoOwner}/${project.repoName}` : '';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          {loading && (
            <div
              className="flex items-center justify-center py-10"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
              <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>loading workspace…</span>
            </div>
          )}

          {!loading && error && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load workspace"
                description={error}
                action={
                  <Link to="/projects" className="btn-secondary text-xs px-3 py-1.5">
                    Back to projects
                  </Link>
                }
              />
            </div>
          )}

          {!loading && !error && project && (
            <>
              {/* ── Header ──────────────────────────────────────────── */}
              <div className="mb-4">
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-1.5 font-mono text-2xs mb-2 transition-colors"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
                >
                  <ArrowLeft size={11} /> Projects
                </Link>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <GitBranch size={16} style={{ color: '#58A6FF' }} />
                      <h1
                        className="text-lg font-semibold truncate"
                        style={{ color: '#F0F6FC' }}
                        title={repoLabel}
                      >
                        {repoLabel}
                      </h1>
                      {project.metadata?.private && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs"
                          style={{
                            color: '#D29922',
                            background: 'rgba(210,153,34,0.1)',
                            border: '1px solid rgba(210,153,34,0.3)',
                            borderRadius: 3,
                          }}
                        >
                          <Lock size={9} /> private
                        </span>
                      )}
                      {project.metadata?.htmlUrl && (
                        <a
                          href={project.metadata.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-2xs transition-colors"
                          style={{ color: '#58A6FF' }}
                        >
                          <Github size={10} /> github <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                    {project.metadata?.description && (
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                        {project.metadata.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 font-mono text-2xs mt-2" style={{ color: '#6B7280' }}>
                      {project.metadata?.language && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#58A6FF' }} />
                          {project.metadata.language}
                        </span>
                      )}
                      {typeof project.metadata?.stars === 'number' && project.metadata.stars > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Star size={9} /> {project.metadata.stars}
                        </span>
                      )}
                      {analysis?.updatedAt && (
                        <span>
                          analyzed {formatDistanceToNow(new Date(analysis.updatedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={reanalyze}
                      disabled={reanalyzing || analysis?.status !== 'ready'}
                      className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <RefreshCw size={11} className={reanalyzing ? 'animate-spin' : ''} />
                      Re-analyze
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${id}/interview/setup`)}
                      disabled={analysis?.status !== 'ready'}
                      className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap"
                      title={analysis?.status !== 'ready' ? 'Analysis must complete first' : undefined}
                    >
                      <Play size={11} />
                      <span className="sm:hidden">Start interview</span>
                      <span className="hidden sm:inline">Start Project Interview</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Tabs ────────────────────────────────────────────── */}
              <WorkspaceTabs tabs={tabs} activeId={activeTab} onSelect={setActiveTab} />

              {/* ── Overview content ───────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mt-4">

                  {/* Main column — summary, architecture, key files */}
                  <div className="flex flex-col gap-3 min-w-0">

                    {/* Failure surface takes over the main column when analysis failed. */}
                    {analysis?.status === 'failed' ? (
                      <Panel>
                        <PanelHeader icon={AlertTriangle} label="analysis failed" />
                        <div className="p-4">
                          <p className="text-xs mb-3" style={{ color: '#F0F6FC' }}>
                            {analysis?.error || 'Analysis failed for this repository.'}
                          </p>
                          <button
                            type="button"
                            onClick={reanalyze}
                            disabled={reanalyzing}
                            className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                          >
                            <RefreshCw size={11} className={reanalyzing ? 'animate-spin' : ''} />
                            {reanalyzing ? 'Retrying…' : 'Retry analysis'}
                          </button>
                        </div>
                      </Panel>
                    ) : (
                      <>
                        <Panel>
                          <PanelHeader label="summary" />
                          <div className="p-4">
                            {analysis?.summary
                              ? <p className="text-xs leading-relaxed" style={{ color: '#F0F6FC' }}>{analysis.summary}</p>
                              : <p className="text-xs" style={{ color: '#6B7280' }}>No summary produced.</p>}
                          </div>
                        </Panel>

                        <Panel>
                          <PanelHeader label="architecture" />
                          <div className="p-4">
                            <ArchitectureSummary text={analysis?.architectureSummary} />
                          </div>
                        </Panel>

                        <Panel>
                          <PanelHeader
                            label="key files"
                            action={
                              <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
                                {analysis?.filesRead ?? 0} read
                              </span>
                            }
                          />
                          <div className="py-1">
                            <KeyFilesList items={analysis?.importantFiles || []} />
                          </div>
                        </Panel>
                      </>
                    )}
                  </div>

                  {/* Right rail — tech stack + past interviews */}
                  <div className="flex flex-col gap-3">
                    <Panel>
                      <PanelHeader label="tech stack" />
                      <div className="p-3">
                        {analysis?.techStack?.length
                          ? <TechStackChips items={analysis.techStack} />
                          : <p className="text-xs" style={{ color: '#6B7280' }}>No tech stack detected.</p>}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader
                        label="project interviews"
                        action={
                          <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
                            {sessions.length}
                          </span>
                        }
                      />
                      {!sessionsLoaded ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={12} className="animate-spin" style={{ color: '#6B7280' }} />
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="p-3">
                          <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                            No interviews yet for this project.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${id}/interview/setup`)}
                            disabled={analysis?.status !== 'ready'}
                            className="btn-accent w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs"
                          >
                            <Play size={11} /> Start first interview
                          </button>
                        </div>
                      ) : (
                        <div>
                          {sessions.slice(0, 8).map((s, i) => (
                            <motion.button
                              key={s._id}
                              onClick={() => navigate(`/interview/${s._id}/results`)}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.02 }}
                              className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
                              style={{ borderTop: '1px solid #161B22', background: 'transparent' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span
                                className="font-mono text-2xs flex-shrink-0 mt-0.5"
                                style={{ color: SCORE_COLOR(s.results?.overallScore), width: 24 }}
                              >
                                {s.results?.overallScore?.toFixed(1) ?? '—'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs truncate" style={{ color: '#F0F6FC' }}>
                                  {s.config?.projectMode?.subMode?.replace('_', ' ') || 'project interview'}
                                </div>
                                <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                                  {s.completedAt
                                    ? formatDistanceToNow(new Date(s.completedAt), { addSuffix: true })
                                    : '—'}
                                </div>
                              </div>
                              <ChevronRight size={11} style={{ color: '#30363D', flexShrink: 0, marginTop: 2 }} />
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </Panel>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
