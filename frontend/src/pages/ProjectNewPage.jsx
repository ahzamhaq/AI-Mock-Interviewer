import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Loader2 } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import RepoUrlForm from '../components/projects/RepoUrlForm';
import GitHubRepoPicker from '../components/projects/GitHubRepoPicker';
import { projectsAPI, integrationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { applyBadgeUnlocks } from '../services/badgeUnlocks';

/**
 * ProjectNewPage — the two creation surfaces:
 *   1. Paste a public GitHub URL (always visible, fastest onboarding path)
 *   2. Pick from your connected GitHub account (visible only when connected)
 *
 * Both flows converge on the backend's create endpoints and immediately
 * navigate the user to /projects/:id/analyzing. The Analyzing page owns
 * the polling loop.
 *
 * Users without a GitHub connection see the URL form + a soft CTA linking
 * to Profile → Connected Accounts (built in Commit 13). Users with a
 * connection see both surfaces stacked.
 */
const ProjectNewPage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [ghStatus, setGhStatus] = useState(null); // { connected, login? }
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    integrationsAPI.githubStatus()
      .then((res) => { if (alive) setGhStatus(res); })
      .catch(() => { if (alive) setGhStatus({ connected: false }); })
      .finally(() => { if (alive) setStatusLoading(false); });
    return () => { alive = false; };
  }, []);

  const goToAnalyzing = (projectId) => {
    navigate(`/projects/${projectId}/analyzing`, { replace: true });
  };

  // Sprint 4: applyBadgeUnlocks reads `res.unlockedBadges` from the API
  // response (may be undefined) and toasts + merges any newly earned
  // badges into local user.badges. Called before navigation so the toast
  // fires while we still have the response in scope.
  const handleUnlocks = (res) => {
    applyBadgeUnlocks(res?.unlockedBadges, {
      user,
      updateUser,
      onOpen: () => navigate('/profile?tab=achievements'),
    });
  };

  const submitUrl = async (url) => {
    setSubmitting(true);
    try {
      const res = await projectsAPI.createFromUrl(url);
      handleUnlocks(res);
      goToAnalyzing(res.project._id);
    } finally {
      // No need to reset — we navigate away. Only reached on caller-catch.
      setSubmitting(false);
    }
  };

  const submitGithub = async ({ owner, repo }) => {
    setSubmitting(true);
    try {
      const res = await projectsAPI.createFromGithub(owner, repo);
      handleUnlocks(res);
      goToAnalyzing(res.project._id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <SectionHeader
            eyebrow="projects · new"
            title="Analyze a repository"
            subtitle="Paste any public GitHub URL, or import a repository from your connected account."
            action={
              <Link
                to="/projects"
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Back to projects
              </Link>
            }
          />

          {/* URL form — always visible. */}
          <div
            className="p-4 mb-3"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
          >
            <RepoUrlForm onSubmit={submitUrl} disabled={submitting} />
          </div>

          {/* Divider + GitHub picker OR connect CTA. */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1" style={{ height: 1, background: '#21262D' }} />
            <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#484F58' }}>
              or
            </span>
            <div className="flex-1" style={{ height: 1, background: '#21262D' }} />
          </div>

          <div
            className="p-4"
            style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
          >
            {statusLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={12} className="animate-spin" style={{ color: '#6B7280' }} />
              </div>
            ) : ghStatus?.connected ? (
              <GitHubRepoPicker onSubmit={submitGithub} disabled={submitting} />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Github size={13} style={{ color: '#F0F6FC' }} />
                  <span className="text-xs font-medium" style={{ color: '#F0F6FC' }}>
                    Import from your GitHub
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  Connect a GitHub account to browse and analyze your own
                  repositories, including private ones.
                </p>
                <Link
                  to="/profile"
                  className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs mt-1"
                >
                  <Github size={11} /> Connect GitHub
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectNewPage;
