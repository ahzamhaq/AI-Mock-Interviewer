import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bookmark, Trash2, Edit3, ArrowLeft, Loader2, RotateCw, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import { presetsAPI } from '../services/api';

/**
 * PresetsPage — CRUD for user-owned interview presets.
 *
 * Deliberately simple: list rows with rename (inline) and delete
 * (confirm) affordances, plus a Reuse action that jumps into the
 * interview via the same POST /api/interviews path everything else uses.
 * "Reuse" here builds an interview immediately — presets are already
 * fully-formed payloads.
 */
const PresetsPage = () => {
  const navigate = useNavigate();
  const [presets, setPresets] = useState(null);   // null while loading
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setPresets(null);
    presetsAPI.list()
      .then((res) => setPresets(res.presets || []))
      .catch(() => setPresets([]));
  };

  useEffect(() => { load(); }, []);

  const beginRename = (preset) => {
    setRenamingId(preset.id);
    setRenameDraft(preset.name);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };
  const commitRename = async (preset) => {
    const next = renameDraft.trim();
    if (!next || next === preset.name) { cancelRename(); return; }
    setBusyId(preset.id);
    try {
      await presetsAPI.rename(preset.id, next);
      toast.success('Preset renamed.');
      setPresets((prev) => prev.map((p) => (p.id === preset.id ? { ...p, name: next } : p)));
      cancelRename();
    } catch (err) {
      toast.error(err?.message || 'Rename failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (preset) => {
    if (!window.confirm(`Delete "${preset.name}"? This can't be undone.`)) return;
    setBusyId(preset.id);
    try {
      await presetsAPI.remove(preset.id);
      toast.success('Preset deleted.');
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
    } catch (err) {
      toast.error(err?.message || 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReuse = (preset) => {
    // Presets ARE the wizard payload, so we skip the parser and go
    // straight to the Review page with a fully-populated draft. The
    // Review page's Start Interview button will fire the existing
    // createInterview API — one pipeline, no duplication.
    const p = preset.payload || {};
    navigate('/interviews/review', {
      state: {
        draft: {
          company:       p.targetCompany || null,
          role:          p.role,
          interviewType: p.interviewType,
          experience:    p.experienceLevel,
          difficulty:    p.difficulty,
          duration:      Math.round((p.totalQuestions || 5) * 5),
          questionCount: p.totalQuestions,
          personality:   null,
          pressure:      p.pressure,
          round:         p.round,
          topics:        [],
          useResume:     !!p.useResume,
          useProjects:   false,
          followUps:     false,
          feedbackMode:  null,
          companyType:   p.companyType,
        },
        // Full confidence — this is a saved config, not an AI guess.
        confidence: Object.fromEntries(
          ['company','role','interviewType','experience','difficulty','duration',
           'questionCount','pressure','round','topics','useResume','useProjects',
           'followUps','feedbackMode','companyType'].map((k) => [k, 1]),
        ),
        unknown: [],
        sourcePreset:   preset.name,
        sourcePresetId: preset.id,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />
      <div className="flex-1 pt-12">
        <div className="max-w-[860px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <SectionHeader
            eyebrow="interviews · presets"
            title="Saved Presets"
            subtitle="Your named interview configurations. Reuse them anytime."
            action={
              <button
                type="button"
                onClick={() => navigate('/interviews/new')}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <ArrowLeft size={12} /> Interview Hub
              </button>
            }
          />

          {presets === null && (
            <div
              className="flex items-center justify-center py-16"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
            </div>
          )}

          {presets && presets.length === 0 && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={Bookmark}
                title="No presets yet"
                description="Save an interview configuration from the Review page and it will appear here."
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/interviews/new')}
                    className="btn-accent text-xs px-3 py-1.5"
                  >
                    Set up an interview
                  </button>
                }
              />
            </div>
          )}

          {presets && presets.length > 0 && (
            <div className="flex flex-col gap-2">
              {presets.map((preset) => {
                const p = preset.payload || {};
                const isRenaming = renamingId === preset.id;
                const isBusy = busyId === preset.id;
                return (
                  <motion.div
                    key={preset.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3"
                    style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 32, height: 32,
                        background: '#161B22', border: '1px solid #30363D', borderRadius: 6,
                      }}
                    >
                      <Bookmark size={13} style={{ color: '#D29922' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(preset);
                            if (e.key === 'Escape') cancelRename();
                          }}
                          className="input-field"
                          style={{ padding: '4px 8px', maxWidth: 320 }}
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm font-medium truncate" style={{ color: '#F0F6FC' }}>
                          {preset.name}
                        </div>
                      )}
                      <div className="font-mono text-2xs mt-0.5 truncate" style={{ color: '#6B7280' }}>
                        {(p.role || '').replace(/_/g, ' ')} · {p.interviewType} · {p.difficulty}
                        {preset.updatedAt && (
                          <>
                            <span style={{ color: '#30363D' }}> · </span>
                            saved {formatDistanceToNow(new Date(preset.updatedAt), { addSuffix: true })}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isRenaming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => commitRename(preset)}
                            disabled={isBusy}
                            className="btn-accent flex items-center gap-1 px-2 py-1 text-2xs"
                          >
                            <Check size={10} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-2xs"
                          >
                            <X size={10} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReuse(preset)}
                            className="btn-accent flex items-center gap-1 px-2 py-1 text-2xs"
                          >
                            <RotateCw size={10} /> Start
                          </button>
                          <button
                            type="button"
                            onClick={() => beginRename(preset)}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-2xs"
                            title="Rename"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(preset)}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2 py-1 text-2xs"
                            style={{
                              color: '#F85149',
                              background: 'rgba(248,81,73,0.08)',
                              border: '1px solid rgba(248,81,73,0.3)',
                              borderRadius: 6,
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                            }}
                            title="Delete"
                          >
                            <Trash2 size={10} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
            {'// presets and templates both produce the same POST /interviews payload'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PresetsPage;
