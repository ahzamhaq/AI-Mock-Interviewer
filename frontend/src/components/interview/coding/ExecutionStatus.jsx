import React from 'react';
import {
  CheckCircle, AlertCircle, XCircle, Clock, Loader2, WifiOff, MinusCircle,
} from 'lucide-react';

/**
 * ExecutionStatus — compact status chip for the coding workspace.
 *
 * Sprint 7 Commit 4. Consumes the normalized status values emitted by
 * backend/services/judge0.service:
 *   idle | running | success | compilation_error | runtime_error
 *   | timeout | network_error | wrong_answer | queued | internal_error
 *   | unsupported_language | empty_source | source_too_large
 */

const STATUS_META = {
  idle:                  { label: 'Idle',              color: '#6B7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)',  Icon: MinusCircle,     spin: false },
  running:               { label: 'Running…',          color: '#58A6FF', bg: 'rgba(88,166,255,0.1)',   border: 'rgba(88,166,255,0.3)',   Icon: Loader2,         spin: true  },
  queued:                { label: 'Queued…',           color: '#58A6FF', bg: 'rgba(88,166,255,0.1)',   border: 'rgba(88,166,255,0.3)',   Icon: Loader2,         spin: true  },
  success:               { label: 'Success',           color: '#3FB950', bg: 'rgba(63,185,80,0.1)',    border: 'rgba(63,185,80,0.3)',    Icon: CheckCircle,     spin: false },
  wrong_answer:          { label: 'Wrong Answer',      color: '#F85149', bg: 'rgba(248,81,73,0.1)',    border: 'rgba(248,81,73,0.3)',    Icon: XCircle,         spin: false },
  compilation_error:     { label: 'Compile Error',     color: '#F85149', bg: 'rgba(248,81,73,0.1)',    border: 'rgba(248,81,73,0.3)',    Icon: AlertCircle,     spin: false },
  runtime_error:         { label: 'Runtime Error',     color: '#F85149', bg: 'rgba(248,81,73,0.1)',    border: 'rgba(248,81,73,0.3)',    Icon: AlertCircle,     spin: false },
  timeout:               { label: 'Timeout',           color: '#D29922', bg: 'rgba(210,153,34,0.1)',   border: 'rgba(210,153,34,0.3)',   Icon: Clock,           spin: false },
  network_error:         { label: 'Network Error',     color: '#F85149', bg: 'rgba(248,81,73,0.1)',    border: 'rgba(248,81,73,0.3)',    Icon: WifiOff,         spin: false },
  internal_error:        { label: 'Service Error',     color: '#F85149', bg: 'rgba(248,81,73,0.1)',    border: 'rgba(248,81,73,0.3)',    Icon: AlertCircle,     spin: false },
  config_error:          { label: 'Not Configured',    color: '#D29922', bg: 'rgba(210,153,34,0.1)',   border: 'rgba(210,153,34,0.3)',   Icon: AlertCircle,     spin: false },
  unsupported_language:  { label: 'Unsupported',       color: '#D29922', bg: 'rgba(210,153,34,0.1)',   border: 'rgba(210,153,34,0.3)',   Icon: AlertCircle,     spin: false },
  empty_source:          { label: 'No Code',           color: '#6B7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)',  Icon: MinusCircle,     spin: false },
  source_too_large:      { label: 'Source Too Large',  color: '#D29922', bg: 'rgba(210,153,34,0.1)',   border: 'rgba(210,153,34,0.3)',   Icon: AlertCircle,     spin: false },
};

const ExecutionStatus = ({ status = 'idle', detail = '' }) => {
  const meta = STATUS_META[status] || STATUS_META.idle;
  const { Icon, label, color, bg, border, spin } = meta;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono"
      style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: 4 }}
      role="status"
      aria-live="polite"
      aria-label={`Execution status: ${label}${detail ? ` — ${detail}` : ''}`}
      title={detail || label}
    >
      <Icon size={11} className={spin ? 'animate-spin' : ''} aria-hidden />
      {label}
    </span>
  );
};

export default ExecutionStatus;
