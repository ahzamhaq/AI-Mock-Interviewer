import React, { useState } from 'react';
import { Terminal, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import ExecutionStatus from './ExecutionStatus';

/**
 * OutputPanel — tabbed display of the most recent execution result.
 *
 * Sprint 7 Commit 4:
 *   • Tabs: Output (stdout), Errors (stderr + compile output), Execution Info
 *   • For /submit results, an additional "Tests" tab shows the per-test
 *     pass/fail table.
 *   • All text areas are read-only, monospaced, scrollable.
 *
 * Props:
 *   result       — normalized single-run result OR null (idle)
 *   submitSuite  — { summary, results } from /submit OR null
 *   status       — string; 'idle' | 'running' | 'success' | ...
 *   busy         — boolean; when true we show the "Running…" hint
 *   language     — current language (for the header chip)
 */
const TABS = [
  { key: 'output',  label: 'Output',         Icon: Terminal },
  { key: 'errors',  label: 'Errors',         Icon: AlertTriangle },
  { key: 'info',    label: 'Execution Info', Icon: Info },
  { key: 'tests',   label: 'Tests',          Icon: CheckCircle, submitOnly: true },
];

const OutputPanel = ({
  result = null,
  submitSuite = null,
  status = 'idle',
  busy = false,
  language = '',
}) => {
  const showTests = !!submitSuite;
  const availableTabs = TABS.filter((t) => !t.submitOnly || showTests);
  const [tab, setTab] = useState('output');

  // Auto-jump the user to the most informative tab after a run.
  React.useEffect(() => {
    if (busy) return;
    if (status === 'compilation_error' || status === 'runtime_error') {
      setTab('errors');
    } else if (submitSuite) {
      setTab('tests');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, submitSuite]);

  const effective = availableTabs.find((t) => t.key === tab) ? tab : 'output';

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: '#0D1117', borderTop: '1px solid #30363D' }}
      aria-label="Execution output"
    >
      {/* Header — tabs + status chip */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1 flex-shrink-0"
        style={{ background: '#161B22', borderBottom: '1px solid #30363D', minHeight: 32 }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto" role="tablist" aria-label="Output tabs">
          {availableTabs.map((t) => {
            const active = t.key === effective;
            const { Icon } = t;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`output-tab-${t.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const i = availableTabs.findIndex((x) => x.key === effective);
                    const next = e.key === 'ArrowRight'
                      ? availableTabs[(i + 1) % availableTabs.length]
                      : availableTabs[(i - 1 + availableTabs.length) % availableTabs.length];
                    setTab(next.key);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-mono transition-colors"
                style={{
                  background: active ? '#0D1117' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? '#30363D' : 'transparent',
                  borderBottomColor: active ? '#0D1117' : 'transparent',
                  color: active ? '#F0F6FC' : '#9CA3AF',
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                <Icon size={10} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
        <ExecutionStatus status={busy ? 'running' : status} detail={result?.error || ''} />
      </div>

      {/* Body */}
      <div
        id={`output-tab-${effective}`}
        role="tabpanel"
        className="flex-1 min-h-0 overflow-auto p-2 font-mono text-xs"
        style={{ background: '#010409', color: '#E6EDF3', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}
        tabIndex={0}
      >
        {effective === 'output' && (
          <OutputContent result={result} submitSuite={submitSuite} busy={busy} />
        )}
        {effective === 'errors' && (
          <ErrorsContent result={result} submitSuite={submitSuite} busy={busy} />
        )}
        {effective === 'info' && (
          <InfoContent result={result} submitSuite={submitSuite} busy={busy} language={language} />
        )}
        {effective === 'tests' && submitSuite && (
          <TestsContent submitSuite={submitSuite} />
        )}
      </div>
    </div>
  );
};

const Placeholder = ({ text }) => (
  <span style={{ color: '#484F58' }}>{`// ${text}`}</span>
);

const OutputContent = ({ result, submitSuite, busy }) => {
  if (busy) return <Placeholder text="running your code…" />;
  if (submitSuite) {
    // For submissions we don't have a single stdout — show the first
    // failing test's stdout, or the last test's stdout if all passed.
    const failing = submitSuite.results.find((r) => !r.passed);
    const target = failing || submitSuite.results[submitSuite.results.length - 1];
    if (!target) return <Placeholder text="no output" />;
    return target.stdout ? target.stdout : <Placeholder text="no stdout" />;
  }
  if (!result) return <Placeholder text="run your code to see output here" />;
  if (!result.stdout) return <Placeholder text="no stdout" />;
  return result.stdout;
};

const ErrorsContent = ({ result, submitSuite, busy }) => {
  if (busy) return <Placeholder text="waiting for errors…" />;
  const source = submitSuite
    ? submitSuite.results.find((r) => r.compileOutput || r.stderr) || submitSuite.results[0]
    : result;
  if (!source) return <Placeholder text="no errors" />;
  const { compileOutput, stderr, error } = source;
  if (!compileOutput && !stderr && !error) return <Placeholder text="no errors" />;
  return (
    <div className="space-y-2">
      {compileOutput && (
        <section aria-label="Compilation output">
          <div className="text-2xs uppercase tracking-wide mb-1" style={{ color: '#F85149' }}>
            Compilation
          </div>
          <div style={{ color: '#F0F6FC' }}>{compileOutput}</div>
        </section>
      )}
      {stderr && (
        <section aria-label="Standard error">
          <div className="text-2xs uppercase tracking-wide mb-1" style={{ color: '#F85149' }}>
            stderr
          </div>
          <div style={{ color: '#F0F6FC' }}>{stderr}</div>
        </section>
      )}
      {error && !compileOutput && !stderr && (
        <section aria-label="Error message">
          <div style={{ color: '#F85149' }}>{error}</div>
        </section>
      )}
    </div>
  );
};

const InfoContent = ({ result, submitSuite, busy, language }) => {
  if (busy) return <Placeholder text="waiting for metrics…" />;
  const primary = submitSuite
    ? submitSuite.results.reduce((acc, r) => ({
        executionTime: (acc.executionTime || 0) + (r.executionTime || 0),
        memory: Math.max(acc.memory || 0, r.memory || 0),
        exitCode: acc.exitCode ?? r.exitCode,
      }), {})
    : result;
  if (!primary) return <Placeholder text="run your code to see metrics" />;
  const rows = [
    { label: 'Language',       value: language || '—' },
    { label: 'Status',         value: submitSuite ? submitSuite.summary.status : (result?.status || '—') },
    { label: 'Execution time', value: primary.executionTime != null ? `${Number(primary.executionTime).toFixed(3)} s` : '—' },
    { label: 'Memory',         value: primary.memory != null ? `${Number(primary.memory).toLocaleString()} KB` : '—' },
    { label: 'Exit code',      value: primary.exitCode != null ? String(primary.exitCode) : '—' },
    ...(submitSuite ? [{ label: 'Tests passed', value: `${submitSuite.summary.passed} / ${submitSuite.summary.total}` }] : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <dt className="text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>{r.label}</dt>
          <dd style={{ color: '#F0F6FC' }}>{r.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

const TestsContent = ({ submitSuite }) => (
  <div className="space-y-1.5">
    <div
      className="text-2xs uppercase tracking-wide flex items-center gap-2"
      style={{ color: '#6B7280' }}
    >
      <span>Hidden tests</span>
      <span
        className="px-1.5 py-0.5 font-mono"
        style={{
          background: submitSuite.summary.passed === submitSuite.summary.total
            ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
          color: submitSuite.summary.passed === submitSuite.summary.total ? '#3FB950' : '#F85149',
          border: `1px solid ${submitSuite.summary.passed === submitSuite.summary.total ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
          borderRadius: 3,
        }}
      >
        {submitSuite.summary.passed} / {submitSuite.summary.total}
      </span>
    </div>
    {submitSuite.results.map((r) => (
      <div
        key={r.index}
        className="flex items-start gap-2 px-2 py-1.5"
        style={{
          background: r.passed ? 'rgba(63,185,80,0.06)' : 'rgba(248,81,73,0.06)',
          border: `1px solid ${r.passed ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
          borderRadius: 4,
        }}
      >
        {r.passed
          ? <CheckCircle size={12} style={{ color: '#3FB950', marginTop: 2, flexShrink: 0 }} aria-label="passed" />
          : <XCircle size={12} style={{ color: '#F85149', marginTop: 2, flexShrink: 0 }} aria-label="failed" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium" style={{ color: '#F0F6FC' }}>{r.label}</div>
          <div className="text-2xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {r.passed ? 'Passed' : (r.error || r.message || `Failed (${r.status})`)}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default OutputPanel;
