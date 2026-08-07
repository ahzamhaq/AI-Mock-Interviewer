import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * SplitWorkspace — responsive two-panel container.
 *
 * Desktop (≥1024px): side-by-side with a draggable divider. The width
 *   of the LEFT panel (as a % of container width) is persisted to
 *   localStorage under the given storageKey so the layout survives
 *   refresh. Default is 60% left / 40% right per the spec.
 *
 * Tablet / mobile (<1024px): stacked vertically. Left panel on top,
 *   right below. Divider is hidden; height is intrinsic.
 *
 * The parent is expected to pass ready-styled children — this component
 * doesn't wrap them in anything visual beyond the panel frame.
 *
 * Props:
 *   left        — ReactNode (conversation)
 *   right       — ReactNode (coding workspace)
 *   storageKey  — string; e.g. `dsa:split-width:<interviewId>`
 *   defaultLeftPct — number, 40–80. Default 60.
 *   minLeftPct  — number, default 30
 *   maxLeftPct  — number, default 80
 */
const DESKTOP_MIN_PX = 1024;

const SplitWorkspace = ({
  left,
  right,
  storageKey,
  defaultLeftPct = 60,
  minLeftPct = 30,
  maxLeftPct = 80,
}) => {
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  const [leftPct, setLeftPct] = useState(() => {
    if (!storageKey) return defaultLeftPct;
    try {
      const raw = localStorage.getItem(storageKey);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= minLeftPct && n <= maxLeftPct) return n;
    } catch { /* ignore */ }
    return defaultLeftPct;
  });

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_MIN_PX : true,
  );

  // Track viewport width so we can flip between side-by-side and stacked.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Persist width whenever it changes on desktop. Skip on mobile — the
  // stacked layout doesn't consult it.
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, String(leftPct)); } catch { /* ignore */ }
  }, [storageKey, leftPct]);

  // ── Drag handlers (desktop only) ─────────────────────────────────
  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const raw = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(maxLeftPct, Math.max(minLeftPct, raw));
    setLeftPct(clamped);
  }, [minLeftPct, maxLeftPct]);

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e) => {
    if (!isDesktop) return;
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Keyboard resize — Left/Right arrow when the divider is focused
  // nudges the split by 2%. Home/End jump to min/max.
  const onDividerKeyDown = (e) => {
    if (!isDesktop) return;
    const step = e.shiftKey ? 5 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLeftPct((p) => Math.max(minLeftPct, p - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLeftPct((p) => Math.min(maxLeftPct, p + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setLeftPct(minLeftPct);
    } else if (e.key === 'End') {
      e.preventDefault();
      setLeftPct(maxLeftPct);
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  if (!isDesktop) {
    // Stacked: left panel first (conversation), then right panel below.
    // Both panels take intrinsic height; the parent's container should
    // manage vertical scroll.
    return (
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full min-h-0"
        style={{ background: '#0D1117' }}
      >
        <div className="min-h-0" style={{ flex: '1 1 55%' }}>{left}</div>
        <div
          style={{
            height: 1,
            background: '#30363D',
            flexShrink: 0,
          }}
          aria-hidden
        />
        <div className="min-h-0" style={{ flex: '1 1 45%' }}>{right}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full min-h-0"
      style={{ background: '#0D1117' }}
    >
      <div className="min-h-0 h-full overflow-hidden" style={{ width: `${leftPct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={minLeftPct}
        aria-valuemax={maxLeftPct}
        aria-label="Resize conversation and coding panels"
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onDividerKeyDown}
        className="flex items-center justify-center flex-shrink-0 group"
        style={{
          width: 6,
          cursor: 'col-resize',
          background: '#161B22',
          borderLeft: '1px solid #30363D',
          borderRight: '1px solid #30363D',
          outline: 'none',
        }}
      >
        <GripVertical
          size={10}
          style={{ color: '#484F58', pointerEvents: 'none' }}
          aria-hidden
        />
      </div>
      <div className="min-h-0 h-full overflow-hidden flex-1">
        {right}
      </div>
    </div>
  );
};

export default SplitWorkspace;
