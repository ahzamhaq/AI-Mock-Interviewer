const WorkspaceChat = require('../models/WorkspaceChat.model');
const Project = require('../models/Project.model');

/**
 * workspaceChat.service — session management for Workspace Chat.
 *
 * Sprint 6 Commit 2: session layer only. No messaging, no AI, no
 * persistence beyond the chat document itself. Commit 3 will add the
 * message layer on top.
 *
 * Ownership contract:
 *   Every operation is scoped by user id. If a chat is not found for
 *   the requesting user we return null (never 403) so we don't leak
 *   the existence of chat ids that belong to someone else.
 *
 * All functions are pure business logic — no Express objects. Controllers
 * convert null returns into 404 responses.
 */

const MAX_TITLE_LENGTH = 100;
const DEFAULT_TITLE = 'New Chat';

class ChatValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChatValidationError';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTitle(raw, { required = false } = {}) {
  if (raw == null || raw === '') {
    if (required) throw new ChatValidationError('Title is required.');
    return DEFAULT_TITLE;
  }
  if (typeof raw !== 'string') {
    throw new ChatValidationError('Title must be a string.');
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new ChatValidationError('Title cannot be empty.');
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new ChatValidationError(`Title cannot exceed ${MAX_TITLE_LENGTH} characters.`);
  }
  return trimmed;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * List non-archived chats for a user, scoped to a project.
 * Ordered by updatedAt DESC (Mongoose bumps this on any save, so it
 * naturally reflects "most recent activity"), tiebroken by createdAt.
 *
 * If the project does not belong to the user, returns an empty list
 * — same non-leaking behavior as chat lookups.
 */
async function listChats(userId, projectId) {
  // Confirm the project belongs to the user. On mismatch, return [] so
  // callers can't distinguish "no chats" from "not your project."
  const project = await Project.findOne({ _id: projectId, userId }).select('_id').lean();
  if (!project) return [];

  return WorkspaceChat.find({
    user: userId,
    project: projectId,
    archived: false,
  })
    // Sprint 6 Commit 3: sort by real message activity when present;
    // fall back to updatedAt so freshly created chats with no messages
    // still surface at the top.
    .sort({ lastMessageAt: -1, updatedAt: -1, createdAt: -1 })
    .lean();
}

/**
 * Create a new chat for the (user, project) pair. Defaults the title
 * to DEFAULT_TITLE when not provided; otherwise trims and validates.
 * Throws ChatValidationError on bad input. Returns null when the
 * project does not belong to the user.
 */
async function createChat(userId, projectId, { title } = {}) {
  const project = await Project.findOne({ _id: projectId, userId }).select('_id').lean();
  if (!project) return null;

  const finalTitle = title == null || title === ''
    ? DEFAULT_TITLE
    : normalizeTitle(title);

  const chat = await WorkspaceChat.create({
    user: userId,
    project: projectId,
    title: finalTitle,
    provider: '',
    model: '',
    lastMessage: '',
    archived: false,
  });

  return chat.toObject();
}

/**
 * Rename a chat. Trims + validates the title.
 * Returns null when the chat does not exist for this user (404-friendly).
 */
async function renameChat(userId, chatId, { title }) {
  const finalTitle = normalizeTitle(title, { required: true });

  const chat = await WorkspaceChat.findOne({ _id: chatId, user: userId });
  if (!chat) return null;

  chat.title = finalTitle;
  await chat.save();
  return chat.toObject();
}

/**
 * Archive a chat (soft delete). Returns null when the chat does not
 * exist for this user (404-friendly).
 */
async function archiveChat(userId, chatId) {
  const chat = await WorkspaceChat.findOne({ _id: chatId, user: userId });
  if (!chat) return null;
  if (!chat.archived) {
    chat.archived = true;
    await chat.save();
  }
  return chat.toObject();
}

module.exports = {
  listChats,
  createChat,
  renameChat,
  archiveChat,
  ChatValidationError,
};
