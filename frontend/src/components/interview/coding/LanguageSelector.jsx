import React from 'react';
import { ChevronDown } from 'lucide-react';
import { CODE_LANGUAGES } from '../../../data/codeTemplates';

/**
 * LanguageSelector — plain native <select> styled to match the app.
 *
 * A native select is intentional: it works with keyboard navigation, is
 * screen-reader friendly by default, and requires zero custom focus /
 * dropdown logic. The visual chevron is decorative.
 *
 * Props:
 *   value    — current language value ('cpp' | 'python' | …)
 *   onChange — (next: string) => void
 *   disabled — boolean
 */
const LanguageSelector = ({ value, onChange, disabled = false }) => (
  <div className="relative inline-flex items-center">
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label="Select programming language"
      className="appearance-none pl-2.5 pr-6 py-1 font-mono text-xs cursor-pointer"
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 4,
        color: '#F0F6FC',
        outline: 'none',
      }}
    >
      {CODE_LANGUAGES.map((l) => (
        <option key={l.value} value={l.value} style={{ background: '#0D1117', color: '#F0F6FC' }}>
          {l.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={11}
      style={{
        color: '#6B7280',
        position: 'absolute',
        right: 6,
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  </div>
);

export default LanguageSelector;
