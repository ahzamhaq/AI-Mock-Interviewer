import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * CodeBlock — fenced-code renderer used inside MarkdownContent.
 *
 * Wraps `rehype-highlight`'s output with a header strip (detected
 * language) and a Copy button. Long lines scroll horizontally inside
 * the block; the block itself never overflows the chat layout.
 *
 * Called by react-markdown via its `code` component override — receives
 * `className` in the form "language-<name>" for fenced blocks. Inline
 * code (no className) is rendered by a separate override in
 * MarkdownContent so this component only handles the block case.
 */
const CodeBlock = ({ className = '', children }) => {
  const [copied, setCopied] = useState(false);

  const langMatch = /language-([\w+-]+)/i.exec(className);
  const language = langMatch ? langMatch[1] : 'plain';

  // children arrives from react-markdown as the raw text plus optional
  // <span> nodes from rehype-highlight. We want the raw text for copy.
  const rawText = extractText(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed.');
    }
  };

  return (
    <div
      className="my-3"
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          background: '#161B22',
          borderBottom: '1px solid #21262D',
        }}
      >
        <span
          className="font-mono text-2xs uppercase tracking-wide"
          style={{ color: '#6B7280' }}
        >
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1 font-mono text-2xs transition-colors"
          style={{
            color: copied ? '#3FB950' : '#9CA3AF',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="p-3 overflow-x-auto"
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.55,
          color: '#F0F6FC',
        }}
      >
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

// Walk children (which may be strings or React nodes from rehype-highlight)
// and stitch their text content back together for the clipboard.
function extractText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props && node.props.children) return extractText(node.props.children);
  return '';
}

export default CodeBlock;
