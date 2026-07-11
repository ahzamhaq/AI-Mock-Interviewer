import { useEffect } from 'react';

/**
 * useHotkey — minimal cross-platform keyboard shortcut hook.
 *
 * Listens on window keydown; matches `mod` (⌘ on macOS, Ctrl elsewhere)
 * plus `key`. Handler is invoked with the raw event so it can call
 * preventDefault / stopPropagation as needed.
 *
 * Design notes:
 *   • Deliberately tiny — no key-combo DSL, no chord support. YAGNI for
 *     Sprint 4; a chord system can arrive when a specific keybinding needs
 *     it.
 *   • `key` matching is case-insensitive. "k" and "K" both match ⌘+K.
 *   • Fires only when the target is NOT an editable field, unless the
 *     `insideInputs` option is true. Prevents ⌘K from opening the palette
 *     when the user is trying to select all inside a search input.
 *
 * Usage:
 *   useHotkey('k', () => openPalette(), { mod: true });
 */
function useHotkey(key, handler, { mod = false, insideInputs = false } = {}) {
  useEffect(() => {
    if (!key || typeof handler !== 'function') return undefined;

    const onKeyDown = (e) => {
      const targetKey = String(e.key || '').toLowerCase();
      if (targetKey !== String(key).toLowerCase()) return;

      if (mod) {
        const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
        const modKey = isMac ? e.metaKey : e.ctrlKey;
        if (!modKey) return;
      }

      if (!insideInputs) {
        const t = e.target;
        const tag = (t?.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) {
          // Allow inside inputs only when the hotkey is modifier-gated —
          // avoids swallowing normal typing but permits ⌘K from a form.
          if (!mod) return;
        }
      }

      handler(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, handler, mod, insideInputs]);
}

export default useHotkey;
