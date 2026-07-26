const WorkspaceChat = require('../models/WorkspaceChat.model');
const WorkspaceMessage = require('../models/WorkspaceMessage.model');
const workspaceContext = require('./workspaceContext.service');
const workspaceAI = require('./workspaceAI.service');

/**
 * workspaceMessage.service — persistence for chat messages.
 *
 * Sprint 6 Commit 5: real AI. The placeholder assistant text is gone.
 * On every send we now:
 *
 *   1. Persist the user message.
 *   2. Load repository context (once per send — Commit 4's service).
 *   3. Load the recent conversation history.
 *   4. Ask workspaceAI to generate a reply (which reuses the existing
 *      aiProviderManager under the hood).
 *   5. Persist the assistant message (real reply, or fallback text if
 *      the provider chain fails — workspaceAI never throws for a
 *      generation failure).
 *   6. Update the chat preview + lastMessageAt.
 *
 * The user message ALWAYS lands in the DB even when generation fails,
 * so conversations never dead-end on a lone user turn.
 *
 * No transactions — dev is often standalone Mongo. Ordered saves + a
 * best-effort preview update.
 */

const MAX_CONTENT_LENGTH = 4000;
const PREVIEW_LENGTH = 100;
const HISTORY_TAIL_LIMIT = 20;

class MessageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeContent(raw) {
  if (raw == null || typeof raw !== 'string') {
    throw new MessageValidationError('Message content is required.');
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new MessageValidationError('Message cannot be empty.');
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    throw new MessageValidationError(`Message cannot exceed ${MAX_CONTENT_LENGTH} characters.`);
  }
  return trimmed;
}

function makePreview(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > PREVIEW_LENGTH ? `${s.slice(0, PREVIEW_LENGTH - 1)}…` : s;
}

/**
 * Fetch the chat if it belongs to the user. Returns null on miss so
 * callers can 404 without leaking existence.
 */
async function findOwnedChat(userId, chatId) {
  return WorkspaceChat.findOne({ _id: chatId, user: userId });
}

/**
 * Pull the tail of the conversation, chronological, capped. This is the
 * history we hand the prompt builder — capping here rather than in the
 * builder keeps the DB fetch cheap and the builder stateless.
 *
 * We include the just-saved user message (it's the current turn — the
 * prompt builder is expected to shape the freshly-saved user turn as
 * `userMessage`, and the earlier history goes into `conversationHistory`
 * WITHOUT the current turn to avoid double-quoting).
 */
