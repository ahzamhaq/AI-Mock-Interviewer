import React, { useState } from 'react';
import { User, Sparkles, Copy, RefreshCw, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import MarkdownContent from './MarkdownContent';
import { markdownToPlainText } from './markdownUtils';

/**
 * ChatMessage — a single conversation turn.
 *
 * Sprint 6 Commit 6:
 *   • Assistant messages render as Markdown (headings, lists, tables,
 *     fenced code with syntax highlighting + per-block Copy).
 *   • User messages render as plain preserved-whitespace text — no
 *     markdown, no XSS surface, matches what the user typed.
 *   • Both roles get a hover action row with Copy + timestamp; the
 *     assistant additionally gets Regenerate (only enabled when the
 *     parent hands down a handler, i.e. only for the newest reply).
 *   • Timestamp shows relative time in the row; absolute in the tooltip.
 *
 * Memoized in default export so scrolling through long conversations
 * doesn't re-render every bubble on every parent update.
 *
 * Props:
 *   role                 — 'user' | 'assistant'
 *   content              — message body (markdown for assistant)
 *   createdAt            — ISO string
 *   onRegenerate         — optional; presence enables the Regenerate button
 *   regenerating         — boolean; disables the button + shows spinner
 */
const ChatMessage = ({
  role = 'assistant',
  content,
  createdAt,
  onRegenerate,
  regenerating = false,
}) => {
  const isUser = role === 'user';
  const Icon = isUser ? User : Sparkles;
  const iconColor = isUser ? '#58A6FF' : '#D29922';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      const text = isUser ? String(content || '') : markdownToPlainText(content);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed.');
    }
  };

  const when = createdAt ? new Date(createdAt) : null;
  const relative = when ? formatDistanceToNow(when, { addSuffix: true }) : '';
  const absolute = when ? format(when, "PPpp") : '';

  return (
    <div
      className="group flex items-start gap-2"
      style={{ flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 26,
          height: 26,
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 6,
        }}
        aria-hidden
      >
        <Icon size={12} style={{ color: iconColor }} />
      </div>

      <div
        className="flex-1 min-w-0"
        style={{ maxWidth: '78%' }}
      >
        <div
          className="px-3 py-2"
          style={{
            background: '#0D1117',
            border: `1px solid ${isUser ? 'rgba(88,166,255,0.35)' : '#30363D'}`,
            borderRadius: 6,
          }}
        >
          <div
            className="font-mono text-2xs uppercase tracking-wide mb-1"
            style={{ color: iconColor }}
          >
            {isUser ? 'you' : 'assistant'}
          </div>
          {isUser ? (
            <p
              className="text-sm leading-relaxed"
              style={{
                color: '#F0F6FC',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {content}
            </p>
          ) : (
            <MarkdownContent content={content} />
          )}
        </div>

        {/* Hover action row — appears on group-hover, always available
            via keyboard focus. Timestamp doubles as a tooltip carrier
            for the absolute time. */}
        <div
          className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}
        >
          {when && (
            <span
              className="font-mono text-2xs"
              style={{ color: '#484F58' }}
              title={absolute}
            >
              {relative}
            </span>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={isUser ? 'Copy your message' : 'Copy response'}
            className="inline-flex items-center gap-1 font-mono text-2xs transition-colors"
            style={{
              color: copied ? '#3FB950' : '#6B7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = '#F0F6FC'; }}
            onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = '#6B7280'; }}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : isUser ? 'Copy' : 'Copy response'}
          </button>
          {!isUser && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              aria-label="Regenerate response"
              className="inline-flex items-center gap-1 font-mono text-2xs transition-colors"
              style={{
                color: '#6B7280',
                background: 'transparent',
                border: 'none',
                cursor: regenerating ? 'progress' : 'pointer',
                padding: '2px 4px',
              }}
              onMouseEnter={(e) => { if (!regenerating) e.currentTarget.style.color = '#F0F6FC'; }}
              onMouseLeave={(e) => { if (!regenerating) e.currentTarget.style.color = '#6B7280'; }}
            >
              {regenerating
                ? <Loader2 size={10} className="animate-spin" />
                : <RefreshCw size={10} />}
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatMessage);
