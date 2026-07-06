import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Lock, Search, Loader2, ArrowRight } from 'lucide-react';
import { integrationsAPI } from '../../services/api';

/**
 * GitHubRepoPicker — visible only when the user has a connected GitHub
 * account. Lists the user's repos (owner/collab/org), filterable by
 * substring, sorted by most recently pushed. Selecting a repo hands the
 * { owner, name } tuple to the parent's onSubmit.
 *
 * Sprint 2 keeps the picker deliberately simple: one page of 30 repos with
 * a "Load more" button. Full pagination and remote search can land later
 * once we see how much scale users have.
 *
 * Props:
 *   onSubmit({ owner, repo }) → Promise    — parent's create handler
 *   disabled                                — external gating
 */
const GitHubRepoPicker = ({ onSubmit, disabled = false }) => {
  const [repos, setRepos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [pickingId, setPickingId] = useState(null);

  useEffect(() => {
    let alive = true;
    integrationsAPI.githubListRepos({ page: 1 })
      .then((res) => {
        if (!alive) return;
        setRepos(res.repos || []);
        setHasMore(!!res.hasMore);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await integrationsAPI.githubListRepos({ page: next });
      setRepos((prev) => [...prev, ...(res.repos || [])]);
      setPage(next);
      setHasMore(!!res.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => (r.fullName || '').toLowerCase().includes(q));
  }, [repos, search]);

  const pick = async (repo) => {
    if (disabled || pickingId) return;
    setPickingId(repo.id);
    try {
      await onSubmit({ owner: repo.owner, repo: repo.name });
    } catch (err) {
      setError(err.message);
      setPickingId(null);
    }
    // On success the parent navigates away.
  };

  return (
    <div className="w-full">
      <label
        className="block font-mono text-2xs uppercase tracking-wide mb-2"
        style={{ color: '#6B7280' }}
      >
        Or import from your GitHub
      </label>

      {/* Search bar */}
      <div className="flex items-center mb-2" style={{ position: 'relative' }}>
        <Search size={12} style={{ color: '#484F58', position: 'absolute', left: 10 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter your repositories…"
          className="input-field"
          style={{ paddingLeft: 28 }}
          disabled={loading || disabled}
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={12} className="animate-spin" style={{ color: '#6B7280' }} />
          <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>loading repositories…</span>
        </div>
      )}

      {!loading && error && (
        <div
          className="px-2.5 py-1.5 text-xs"
          style={{
            color: '#F85149',
            background: 'rgba(248,81,73,0.08)',
            border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-xs py-3 text-center" style={{ color: '#6B7280' }}>
          {search ? 'No repositories match that filter.' : 'No repositories found.'}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div
          className="max-h-[280px] overflow-y-auto"
          style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
        >
          {filtered.map((r) => {
            const busy = pickingId === r.id;
            return (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => pick(r)}
                disabled={!!pickingId || disabled}
                whileTap={{ scale: 0.995 }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors"
                style={{
                  borderBottom: '1px solid #161B22',
                  background: 'transparent',
                  cursor: pickingId ? 'progress' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!pickingId) e.currentTarget.style.background = '#161B22'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <GitBranch size={11} style={{ color: '#58A6FF', flexShrink: 0, marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs flex items-center gap-1.5" style={{ color: '#F0F6FC' }}>
                    <span className="truncate">{r.fullName}</span>
                    {r.private && <Lock size={9} style={{ color: '#6B7280' }} />}
                  </div>
                  {r.description && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                      {r.description}
                    </div>
                  )}
                  <div className="font-mono text-2xs mt-0.5" style={{ color: '#484F58' }}>
                    {r.language || '—'}
                  </div>
                </div>
                {busy ? (
                  <Loader2 size={11} className="animate-spin" style={{ color: '#6B7280', flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <ArrowRight size={11} style={{ color: '#30363D', flexShrink: 0, marginTop: 2 }} />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-secondary text-xs px-3 py-1"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GitHubRepoPicker;
