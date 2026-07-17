import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

/**
 * ConfidenceBadge — inline chip that surfaces the parser's confidence per
 * field. Three states:
 *
 *   unknown     — field marked in the parser's `unknown` array (red)
 *   low         — confidence < 0.7 (amber, "⚠ Please verify")
 *   high        — confidence ≥ 0.7 (subtle green check)
 *
 * The high state is intentionally quiet — celebrating every extracted
 * field would drown out the fields that actually need attention.
 *
 * Props:
 *   confidence — number 0–1
 *   unknown    — boolean
 */
const ConfidenceBadge = ({ confidence, unknown }) => {
  if (unknown) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wide px-1.5 py-0.5"
        style={{
          color: '#F85149',
          background: 'rgba(248,81,73,0.1)',
          border: '1px solid rgba(248,81,73,0.3)',
          borderRadius: 4,
        }}
      >
        <HelpCircle size={9} /> Unknown — please set
      </span>
    );
  }
  if (typeof confidence === 'number' && confidence < 0.7) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wide px-1.5 py-0.5"
        style={{
          color: '#D29922',
          background: 'rgba(210,153,34,0.1)',
          border: '1px solid rgba(210,153,34,0.3)',
          borderRadius: 4,
        }}
        title={`Confidence ${(confidence * 100).toFixed(0)}%`}
      >
        <AlertTriangle size={9} /> Please verify
      </span>
    );
  }
  if (typeof confidence === 'number' && confidence >= 0.7) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-2xs"
        style={{ color: '#3FB950' }}
        title={`Confidence ${(confidence * 100).toFixed(0)}%`}
      >
        <CheckCircle size={9} />
      </span>
    );
  }
  return null;
};

export default ConfidenceBadge;
