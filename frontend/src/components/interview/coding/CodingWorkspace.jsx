import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import CodeEditor from './CodeEditor';
import EditorToolbar from './EditorToolbar';
import ResetCodeDialog from './ResetCodeDialog';
import TestCasePanel from './TestCasePanel';
import OutputPanel from './OutputPanel';
import {
  getBoilerplate,
  getExtension,
  getLanguage,
} from '../../../data/codeTemplates';
import { storageKeyFor } from './storage';
import {
  runCode as runCodeApi,
  submitCode as submitCodeApi,
  loadSampleTestCases,
  saveSampleTestCases,
  loadActiveTestIndex,
  saveActiveTestIndex,
  DEFAULT_SAMPLE_TESTS,
} from '../../../services/execution';

/**
 * CodingWorkspace — the DSA interview's live coding surface.
 *
 * Sprint 7 Commit 3:
 *   • Owns the language + source-code state (isolated, no global store).
 *   • Autosaves to localStorage keyed by interview id; restores on
 *     mount so a refresh keeps the candidate's work.
 *   • Never overwrites user code when they switch languages — the
 *     confirmation dialog gates the boilerplate reload.
 *
 * Sprint 7 Commit 4:
 *   • Wires Run and Submit through the Judge0-backed /run and /submit
 *     endpoints. Preserves editor contents at all times — an execution
 *     never mutates the code, cursor, or language.
 *   • Editable sample test cases (default 3, up to 6) persist per
 *     interview via services/execution helpers.
 *   • OutputPanel + TestCasePanel live below the editor in a resizable
 *     bottom drawer.
 *   • Keyboard shortcuts: Ctrl+Enter runs, Shift+Enter submits.
 *
 * Only interview completion should clear the localStorage entries
 * (handled by the parent InterviewPage via clearCodingWorkspace).
 *
 * Props:
 *   interviewId     — string, storage key
 *   initialLanguage — DSA language value from config.dsa.language
 *   topic           — string, used in the download filename
 *   theme           — 'vs-dark' | 'vs'
 */

const AUTOSAVE_DEBOUNCE_MS = 1500;

