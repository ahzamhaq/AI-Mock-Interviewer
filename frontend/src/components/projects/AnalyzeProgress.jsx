import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';

/**
 * AnalyzeProgress — indeterminate "steps" indicator used by the Analyzing
 * page while the backend is doing repo analysis. The backend does not
 * expose step-level progress (it returns a single status), so we simulate
 * a plausible sequence purely as feedback theater: users see the pipeline
 * moving even though the underlying signal is binary.
 *
 * The animation continues to loop past the last step until the parent
 * unmounts the component (i.e. status flips to 'ready' or 'failed').
 */
const STEPS = [
  { label: 'Fetching repository tree' },
  { label: 'Selecting key files' },
  { label: 'Reading file contents' },
  { label: 'Detecting tech stack' },
  { label: 'Summarizing architecture' },
];

const STEP_DURATION_MS = 3500;

const AnalyzeProgress = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      // Advance up to the last step; then pin there so we don't imply completion.
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEP_DURATION_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <ul className="space-y-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const pending = i > step;
        return (
          <li
            key={s.label}
            className="flex items-center gap-2 font-mono text-2xs"
            style={{ color: done ? '#3FB950' : active ? '#F0F6FC' : '#484F58' }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 16,
                height: 16,
                background: done ? 'rgba(63,185,80,0.1)' : active ? '#161B22' : 'transparent',
                border: `1px solid ${done ? 'rgba(63,185,80,0.3)' : '#30363D'}`,
                borderRadius: 4,
              }}
            >
              {done ? (
                <Check size={9} />
              ) : active ? (
                <Loader2 size={9} className="animate-spin" style={{ color: '#58A6FF' }} />
              ) : (
                <span className="w-1 h-1 rounded-full" style={{ background: '#30363D' }} />
              )}
            </span>
            <span>{s.label}{active && '…'}</span>
            {pending && <span style={{ color: '#30363D' }}> · queued</span>}
          </li>
        );
      })}
    </ul>
  );
};

export default AnalyzeProgress;
