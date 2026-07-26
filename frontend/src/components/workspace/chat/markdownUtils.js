/**
 * markdownUtils — tiny helpers used by the chat surface.
 *
 * Kept out of a component file so both ChatMessage and Chat title
 * derivation can share them.
 */

/**
 * Strip common Markdown syntax so a message can be copied as plain
 * readable text. Not a full parser — the goal is: no `**bold**` marks
 * on the clipboard, no leading `# ` on headings, no fence lines
 * bracketing code. Keeps the actual code content intact.
 */
export function markdownToPlainText(md) {
  if (!md) return '';
  let s = String(md);

  // Fenced code blocks — keep the code, drop the fence lines.
  s = s.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, body) => body);

  // Inline code — strip the backticks.
  s = s.replace(/`([^`]+)`/g, '$1');

  // Headings — drop leading #s.
  s = s.replace(/^#{1,6}\s+/gm, '');

  // Bold / italic. Order matters — bold first (** or __), then italic.
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');

  // Links: [text](url) → text.
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Blockquote prefix.
  s = s.replace(/^>\s?/gm, '');

  // Bullet lists — normalize to a dash.
  s = s.replace(/^\s*[-*+]\s+/gm, '- ');

  // Horizontal rules.
  s = s.replace(/^[-*_]{3,}\s*$/gm, '');

  return s.trim();
}

/**
 * Derive a short chat title from the user's first prompt. Local — never
 * calls the AI. Aims for ~30 chars, capitalized, no trailing punctuation.
 *
 * Empty / whitespace input returns null so the caller can skip the
 * rename.
 */
const TITLE_MAX = 30;

export function deriveChatTitle(userMessage) {
  if (!userMessage) return null;
  const clean = markdownToPlainText(userMessage)
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  // Prefer the first sentence; fall back to the first line.
  const sentence = clean.split(/[.!?\n]/)[0].trim();
  const seed = sentence || clean;

  if (seed.length <= TITLE_MAX) {
    return capitalize(seed);
  }
  // Cut at the last word boundary within the limit.
  const cut = seed.slice(0, TITLE_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > 12 ? cut.slice(0, lastSpace) : cut;
  return `${capitalize(trimmed.replace(/[,;:—-]+$/, ''))}…`;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