const CodingWorkspace = ({
  interviewId,
  initialLanguage = 'cpp',
  topic = 'solution',
  theme = 'vs-dark',
}) => {
  // Bootstrap language + code from localStorage if available, otherwise
  // fall back to initialLanguage + its boilerplate.
  const bootstrap = useMemo(() => {
    if (!interviewId) {
      return { language: initialLanguage, code: getBoilerplate(initialLanguage) };
    }
    try {
      const raw = localStorage.getItem(storageKeyFor(interviewId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.sourceCode === 'string' && parsed.language) {
          return { language: parsed.language, code: parsed.sourceCode };
        }
      }
    } catch { /* corrupt entry — fall through to fresh boilerplate */ }
    return { language: initialLanguage, code: getBoilerplate(initialLanguage) };
  }, [interviewId, initialLanguage]);

  const [language, setLanguage] = useState(bootstrap.language);
  const [code, setCode] = useState(bootstrap.code);
  const [pendingLanguage, setPendingLanguage] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Sprint 7 Commit 4 — execution + test-case state. All isolated to
  // this component. `lastResult` holds the most recent /run result;
  // `submitSuite` holds the most recent /submit aggregate. Only one of
  // them drives the OutputPanel at a time (submitSuite wins when set).
  const [sampleTests, setSampleTests] = useState(() =>
    loadSampleTestCases(interviewId, DEFAULT_SAMPLE_TESTS));
  const [activeTestIdx, setActiveTestIdx] = useState(() =>
    loadActiveTestIndex(interviewId, 0));
  const [lastResult, setLastResult] = useState(null);
  const [submitSuite, setSubmitSuite] = useState(null);
  const [execStatus, setExecStatus] = useState('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const autosaveTimer = useRef(null);
  const rootRef = useRef(null);

  // Track whether the editor has been modified vs the current language's
  // boilerplate. Used for the "switch language safely" decision — if the
  // user hasn't touched the code, we swap boilerplates silently.
  const isDirty = useMemo(
    () => code.trim() !== getBoilerplate(language).trim(),
    [code, language],
  );

  // Debounced autosave for the code editor.
  useEffect(() => {
    if (!interviewId) return undefined;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKeyFor(interviewId),
          JSON.stringify({
            language,
            sourceCode: code,
            lastUpdated: Date.now(),
          }),
        );
      } catch { /* quota / private mode — skip silently */ }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [interviewId, language, code]);

  // Persist sample cases + active index eagerly on change.
  useEffect(() => { saveSampleTestCases(interviewId, sampleTests); }, [interviewId, sampleTests]);
  useEffect(() => { saveActiveTestIndex(interviewId, activeTestIdx); }, [interviewId, activeTestIdx]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleLanguageChange = useCallback((next) => {
    if (next === language) return;
    if (isDirty) {
      setPendingLanguage(next);
      return;
    }
    setLanguage(next);
    setCode(getBoilerplate(next));
  }, [language, isDirty]);

  const confirmLanguageSwap = () => {
    if (!pendingLanguage) return;
    setLanguage(pendingLanguage);
    setCode(getBoilerplate(pendingLanguage));
    setPendingLanguage(null);
  };

  const cancelLanguageSwap = () => setPendingLanguage(null);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Copied!');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }, [code]);

  const handleDownload = useCallback(() => {
    const ext = getExtension(language);
    const safeTopic = (topic || 'solution')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'solution';
    const filename = `${safeTopic}.${ext}`;
    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error('Could not download the file.');
    }
  }, [code, language, topic]);

  const handleReset = () => setResetDialogOpen(true);
  const confirmReset = () => {
    setCode(getBoilerplate(language));
    setResetDialogOpen(false);
    toast.success('Code reset.');
  };

  // ── Run ────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!interviewId) return;
    if (isRunning || isSubmitting) return;
    if (!code.trim()) {
      toast.error('Write some code first.');
      return;
    }
    const stdin = sampleTests[activeTestIdx]?.stdin || '';
    setIsRunning(true);
    setExecStatus('running');
    setSubmitSuite(null);
    try {
      const res = await runCodeApi(interviewId, { language, sourceCode: code, stdin });
      const result = res?.result;
      setLastResult(result || null);
      setExecStatus(result?.status || 'idle');
      if (result?.error) toast.error(result.error);
    } catch (err) {
      const msg = err?.message || 'Run failed.';
      setLastResult({
        status: 'network_error', stdout: '', stderr: '', compileOutput: '',
        executionTime: null, memory: null, exitCode: null, error: msg,
      });
      setExecStatus('network_error');
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  }, [interviewId, isRunning, isSubmitting, code, language, sampleTests, activeTestIdx]);

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!interviewId) return;
    if (isRunning || isSubmitting) return;
    if (!code.trim()) {
      toast.error('Write some code first.');
      return;
    }
    setIsSubmitting(true);
    setExecStatus('running');
    try {
      const res = await submitCodeApi(interviewId, { language, sourceCode: code });
      const suite = { summary: res.summary, results: res.results || [] };
      setSubmitSuite(suite);
      setLastResult(null);
      setExecStatus(suite.summary?.status || 'idle');
      const { passed, total } = suite.summary || {};
      if (passed === total && total > 0) {
        toast.success(`Passed ${passed}/${total} hidden tests.`);
      } else {
        toast.error(`Passed ${passed || 0}/${total || 0} hidden tests.`);
      }
    } catch (err) {
      const msg = err?.message || 'Submit failed.';
      setSubmitSuite(null);
      setLastResult({
        status: 'network_error', stdout: '', stderr: '', compileOutput: '',
        executionTime: null, memory: null, exitCode: null, error: msg,
      });
      setExecStatus('network_error');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [interviewId, isRunning, isSubmitting, code, language]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  // Attached to the workspace root: Ctrl+Enter runs, Shift+Enter
  // submits. We only handle these when focus is inside the workspace
  // (rootRef.current.contains(e.target)) so we never steal from other
  // parts of the interview page. Monaco's own Enter behavior is
  // untouched because our handler checks for the modifier keys FIRST
  // and calls preventDefault before Monaco sees it — Monaco only reacts
  // to plain Enter.
  useEffect(() => {
    const onKey = (e) => {
      if (!rootRef.current || !rootRef.current.contains(e.target)) return;
      const isEnter = e.key === 'Enter';
      if (!isEnter) return;
      // Ctrl+Enter or Cmd+Enter → Run
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleRun();
      } else if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun, handleSubmit]);

  const currentLanguageLabel = getLanguage(language).label;
  const pendingLanguageLabel = pendingLanguage ? getLanguage(pendingLanguage).label : '';
  const busy = isRunning || isSubmitting;

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-full min-h-0"
      style={{ background: '#0D1117' }}
      aria-label="Coding workspace"
    >
      <EditorToolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onReset={handleReset}
        onRun={handleRun}
        onSubmit={handleSubmit}
        runDisabled={busy}
        submitDisabled={busy}
        runLabel={isRunning ? 'Running…' : 'Run'}
        submitLabel={isSubmitting ? 'Submitting…' : 'Submit'}
      />
      {/* Top half — editor */}
      <div className="flex-1 min-h-0" style={{ minHeight: 180 }}>
        <CodeEditor
          value={code}
          language={language}
          onChange={setCode}
          theme={theme}
        />
      </div>

      {/* Bottom half — split into test cases (left) and output (right).
          Stacks vertically on narrow viewports via flex-wrap fallback. */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{ borderTop: '1px solid #30363D', minHeight: 220, maxHeight: '50%' }}
      >
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="md:w-1/2 min-h-[140px] md:min-h-0 md:border-r" style={{ borderColor: '#30363D' }}>
            <TestCasePanel
              cases={sampleTests}
              activeIndex={activeTestIdx}
              onChangeActive={setActiveTestIdx}
              onChangeCases={setSampleTests}
              disabled={busy}
            />
          </div>
          <div className="md:w-1/2 min-h-[160px] md:min-h-0">
            <OutputPanel
              result={lastResult}
              submitSuite={submitSuite}
              status={execStatus}
              busy={busy}
              language={currentLanguageLabel}
            />
          </div>
        </div>
      </div>

      {/* Language-switch confirmation reuses ResetCodeDialog's visual
          language — same semantic ("your code will be replaced"). */}
      <ResetCodeDialog
        open={!!pendingLanguage}
        onCancel={cancelLanguageSwap}
        onConfirm={confirmLanguageSwap}
        language={pendingLanguageLabel || currentLanguageLabel}
      />

      <ResetCodeDialog
        open={resetDialogOpen}
        onCancel={() => setResetDialogOpen(false)}
        onConfirm={confirmReset}
        language={currentLanguageLabel}
      />
    </div>
  );
};

export default CodingWorkspace;
