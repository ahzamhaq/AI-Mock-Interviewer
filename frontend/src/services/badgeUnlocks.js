import React from 'react';
import toast from 'react-hot-toast';
import * as Icons from 'lucide-react';

/**
 * applyBadgeUnlocks — one place that reacts to a server-side badge unlock.
 *
 * Backend returns `unlockedBadges` on interview completion + project
 * creation (see project.controller and interview.controller). The array
 * contains display-ready objects: { id, title, description, category, icon }.
 * This helper:
 *   1. Toasts each unlock with the badge title + description + icon.
 *   2. Merges the ids into the local user.badges array so the
 *      Achievements tab shows them immediately without a refetch.
 *
 * Call sites pass the auth context's updateUser + current user. Kept as a
 * plain function (not a hook) so it can be called from event handlers.
 *
 * Signature:
 *   applyBadgeUnlocks(unlockedBadges, { user, updateUser, onOpen })
 *
 *   unlockedBadges — the array from the API response (may be undefined)
 *   user           — current user object (may be null; guarded)
 *   updateUser     — from useAuth()
 *   onOpen         — optional () => void invoked when the toast is clicked
 *                    (typically navigate to /profile?tab=achievements)
 */
function applyBadgeUnlocks(unlockedBadges, { user, updateUser, onOpen } = {}) {
  if (!Array.isArray(unlockedBadges) || unlockedBadges.length === 0) return;

  // Merge into local user.badges. Idempotent — if the id is already in
  // the array (in either shape), skip. This matches the backend contract
  // where re-emitting an already-unlocked badge is a no-op.
  if (user && typeof updateUser === 'function') {
    const existingIds = new Set(
      (user.badges || []).map((b) => (typeof b === 'string' ? b : b?.id)).filter(Boolean),
    );
    const additions = unlockedBadges
      .filter((b) => b?.id && !existingIds.has(b.id))
      .map((b) => ({ id: b.id, unlockedAt: new Date().toISOString() }));
    if (additions.length) {
      updateUser({ badges: [...(user.badges || []), ...additions] });
    }
  }

  // Toast each unlock. Stacking multiple toasts is fine — react-hot-toast
  // handles it. Users unlocking two badges in one action see two toasts.
  for (const badge of unlockedBadges) {
    if (!badge?.id) continue;
    const Icon = Icons[badge.icon] || Icons.Award;
    toast(
      (t) => React.createElement(
        'div',
        {
          className: 'flex items-start gap-3',
          onClick: () => { if (onOpen) onOpen(); toast.dismiss(t.id); },
          style: { cursor: onOpen ? 'pointer' : 'default' },
        },
        React.createElement(
          'div',
          {
            className: 'flex items-center justify-center flex-shrink-0',
            style: {
              width: 36,
              height: 36,
              background: 'rgba(88,166,255,0.12)',
              border: '1px solid rgba(88,166,255,0.4)',
              borderRadius: 8,
            },
          },
          React.createElement(Icon, { size: 16, style: { color: '#58A6FF' } }),
        ),
        React.createElement(
          'div',
          { className: 'flex-1 min-w-0' },
          React.createElement(
            'div',
            {
              className: 'font-mono text-2xs uppercase tracking-wide',
              style: { color: '#58A6FF' },
            },
            'achievement unlocked',
          ),
          React.createElement(
            'div',
            { className: 'text-sm font-semibold mt-0.5', style: { color: '#F0F6FC' } },
            badge.title,
          ),
          badge.description
            ? React.createElement(
              'div',
              { className: 'text-xs mt-0.5', style: { color: '#9CA3AF' } },
              badge.description,
            )
            : null,
        ),
      ),
      {
        duration: 5000,
        // Match the app-wide toast style set in App.jsx but pinned longer.
        style: {
          background: '#1c2033',
          color: '#fff',
          border: '1px solid rgba(88,166,255,0.35)',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: 380,
        },
      },
    );
  }
}

export { applyBadgeUnlocks };
