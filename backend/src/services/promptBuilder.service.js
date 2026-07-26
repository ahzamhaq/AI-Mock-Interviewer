/**
 * promptBuilder.service — turns structured context + history + a user
 * message into a single provider-agnostic prompt string.
 *
 * The existing AI Provider Manager (aiProviderManager.generate) accepts
 * a single string, so this builder concatenates a system section,
 * repository context, prior conversation, and the current turn into one
 * readable prompt. Provider-specific formatting stays out — that's the
 * Provider Manager's job.
 *
 * Zero side effects. No Express, no Mongo, no network. Pure text
 * assembly. That makes this trivially unit-testable and reusable if we
 * ever swap the provider layer.
 */

const HISTORY_MAX_MESSAGES = 20;
const HISTORY_MAX_CHARS = 12000;
const USER_MESSAGE_MAX_CHARS = 4000;
const PER_HISTORY_TURN_MAX = 1200;

const SYSTEM_PROMPT = `You are a senior software engineer helping a developer explore and understand a specific repository.

CONTENT RULES:
- Answer using ONLY the repository context provided below. Do not invent files, functions, endpoints, or dependencies that the context does not mention.
- If the answer cannot be determined from the context, say so directly ("The provided context does not include this") instead of guessing.
- Prefer explaining the architecture and reasoning over speculating about implementation details.
- When suggesting improvements, clearly separate observations ("here is what the code does") from recommendations ("here is what could change").
- Be concise but technically accurate.

FORMATTING RULES — always use structured Markdown:
- Use \`##\` for major section headings (e.g. "## Architecture", "## Authentication"). Use \`###\` for sub-sections.
- Use \`-\` bullet lists for enumerations, features, steps, and answer sets. Never use plain paragraphs for a list of items.
- Use \`**bold**\` sparingly, only for the most important term in a sentence.
- Wrap file paths, function names, config keys, and short identifiers in \`inline code\`.
- Use fenced code blocks (\`\`\`ts / \`\`\`js / \`\`\`bash) for real code or commands. Never wrap the whole reply in a code block.
- Leave a blank line between paragraphs, between a heading and its content, and between list groups.
- When asked to generate a list of things (e.g. "generate 5 interview questions"), output them as a numbered list \`1.\`, \`2.\`, ... with each item on its own line. Never run items together.`;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a single prompt string.
 *
 * @param {Object} input
 * @param {Object|null} input.repositoryContext   context from workspaceContext.service
 * @param {Array}       input.conversationHistory chronological array of prior messages
 *                                                (each: { role, content })
 * @param {string}      input.userMessage         the freshly submitted user turn
 * @returns {{ systemPrompt: string, prompt: string }}
 */
function build({ repositoryContext = null, conversationHistory = [], userMessage = '' }) {
  const cleanUserMessage = truncate(String(userMessage || '').trim(), USER_MESSAGE_MAX_CHARS);

  const parts = [];
  parts.push('[SYSTEM]');
  parts.push(SYSTEM_PROMPT);
  parts.push('');

  parts.push('[REPOSITORY CONTEXT]');
  parts.push(renderContext(repositoryContext));
  parts.push('');

  const historyText = renderHistory(conversationHistory);
  if (historyText) {
    parts.push('[CONVERSATION HISTORY]');
    parts.push(historyText);
    parts.push('');
  }

  parts.push('[CURRENT USER QUESTION]');
  parts.push(cleanUserMessage || '(empty message)');
  parts.push('');
  parts.push('[YOUR RESPONSE]');

  return {
    systemPrompt: SYSTEM_PROMPT,
    prompt: parts.join('\n'),
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────

/**
 * Render the repository context object into a readable textual form.
 * Raw JSON would work but readable prose lets the model reason more
 * fluently and lets us omit empty fields cleanly.
 */
function renderContext(context) {
  if (!context) {
    return 'No repository context is available for this workspace. Answer the user\'s question honestly — if it requires repository knowledge, tell them the analysis is not ready.';
  }

  const { project, repository, analysis, meta } = context;
  const lines = [];

  if (project?.fullName || project?.name) {
    lines.push(`Repository: ${project.fullName || project.name}`);
  }
  if (project?.description) {
    lines.push(`Description: ${project.description}`);
  }

  const repoBits = [];
  if (repository?.language)  repoBits.push(`language: ${repository.language}`);
  if (repository?.framework) repoBits.push(`primary framework: ${repository.framework}`);
  if (repository?.defaultBranch) repoBits.push(`default branch: ${repository.defaultBranch}`);
  if (repository?.private != null) repoBits.push(`visibility: ${repository.private ? 'private' : 'public'}`);
  if (repoBits.length) lines.push(repoBits.join(' · '));

  // Analysis may be null when it hasn't run / is still processing.
  if (!analysis) {
    lines.push('');
    if (meta?.analysisStatus === 'processing') {
      lines.push('Repository analysis is still in progress — deep structural information is not yet available.');
    } else if (meta?.analysisStatus === 'failed') {
      lines.push('Repository analysis failed and has no structural data attached.');
    } else {
      lines.push('This repository has not been analyzed yet — only high-level metadata is available.');
    }
    return lines.join('\n');
  }

  if (analysis.summary) {
    lines.push('');
    lines.push('Summary:');
    lines.push(analysis.summary);
  }
  if (analysis.architecture) {
    lines.push('');
    lines.push('Architecture:');
    lines.push(analysis.architecture);
  }
  if (analysis.techStack && Object.keys(analysis.techStack).length) {
    lines.push('');
    lines.push('Tech stack:');
    for (const [category, items] of Object.entries(analysis.techStack)) {
      if (!items?.length) continue;
      lines.push(`- ${category}: ${items.map((t) => t.name).join(', ')}`);
    }
  }
  if (analysis.keyDirectories?.length) {
    lines.push('');
    lines.push('Key directories:');
    for (const d of analysis.keyDirectories) {
      lines.push(`- ${d.path} (${d.files} file${d.files === 1 ? '' : 's'})`);
    }
  }
  if (analysis.keyFiles?.length) {
    lines.push('');
    lines.push('Key files:');
    for (const f of analysis.keyFiles) {
      const purpose = f.purpose ? ` — ${f.purpose}` : '';
      lines.push(`- ${f.path}${purpose}`);
    }
  }

  return lines.join('\n');
}

/**
 * Serialize conversation history into a compact textual transcript.
 * Truncates individual turns and stops appending once the total budget
 * is reached (newest turns kept preferentially).
 */
function renderHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return '';

  // Newest N messages first; then reverse so the actual transcript is
  // still chronological in the prompt.
  const recent = history.slice(-HISTORY_MAX_MESSAGES);

  const rendered = [];
  let totalChars = 0;
  // Walk backwards so we preserve the newest turns when we hit the cap.
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (!m?.role || typeof m.content !== 'string') continue;
    const label = m.role === 'assistant' ? 'Assistant' : 'User';
    const body = truncate(m.content.trim(), PER_HISTORY_TURN_MAX);
    const line = `${label}: ${body}`;
    if (totalChars + line.length > HISTORY_MAX_CHARS) break;
    rendered.unshift(line);
    totalChars += line.length;
  }
  return rendered.join('\n\n');
}

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

module.exports = {
  build,
  // Exported for tests / debugging.
  SYSTEM_PROMPT,
  HISTORY_MAX_MESSAGES,
  HISTORY_MAX_CHARS,
};
