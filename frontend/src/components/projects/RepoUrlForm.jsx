import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Loader2, ArrowRight } from 'lucide-react';

/**
 * RepoUrlForm — pastes a GitHub URL and hands it to onSubmit. Pure UI: the
 * parent owns the API call and navigation.
 *
 * The public-URL flow is the fastest onboarding path: no OAuth, no account
 * connection, just paste and analyze. Private repositories still require a
 * connected GitHub account and are handled by GitHubRepoPicker.
 *
 * Props:
 *   onSubmit(url) → Promise    — parent's create handler
 *   disabled                    — external gating (e.g. another request in flight)
 */
const RepoUrlForm = ({ onSubmit, disabled = false }) => {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim() || busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(url.trim());
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setBusy(false);
    }
    // On success the parent navigates away — no need to reset local state.
  };

  return (
    <form onSubmit={submit} className="w-full">
      <label
        className="block font-mono text-2xs uppercase tracking-wide mb-2"
        style={{ color: '#6B7280' }}
      >
        Public repository URL
      </label>

      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <div className="flex-1 flex items-center min-w-0" style={{ position: 'relative' }}>
          <Link2
            size={12}
            style={{ color: '#484F58', position: 'absolute', left: 10 }}
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="input-field"
            style={{ paddingLeft: 28 }}
            disabled={busy || disabled}
            autoFocus
          />
        </div>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={!url.trim() || busy || disabled}
          className="btn-accent flex items-center justify-center gap-1.5 px-3 text-xs"
          style={{ minWidth: 110 }}
        >
          {busy ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Working…
            </>
          ) : (
            <>
              Analyze <ArrowRight size={11} />
            </>
          )}
        </motion.button>
      </div>

      {error && (
        <div
          className="mt-2 px-2.5 py-1.5 text-xs"
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

      <p className="font-mono text-2xs mt-2" style={{ color: '#484F58' }}>
        {'// works with any public github.com repository'}
      </p>
    </form>
  );
};

export default RepoUrlForm;
