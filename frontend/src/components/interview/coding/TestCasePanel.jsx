import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * TestCasePanel — editable sample test cases (stdin only).
 *
 * Sprint 7 Commit 4:
 *   • Tab strip picks the active case; the textarea below edits it.
 *   • Add up to 6 cases, remove down to 1. Default is 3 (seeded by
 *     the parent from DEFAULT_SAMPLE_TESTS).
 *   • Parent owns state + persistence — this component is fully
 *     controlled. It does NOT read localStorage itself so it stays
 *     testable and interviewId-agnostic.
 *
 * Props:
 *   cases            — [{ stdin, label? }]
 *   activeIndex      — number
 *   onChangeActive   — (nextIndex) => void
 *   onChangeCases    — (nextCases) => void
 *   disabled         — boolean; disables editing while a run is in flight
 */
const MAX_CASES = 6;
const MIN_CASES = 1;

const TestCasePanel = ({
  cases = [],
  activeIndex = 0,
  onChangeActive,
  onChangeCases,
  disabled = false,
}) => {
  const safeIndex = Math.max(0, Math.min(activeIndex, cases.length - 1));
  const activeCase = cases[safeIndex] || { stdin: '' };

  const updateActive = (nextStdin) => {
    const next = cases.slice();
    next[safeIndex] = { ...next[safeIndex], stdin: nextStdin };
    onChangeCases?.(next);
  };

  const addCase = () => {
    if (cases.length >= MAX_CASES) return;
    const next = [...cases, { stdin: '', label: `Sample ${cases.length + 1}` }];
    onChangeCases?.(next);
    onChangeActive?.(next.length - 1);
  };

  const removeActive = () => {
    if (cases.length <= MIN_CASES) return;
    const next = cases.filter((_, i) => i !== safeIndex);
    onChangeCases?.(next);
    onChangeActive?.(Math.max(0, safeIndex - 1));
  };

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: '#0D1117' }}
      aria-label="Sample test cases"
    >
      {/* Tabs */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1 flex-shrink-0"
        style={{ background: '#161B22', borderBottom: '1px solid #30363D', minHeight: 32 }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto" role="tablist" aria-label="Sample test cases">
          {cases.map((c, i) => {
            const active = i === safeIndex;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChangeActive?.(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const next = e.key === 'ArrowRight'
                      ? (safeIndex + 1) % cases.length
                      : (safeIndex - 1 + cases.length) % cases.length;
                    onChangeActive?.(next);
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
                {c.label || `Case ${i + 1}`}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={addCase}
            disabled={disabled || cases.length >= MAX_CASES}
            aria-label="Add test case"
            title={cases.length >= MAX_CASES ? `Maximum ${MAX_CASES} cases` : 'Add test case'}
            className="inline-flex items-center gap-1 px-1.5 py-1 text-2xs font-mono transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 4,
              color: cases.length >= MAX_CASES ? '#484F58' : '#9CA3AF',
              cursor: cases.length >= MAX_CASES ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!disabled && cases.length < MAX_CASES) e.currentTarget.style.background = '#21262D'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={10} aria-hidden />
            Add
          </button>
          <button
            type="button"
            onClick={removeActive}
            disabled={disabled || cases.length <= MIN_CASES}
            aria-label="Remove active test case"
            title={cases.length <= MIN_CASES ? 'At least one case required' : 'Remove active case'}
            className="inline-flex items-center gap-1 px-1.5 py-1 text-2xs font-mono transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 4,
              color: cases.length <= MIN_CASES ? '#484F58' : '#F85149',
              cursor: cases.length <= MIN_CASES ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!disabled && cases.length > MIN_CASES) e.currentTarget.style.background = 'rgba(248,81,73,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Trash2 size={10} aria-hidden />
          </button>
        </div>
      </div>

      {/* stdin textarea */}
      <div className="flex-1 min-h-0 flex flex-col p-2 gap-1">
        <label
          className="font-mono text-2xs uppercase tracking-wide"
          style={{ color: '#6B7280' }}
          htmlFor="test-case-stdin"
        >
          stdin
        </label>
        <textarea
          id="test-case-stdin"
          value={activeCase.stdin}
          onChange={(e) => updateActive(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          placeholder="// enter stdin for this test case…"
          className="flex-1 min-h-0 resize-none font-mono text-xs px-2 py-1.5"
          style={{
            background: '#010409',
            border: '1px solid #21262D',
            borderRadius: 4,
            color: '#F0F6FC',
            outline: 'none',
            lineHeight: 1.55,
          }}
          aria-label={`stdin for ${activeCase.label || `case ${safeIndex + 1}`}`}
        />
      </div>
    </div>
  );
};

export default TestCasePanel;
