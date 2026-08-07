import React from 'react';
import { Copy, Download, RotateCcw, Play, Send } from 'lucide-react';
import LanguageSelector from './LanguageSelector';

/**
 * EditorToolbar — the strip of controls above the Monaco editor.
 *
 * Sprint 7 Commit 3:
 *   • Language selector (left) drives syntax highlighting + boilerplate.
 *   • Copy / Download / Reset (center-right) are functional.
 *   • Run / Submit (right) are visible-but-disabled placeholders so the
 *     surface doesn't shift when Commit 4 wires Judge0 in.
 *
 * Every button has an aria-label. The disabled Run/Submit buttons carry
 * a tooltip explaining why.
 */
const EditorToolbar = ({
  language,
  onLanguageChange,
  onCopy,
  onDownload,
  onReset,
  onRun,
  onSubmit,
  runDisabled = false,
  submitDisabled = false,
  runLabel = 'Run',
  submitLabel = 'Submit',
  runTitle,
  submitTitle,
  languageDisabled = false,
}) => (
  <div
    className="flex items-center justify-between gap-2 px-2 py-1.5 flex-shrink-0"
    style={{
      background: '#161B22',
      borderBottom: '1px solid #30363D',
      minHeight: 36,
    }}
  >
    {/* Left — Language */}
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="font-mono text-2xs uppercase tracking-wide flex-shrink-0"
        style={{ color: '#6B7280' }}
      >
        Language
      </span>
      <LanguageSelector
        value={language}
        onChange={onLanguageChange}
        disabled={languageDisabled}
      />
    </div>

    {/* Right — action buttons */}
    <div className="flex items-center gap-1 flex-wrap">
      <ToolbarButton icon={Copy} label="Copy" onClick={onCopy} title="Copy code to clipboard" />
      <ToolbarButton icon={Download} label="Download" onClick={onDownload} title="Download solution" />
      <ToolbarButton
        icon={RotateCcw}
        label="Reset"
        onClick={onReset}
        title="Reset to language boilerplate"
        tone="warning"
      />
      <div className="w-px h-4 mx-1" style={{ background: '#30363D' }} aria-hidden />
      {/* Sprint 7 Commit 4 — Run and Submit are live when handlers are
          passed in. They stay visible-but-disabled if the parent hasn't
          wired them, preserving the Commit 3 placeholder behavior. */}
      <ToolbarButton
        icon={Play}
        label={runLabel}
        onClick={onRun}
        disabled={runDisabled || !onRun}
        title={runTitle || (onRun ? 'Run (Ctrl+Enter)' : 'Available in the next update.')}
        tone={onRun ? 'success' : 'disabled'}
      />
      <ToolbarButton
        icon={Send}
        label={submitLabel}
        onClick={onSubmit}
        disabled={submitDisabled || !onSubmit}
        title={submitTitle || (onSubmit ? 'Submit (Shift+Enter)' : 'Available in the next update.')}
        tone={onSubmit ? 'accent' : 'disabled'}
      />
    </div>
  </div>
);

const ToolbarButton = ({ icon: Icon, label, onClick, disabled = false, title, tone }) => {
  const colors = tone === 'warning'
    ? { fg: '#D29922', hover: 'rgba(210,153,34,0.1)' }
    : tone === 'disabled'
      ? { fg: '#484F58', hover: 'transparent' }
      : tone === 'success'
        ? { fg: '#3FB950', hover: 'rgba(63,185,80,0.1)' }
        : tone === 'accent'
          ? { fg: '#58A6FF', hover: 'rgba(88,166,255,0.1)' }
          : { fg: '#9CA3AF', hover: '#21262D' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-disabled={disabled}
      className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-mono transition-colors"
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        color: colors.fg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = colors.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={11} aria-hidden />
      <span>{label}</span>
    </button>
  );
};

export default EditorToolbar;
