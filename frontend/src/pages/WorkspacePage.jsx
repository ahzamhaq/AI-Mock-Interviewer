import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  GitBranch, Github, Star, Lock, ExternalLink, Play, RefreshCw,
  Loader2, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/layout/Navbar';
import EmptyState from '../components/common/EmptyState';
import { Panel, PanelHeader } from '../components/common/Panel';
import WorkspaceTabs from '../components/projects/WorkspaceTabs';
import TechStackChips from '../components/projects/TechStackChips';
import KeyFilesList from '../components/projects/KeyFilesList';
import ArchitectureSummary from '../components/projects/ArchitectureSummary';
import FilesTab from '../components/projects/FilesTab';
import InterviewsTab from '../components/projects/InterviewsTab';
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

  // Sprint 3 tabs — Overview + Files + Interviews.
  // Sprint 6 Commit 1 adds Chat as a nav-style tab: its `href` sends the
  // user to /projects/:id/chat rather than switching an in-page panel,
  // because Chat needs the full canvas. Health / Diagram remain
  // deferred; ghost tabs still forbidden.
  const tabs = useMemo(() => ([
    { id: 'overview',   label: 'Overview' },
    { id: 'files',      label: 'Files' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'chat',       label: 'Chat', href: `/projects/${id}/chat` },
  ]), [id]);

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

                    {/* The past-interviews list is now the Interviews tab
                        (Sprint 3). Overview keeps only tech stack in the
                        right rail so it stays focused on "what is this
                        project?" instead of duplicating tab content. */}
                  </div>
                </div>
              )}

              {/* ── Files tab (Sprint 3) ─────────────────────────────
                  Read-only surface for every file the analysis captured.
                  Filterable; rows link to github.com. No in-app viewer,
                  no syntax highlighting — see FilesTab for the reasoning. */}
              {activeTab === 'files' && (
                <div className="mt-4">
                  <FilesTab
                    files={analysis?.importantFiles || []}
                    project={project}
                  />
                </div>
              )}

              {/* ── Interviews tab (Sprint 3) ───────────────────────
                  Full-width past-project-interviews list. Promoted from
                  Overview's right rail so it can breathe. Overview no
                  longer shows this data — one source of truth. */}
              {activeTab === 'interviews' && (
                <InterviewsTab
                  sessions={sessions}
                  sessionsLoaded={sessionsLoaded}
                  analysisReady={analysis?.status === 'ready'}
                  projectId={id}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
