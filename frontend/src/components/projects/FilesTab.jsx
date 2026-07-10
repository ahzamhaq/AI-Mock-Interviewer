import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileCode, ExternalLink, Search } from 'lucide-react';

/**
 * FilesTab — read-only list of every file the analysis pipeline consumed
 * for this Workspace, each with the short "purpose" the LLM assigned.
 *
 * Explicitly NOT a code viewer:
 *   • No file contents.
 *   • No syntax highlighting (would need a heavy library — Prism/Shiki).
 *   • Rows link out to github.com in a new tab when clicked.
 *
 * If we want in-app viewing / highlighting later, this component becomes
 * the entry point without changing the tab's IA.
 *
 * Props:
 *   files         — [{ path, purpose, size }] (from analysis.importantFiles)
 *   project       — Project doc; used to construct github.com URLs
 */
const filesizeLabel = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FilesTab = ({ files = [], project }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        (f.path || '').toLowerCase().includes(q) ||
        (f.purpose || '').toLowerCase().includes(q),
    );
  }, [files, query]);

  const buildGithubUrl = (path) => {
    if (!project) return null;
    const branch = project.defaultBranch || 'main';
    return `https://github.com/${project.repoOwner}/${project.repoName}/blob/${branch}/${path}`;
  };

  if (!files.length) {
    return (
      <div
        className="p-6 text-center"
        style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
      >
        <FileCode size={20} style={{ color: '#484F58' }} className="mx-auto mb-3" />
        <p className="text-xs" style={{ color: '#6B7280' }}>
          No files were identified for this repository.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex items-center" style={{ position: 'relative' }}>
        <Search size={12} style={{ color: '#484F58', position: 'absolute', left: 10 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${files.length} files by path or purpose…`}
          className="input-field"
          style={{ paddingLeft: 28 }}
        />
      </div>

      {/* File list */}
      <div
        className="overflow-hidden"
        style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
      >
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs" style={{ color: '#6B7280' }}>
              No files match &quot;{query}&quot;.
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((f, i) => {
              const url = buildGithubUrl(f.path);
              return (
                <motion.li
                  key={f.path}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 15) * 0.015 }}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid #161B22' }}
                >
                  <a
                    href={url || '#'}
                    target={url ? '_blank' : undefined}
                    rel={url ? 'noreferrer' : undefined}
                    onClick={(e) => { if (!url) e.preventDefault(); }}
                    className="flex items-start gap-2 px-3 py-2 transition-colors"
                    style={{ textDecoration: 'none', background: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <FileCode
                      size={11}
                      style={{ color: '#58A6FF', flexShrink: 0, marginTop: 3 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-mono text-xs truncate"
                        style={{ color: '#F0F6FC' }}
                        title={f.path}
                      >
                        {f.path}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {f.purpose && (
                          <span className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                            {f.purpose}
                          </span>
                        )}
                        {f.size ? (
                          <span
                            className="font-mono text-2xs flex-shrink-0"
                            style={{ color: '#484F58' }}
                          >
                            · {filesizeLabel(f.size)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {url && (
                      <ExternalLink
                        size={11}
                        style={{ color: '#30363D', flexShrink: 0, marginTop: 3 }}
                      />
                    )}
                  </a>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="font-mono text-2xs" style={{ color: '#484F58' }}>
        {'// files opened on github.com — analysis reads at most 40 files or 150 KB'}
      </p>
    </div>
  );
};

export default FilesTab;
