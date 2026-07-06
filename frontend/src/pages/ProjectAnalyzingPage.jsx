import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { GitBranch, RefreshCw, AlertTriangle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import AnalyzeProgress from '../components/projects/AnalyzeProgress';
import { projectsAPI } from '../services/api';

/**
 * ProjectAnalyzingPage — polls GET /projects/:id every POLL_INTERVAL_MS and
 * transitions:
 *   status === 'ready'      → navigate to Workspace (/projects/:id)
 *   status === 'failed'     → show error + Retry (calls reanalyze) + Back
 *   status === 'processing' → keep polling with AnalyzeProgress running
 *
 * The 45s wall-clock target from the analysis pipeline means most repos
 * finish in 3–5 polls. A hard MAX_ATTEMPTS ceiling stops runaway polling if
 * the backend goes silent.
 */
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 120; // 6 minutes at 3s cadence — well past the 45s target

const ProjectAnalyzingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer = null;

    const tick = async () => {
      attemptsRef.current += 1;
      try {
        const res = await projectsAPI.getById(id);
        if (!alive) return;
        setProject(res.project);
        setAnalysis(res.analysis);

        if (res.analysis?.status === 'ready') {
          navigate(`/projects/${id}`, { replace: true });
          return;
        }
        if (res.analysis?.status === 'failed') {
          setError(res.analysis?.error || 'Analysis failed.');
          return;
        }
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setError('Analysis is taking longer than expected. Try again.');
          return;
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (!alive) return;
        setError(err.message);
      }
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const retry = async () => {
    setRetrying(true);
    setError(null);
    attemptsRef.current = 0;
    try {
      await projectsAPI.reanalyze(id);
      // Reload the page component state — the useEffect above will resume
      // polling because the underlying analysis record has flipped back to
      // `processing`.
      setAnalysis({ status: 'processing' });
      // Kick a poll immediately.
      const res = await projectsAPI.getById(id);
      setProject(res.project);
      setAnalysis(res.analysis);
      if (res.analysis?.status !== 'ready') {
        setTimeout(() => window.location.reload(), 400);
      } else {
        navigate(`/projects/${id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  };

  const repoLabel = project ? `${project.repoOwner}/${project.repoName}` : 'repository';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <SectionHeader
            eyebrow="projects · analyzing"
            title={project ? `Analyzing ${repoLabel}` : 'Analyzing repository'}
            subtitle="This takes 30 seconds to a minute for most repositories."
          />

          <div
            className="p-5"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
          >
            {/* Header line with repo identity */}
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={13} style={{ color: '#58A6FF' }} />
              <span className="text-sm font-medium" style={{ color: '#F0F6FC' }}>
                {repoLabel}
              </span>
              {project?.metadata?.language && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs"
                  style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 3, color: '#6B7280' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#58A6FF' }} />
                  {project.metadata.language}
                </span>
              )}
            </div>

            {/* Body — progress OR error */}
            {!error && <AnalyzeProgress />}

            {error && (
              <div>
                <div
                  className="flex items-start gap-2 px-3 py-2 mb-3"
                  style={{
                    background: 'rgba(248,81,73,0.08)',
                    border: '1px solid rgba(248,81,73,0.3)',
                    borderRadius: 6,
                  }}
                >
                  <AlertTriangle size={12} style={{ color: '#F85149', flexShrink: 0, marginTop: 2 }} />
                  <div className="text-xs" style={{ color: '#F0F6FC' }}>
                    <div className="font-medium mb-0.5">Analysis failed</div>
                    <div style={{ color: '#9CA3AF' }}>{error}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={retry}
                    disabled={retrying}
                    className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Retrying…' : 'Retry analysis'}
                  </button>
                  <Link to="/projects" className="btn-secondary text-xs px-3 py-1.5">
                    Back to projects
                  </Link>
                </div>
              </div>
            )}
          </div>

          <p className="font-mono text-2xs mt-3" style={{ color: '#484F58' }}>
            {'// analysis reads at most 40 files or 150 KB — quality over completeness'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectAnalyzingPage;
