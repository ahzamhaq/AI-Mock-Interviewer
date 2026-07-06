import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Github, Loader2, CheckCircle, Unlink, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { integrationsAPI } from '../../services/api';

/**
 * GitHubConnectionCard — Connected Accounts card for the Profile page.
 *
 * Behavior:
 *   • On mount, fetch /integrations/github/status.
 *   • If ?github=connected or ?github=error is present in the URL (the OAuth
 *     callback redirects back to /profile with one of those), toast the
 *     outcome and clean the query string.
 *   • Connect  → GET /integrations/github/authorize → navigate to res.url.
 *   • Disconnect → DELETE /integrations/github → refetch status.
 *
 * Kept as a self-contained card so it can live inside the existing Profile
 * tab layout without pulling GitHub state into the parent page.
 */
const GitHubConnectionCard = () => {
  const [status, setStatus] = useState(null); // { connected, login, avatarUrl, connectedAt, scopes }
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = () => {
    setLoading(true);
    integrationsAPI.githubStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Handle the OAuth-callback return.
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('github');
    if (!outcome) return;
    if (outcome === 'connected') {
      toast.success('GitHub connected');
    } else if (outcome === 'error') {
      const reason = params.get('reason') || 'unknown';
      toast.error(`GitHub connection failed (${reason})`);
    }
    // Strip the query so refresh doesn't retrigger the toast.
    params.delete('github');
    params.delete('reason');
    const next = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', next);
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await integrationsAPI.githubAuthorize();
      if (!res?.url) throw new Error('No authorize URL returned');
      // Full navigation — GitHub then redirects back to the backend callback.
      window.location.href = res.url;
    } catch (err) {
      toast.error(err.message || 'Could not start GitHub connect');
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect your GitHub account? Projects created from private repositories will still be viewable, but you will lose the ability to re-analyze or import more repos until you reconnect.')) return;
    setDisconnecting(true);
    try {
      await integrationsAPI.githubDisconnect();
      toast.success('GitHub disconnected');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Connected Accounts</h3>
          <p className="text-white/40 text-sm mt-0.5">
            Optional integrations. Never used for signing in.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-xl border border-white/10 bg-white/3"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              background: '#0D1117',
              border: '1px solid #30363D',
              borderRadius: 10,
            }}
          >
            {status?.connected && status.avatarUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={status.avatarUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
              />
            ) : (
              <Github size={18} style={{ color: '#F0F6FC' }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">GitHub</span>
              {status?.connected && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs"
                  style={{
                    color: '#3FB950',
                    background: 'rgba(63,185,80,0.1)',
                    border: '1px solid rgba(63,185,80,0.3)',
                    borderRadius: 3,
                  }}
                >
                  <CheckCircle size={9} /> connected
                </span>
              )}
            </div>
            {loading ? (
              <div className="mt-1 text-xs text-white/40 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> loading status…
              </div>
            ) : status?.connected ? (
              <>
                <div className="text-white/60 text-sm mt-0.5 truncate">
                  {status.login}
                  {status.connectedAt && (
                    <span className="text-white/40 ml-1.5">
                      · connected {formatDistanceToNow(new Date(status.connectedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                {status.scopes?.length > 0 && (
                  <div className="font-mono text-2xs mt-1 text-white/40">
                    scopes: {status.scopes.join(', ')}
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/50 text-sm mt-1">
                Connect to browse and analyze your own repositories, including private ones.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {status?.connected ? (
            <>
              <button
                type="button"
                onClick={disconnect}
                disabled={disconnecting}
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {disconnecting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Disconnecting…
                  </>
                ) : (
                  <>
                    <Unlink size={11} /> Disconnect
                  </>
                )}
              </button>
              <a
                href={`https://github.com/${status.login}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-2xs"
                style={{ color: '#58A6FF' }}
              >
                view profile <ExternalLink size={9} />
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={loading || connecting}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {connecting ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Redirecting…
                </>
              ) : (
                <>
                  <Github size={11} /> Connect GitHub
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GitHubConnectionCard;