async function loadRecentHistory(chatId, excludeMessageId) {
  const rows = await WorkspaceMessage.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .limit(HISTORY_TAIL_LIMIT + 1) // +1 so we can drop the current turn
    .lean();
  // rows is newest-first — reverse to chronological, drop the just-saved
  // user message so the current turn isn't duplicated in the prompt.
  const chronological = rows.reverse();
  return chronological
    .filter((m) => String(m._id) !== String(excludeMessageId))
    .map(({ role, content }) => ({ role, content }));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Load messages for a chat in chronological order.
 * Returns null when the chat is not accessible to the user.
 */
async function loadMessages(userId, chatId) {
  const chat = await findOwnedChat(userId, chatId);
  if (!chat) return null;

  const messages = await WorkspaceMessage.find({ chat: chat._id })
    .sort({ createdAt: 1 })
    .lean();
  return messages;
}

/**
 * Save a user message, generate an AI reply grounded in repository
 * context, persist the assistant message, and update the chat preview.
 *
 * Returns { userMessage, assistantMessage } on success, or null when
 * the chat is not accessible to this user.
 *
 * Never throws on generation failure — workspaceAI degrades to a
 * friendly fallback string so the conversation shape stays consistent
 * from the caller's perspective.
 */
async function sendMessage(userId, chatId, { content }) {
  const chat = await findOwnedChat(userId, chatId);
  if (!chat) return null;

  const cleanContent = normalizeContent(content);

  // 1. User message — persist first so it's never lost even if the
  //    provider chain crashes hard below.
  const userMessage = await WorkspaceMessage.create({
    chat: chat._id,
    role: 'user',
    content: cleanContent,
  });

  // 2. Repository context (Commit 4). Best-effort — a context load
  //    failure should still produce a reply; the AI just won't have
  //    grounding data.
  let repositoryContext = null;
  try {
    repositoryContext = await workspaceContext.getWorkspaceContext(userId, chat.project);
  } catch (err) {
    console.error('[workspaceMessage] context load failed:', err.message);
  }

  // 3. Prior conversation, chronological, capped. Excludes the user
  //    turn we just saved (it becomes `userMessage` in the prompt).
  let conversationHistory = [];
  try {
    conversationHistory = await loadRecentHistory(chat._id, userMessage._id);
  } catch (err) {
    console.error('[workspaceMessage] history load failed:', err.message);
  }

  // 4. Generate. workspaceAI never throws — worst case returns
  //    { text: FALLBACK, providerError: '...' }.
  const { text, usage, providerError } = await workspaceAI.generate({
    repositoryContext,
    conversationHistory,
    userMessage: cleanContent,
  });
  if (providerError) {
    console.warn(`[workspaceMessage] AI fallback used (chat=${chat._id}): ${providerError}`);
  }

  // 5. Assistant message.
  const assistantMessage = await WorkspaceMessage.create({
    chat: chat._id,
    role: 'assistant',
    content: text,
    usage: usage && Object.keys(usage).length ? usage : {},
  });

  // 6. Chat preview + activity. Best-effort.
  try {
    const preview = makePreview(assistantMessage.content);
    const at = assistantMessage.createdAt || new Date();
    chat.lastMessagePreview = preview;
    chat.lastMessageAt = at;
    chat.lastMessage = preview; // legacy field kept in sync
    await chat.save();
  } catch (err) {
    console.error('[workspaceChat] preview update failed:', err.message);
  }

  return {
    userMessage: userMessage.toObject(),
    assistantMessage: assistantMessage.toObject(),
  };
}

/**
 * Regenerate an existing assistant message.
 *
 * Preconditions: `assistantMessageId` must be the LAST assistant turn
 * in the chat and must have a user turn immediately preceding it. On
 * regeneration we:
 *
 *   1. Snapshot the assistant message so we can restore it on failure.
 *   2. Locate the preceding user turn as the seed prompt.
 *   3. Delete the current assistant message.
 *   4. Rebuild history (now with the assistant turn gone) + repository
 *      context, hand to workspaceAI.generate — same pipeline as sendMessage.
 *   5. Persist a new assistant message (or restore the snapshot on
 *      hard failure).
 *   6. Refresh the chat preview.
 *
 * Returns { assistantMessage } on success, or null when the chat / message
 * is inaccessible. Throws MessageValidationError when the target isn't a
 * regeneratable assistant turn.
 */
async function regenerateAssistantMessage(userId, chatId, assistantMessageId) {
  const chat = await findOwnedChat(userId, chatId);
  if (!chat) return null;

  const target = await WorkspaceMessage.findOne({
    _id: assistantMessageId,
    chat: chat._id,
  });
  if (!target) return null;
  if (target.role !== 'assistant') {
    throw new MessageValidationError('Only assistant messages can be regenerated.');
  }

  // Confirm the target is the newest message in the chat — regenerating
  // a mid-history assistant turn is out of scope for this commit.
  const newest = await WorkspaceMessage.findOne({ chat: chat._id })
    .sort({ createdAt: -1 })
    .select('_id role')
    .lean();
  if (!newest || String(newest._id) !== String(target._id)) {
    throw new MessageValidationError('Only the most recent assistant reply can be regenerated.');
  }

  // Find the seed user turn (the one immediately before the target).
  const seed = await WorkspaceMessage.findOne({
    chat: chat._id,
    createdAt: { $lt: target.createdAt },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!seed || seed.role !== 'user') {
    throw new MessageValidationError('No preceding user message found to regenerate from.');
  }

  const snapshot = {
    role: target.role,
    content: target.content,
    usage: target.usage,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };

  // Remove the current assistant turn so it doesn't leak into the
  // history we're about to hand the prompt builder.
  await WorkspaceMessage.deleteOne({ _id: target._id });

  let repositoryContext = null;
  try {
    repositoryContext = await workspaceContext.getWorkspaceContext(userId, chat.project);
  } catch (err) {
    console.error('[workspaceMessage.regenerate] context load failed:', err.message);
  }

  let conversationHistory = [];
  try {
    // Exclude the seed (it becomes `userMessage` in the prompt) so the
    // current turn isn't quoted twice. Everything older is history.
    conversationHistory = await loadRecentHistory(chat._id, seed._id);
  } catch (err) {
    console.error('[workspaceMessage.regenerate] history load failed:', err.message);
  }

  let result;
  try {
    result = await workspaceAI.generate({
      repositoryContext,
      conversationHistory,
      userMessage: seed.content || '',
    });
  } catch (err) {
    // workspaceAI.generate is documented to never throw, but if
    // something wrapping it does, restore the snapshot so the user
    // isn't left with a broken conversation.
    console.error('[workspaceMessage.regenerate] unexpected throw:', err.message);
    await WorkspaceMessage.create({
      chat: chat._id,
      role: snapshot.role,
      content: snapshot.content,
      usage: snapshot.usage || {},
    });
    throw err;
  }

  const assistantMessage = await WorkspaceMessage.create({
    chat: chat._id,
    role: 'assistant',
    content: result.text,
    usage: result.usage && Object.keys(result.usage).length ? result.usage : {},
  });

  // Refresh preview.
  try {
    const preview = makePreview(assistantMessage.content);
    const at = assistantMessage.createdAt || new Date();
    chat.lastMessagePreview = preview;
    chat.lastMessageAt = at;
    chat.lastMessage = preview;
    await chat.save();
  } catch (err) {
    console.error('[workspaceChat] preview update failed:', err.message);
  }

  return { assistantMessage: assistantMessage.toObject() };
}

module.exports = {
  loadMessages,
  sendMessage,
  regenerateAssistantMessage,
  MessageValidationError,
  MAX_CONTENT_LENGTH,
};
