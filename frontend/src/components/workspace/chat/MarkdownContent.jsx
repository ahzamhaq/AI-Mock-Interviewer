import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import CodeBlock from './CodeBlock';

/**
 * MarkdownContent — assistant-message body renderer.
 *
 * Sprint 6 Commit 6:
 *   • react-markdown for GFM (headings, bold, italic, lists, tables,
 *     blockquotes, HRs, links, inline code, fenced code).
 *   • rehype-highlight + highlight.js "github-dark" theme.
 *   • CodeBlock override for fenced code (Copy button, language badge).
 *   • Overrides for anchor + table so they respect the chat layout
 *     (external links open in a new tab, tables scroll horizontally).
 *
 * User messages skip markdown intentionally — the raw text is what the
 * user typed, and rendering it as markdown would let them (accidentally
 * or maliciously) style the transcript.
 */

const components = {
  code({ inline, className, children }) {
    // Inline code — tight badge inside a sentence.
    if (inline || !className) {
      return (
        <code
          style={{
            background: '#161B22',
            border: '1px solid #21262D',
            borderRadius: 3,
            padding: '1px 4px',
            fontSize: '0.85em',
            color: '#F0F6FC',
          }}
        >
          {children}
        </code>
      );
    }
    // Fenced block — delegate to CodeBlock for the header + copy.
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  a({ href, children }) {
    const isExternal = /^https?:\/\//i.test(href || '');
    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noreferrer' : undefined}
        style={{ color: '#58A6FF', textDecoration: 'underline' }}
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 12,
            width: '100%',
          }}
        >
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th
        style={{
          textAlign: 'left',
          padding: '6px 8px',
          background: '#161B22',
          border: '1px solid #30363D',
          color: '#F0F6FC',
          fontWeight: 600,
        }}
      >
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td
        style={{
          padding: '6px 8px',
          border: '1px solid #21262D',
          color: '#F0F6FC',
        }}
      >
        {children}
      </td>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote
        style={{
          borderLeft: '3px solid #30363D',
          margin: '0.75rem 0',
          padding: '0.25rem 0.75rem',
          color: '#9CA3AF',
        }}
      >
        {children}
      </blockquote>
    );
  },
  hr() {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid #21262D',
          margin: '1rem 0',
        }}
      />
    );
  },
};

// Tailwind's preflight strips default spacing off headings, paragraphs,
// and lists. react-markdown emits those raw, so without local styles the
// output collapses into a wall of text. This scoped block restores the
// spacing hierarchy for chat messages only — it does not leak to the
// rest of the app.
const MARKDOWN_STYLES = `
.chat-md { color: #F0F6FC; line-height: 1.6; }
.chat-md > *:first-child { margin-top: 0; }
.chat-md > *:last-child  { margin-bottom: 0; }
.chat-md p       { margin: 0 0 0.7rem; }
.chat-md h1      { font-size: 1.15rem; font-weight: 600; margin: 1.1rem 0 0.5rem; color: #F0F6FC; }
.chat-md h2      { font-size: 1.05rem; font-weight: 600; margin: 1rem 0 0.45rem; color: #F0F6FC; }
.chat-md h3      { font-size: 0.98rem; font-weight: 600; margin: 0.9rem 0 0.4rem; color: #F0F6FC; }
.chat-md h4, .chat-md h5, .chat-md h6 {
  font-size: 0.9rem; font-weight: 600; margin: 0.8rem 0 0.35rem; color: #F0F6FC;
}
.chat-md ul, .chat-md ol { margin: 0.25rem 0 0.85rem; padding-left: 1.35rem; }
.chat-md li      { margin: 0.2rem 0; }
.chat-md ul      { list-style: disc; }
.chat-md ol      { list-style: decimal; }
.chat-md li > p  { margin: 0; }
.chat-md li::marker { color: #58A6FF; }
.chat-md strong  { color: #F0F6FC; font-weight: 600; }
.chat-md em      { color: #E6EDF3; font-style: italic; }
`;

const MarkdownContent = ({ content }) => (
  <>
    <style>{MARKDOWN_STYLES}</style>
    <div className="chat-md text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  </>
);

export default React.memo(MarkdownContent);
