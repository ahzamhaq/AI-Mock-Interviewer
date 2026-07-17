import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, X, Loader2 } from 'lucide-react';

/**
 * SavePresetModal — the "name your preset" dialog used from the Review
 * page's Save Preset button. Kept as a standalone controlled component so
 * the parent owns the API call.
 *
 * Props:
 *   open, onClose
 *   onSave(name) → Promise      — parent's save handler
 *   defaultName                 — initial value for the input
 */
const SavePresetModal = ({ open, onClose, onSave, defaultName = '' }) => {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open, defaultName]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const clean = name.trim();
    if (!clean) return;
    if (saving) return;
    setSaving(true);
    try {
      await onSave(clean);
      // Parent typically closes the modal on success.
    } catch {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 90, background: 'rgba(1,4,9,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.form
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 480, damping: 40 }}
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] p-5"
            style={{
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: 10,
              boxShadow: '0 24px 60px rgba(1,4,9,0.85)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Bookmark size={14} style={{ color: '#D29922' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>
                  Save as preset
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>

            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>
              Give this configuration a name so you can reuse it later. Only the interview settings are saved — no prompt text.
            </p>

            <label
              className="block font-mono text-2xs uppercase tracking-wide mb-1"
              style={{ color: '#6B7280' }}
            >
              Preset name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. My Amazon Practice"
              className="input-field"
              style={{ padding: '6px 10px' }}
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>Save preset</>
                )}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SavePresetModal;
