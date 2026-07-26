import api from './api';

/**
 * workspaceChat — HTTP helpers for the Workspace Chat sidebar.
 *
 * Kept as a separate module (not merged into services/api.js) so the
 * chat layer can grow its own endpoints without inflating the main
 * API surface. Sprint 6 Commit 2 ships session CRUD only; Commit 3
 * will add the message endpoints alongside.
 *
 * The axios instance from services/api.js already handles auth token
 * injection + a global 401 redirect, so callers here just call and
 * await.
 */

export function getChats(projectId) {
  return api.get(`/workspace/${projectId}/chats`);
}

export function createChat(projectId, title) {
  return api.post(`/workspace/${projectId}/chats`, title ? { title } : {});
}

export function renameChat(chatId, title) {
  return api.patch(`/workspace/chats/${chatId}`, { title });
}

export function archiveChat(chatId) {
  return api.delete(`/workspace/chats/${chatId}`);
}

// ── Messages (Sprint 6 Commit 3) ──────────────────────────────────────────

export function getMessages(chatId) {
  return api.get(`/workspace/chats/${chatId}/messages`);
}

export function sendMessage(chatId, content) {
  return api.post(`/workspace/chats/${chatId}/messages`, { content });
}

// ── Regenerate (Sprint 6 Commit 6) ────────────────────────────────────────
// Rebuilds the most recent assistant reply by replaying the same pipeline
// (context + history + user turn) through the existing workspaceAI service.

export function regenerateMessage(chatId, messageId) {
  return api.post(`/workspace/chats/${chatId}/messages/${messageId}/regenerate`);
}
