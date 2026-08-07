import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ResetCodeDialog — small confirmation modal shown before clearing the
 * user's code back to the language boilerplate.
 *
 * Local to the coding workspace: single visual pattern, single consumer.
 * Escape closes; Enter confirms; focus falls to Confirm by default.
 */
const ResetCodeDialog = ({ open, onCancel, onConfirm, language }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 100, background: 'rgba(1,4,9,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
    >
      <div
        className="w-full max-w-[420px] p-5"
        style={{
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 10,
          boxShadow: '0 24px 60px rgba(1,4,9,0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} style={{ color: '#D29922' }} aria-hidden />
          <h3
            id="reset-dialog-title"
            className="text-sm font-semibold"
            style={{ color: '#F0F6FC' }}
          >
            Reset code?
          </h3>
        </div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: '#9CA3AF' }}>
          This will discard everything in the editor and reload the{' '}
          <span style={{ color: '#F0F6FC', fontWeight: 500 }}>{language}</span>{' '}
          boilerplate. Your interview progress and conversation are not affected.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-xs px-3 py-1.5 font-medium transition-colors"
            style={{
              background: 'rgba(248,81,73,0.15)',
              border: '1px solid rgba(248,81,73,0.4)',
              color: '#F85149',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,81,73,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,81,73,0.15)'; }}
            autoFocus
          >
            Reset code
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetCodeDialog;
