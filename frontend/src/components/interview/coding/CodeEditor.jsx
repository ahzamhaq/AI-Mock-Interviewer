import React, { Suspense, lazy, useMemo } from 'react';
import { getMonacoLanguage } from '../../../data/codeTemplates';

/**
 * CodeEditor — thin wrapper around @monaco-editor/react.
 *
 * Sprint 7 Commit 3:
 *   • Lazy-loaded via React.lazy so Monaco (~1.2 MB gzipped) does not
 *     enter the initial bundle. Non-DSA interviews never pay for it
 *     because CodingWorkspace itself is only mounted when mode === 'dsa'.
 *   • Memoizes the options prop — Monaco reinstantiates the editor on
 *     new object identity, which would blow away undo/redo history.
 *   • Fully controlled: parent owns the value and receives every change.
 *
 * Props:
 *   value        — string, the current source code
 *   language     — DSA language value ('cpp' | 'python' | …)
 *   onChange     — (nextValue: string) => void
 *   theme        — 'vs-dark' (default) | 'vs' (light)
 *   readOnly     — boolean; disables editing without hiding the editor
 */

const MonacoEditor = lazy(async () => {
  const mod = await import('@monaco-editor/react');
  return { default: mod.default };
});

const EDITOR_OPTIONS_BASE = Object.freeze({
  minimap: { enabled: false },
  fontSize: 13,
  lineHeight: 20,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  renderLineHighlight: 'line',
  padding: { top: 12, bottom: 12 },
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
});

const CodeEditor = ({
  value,
  language,
  onChange,
  theme = 'vs-dark',
  readOnly = false,
}) => {
  const monacoLanguage = getMonacoLanguage(language);

  const options = useMemo(
    () => ({ ...EDITOR_OPTIONS_BASE, readOnly }),
    [readOnly],
  );

  return (
    <Suspense fallback={<EditorLoadingSkeleton />}>
      <MonacoEditor
        value={value}
        language={monacoLanguage}
        theme={theme}
        onChange={(next) => onChange?.(next ?? '')}
        options={options}
        loading={<EditorLoadingSkeleton />}
      />
    </Suspense>
  );
};

const EditorLoadingSkeleton = () => (
  <div
    className="flex items-center justify-center h-full w-full"
    style={{ background: '#1E1E1E', color: '#6B7280' }}
    role="status"
    aria-label="Loading code editor"
  >
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: '#30363D', borderTopColor: '#58A6FF' }}
      />
      <span className="font-mono text-2xs">loading editor…</span>
    </div>
  </div>
);

export default React.memo(CodeEditor);
