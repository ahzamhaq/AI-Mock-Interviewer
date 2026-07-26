const workspaceChatService = require('../services/workspaceChat.service');

/**
 * workspaceChat.controller — thin HTTP layer over workspaceChat.service.
 *
 * Sprint 6 Commit 2: real chat session CRUD. Controllers only delegate
 * to the service, translate result shapes into HTTP responses, and map
 * ChatValidationError → 400. Ownership + input validation live in the
 * service.
 *
 * Missing chats always return 404 (not 403) so we don't leak the
 * existence of chat ids that belong to other users.
 */

const { ChatValidationError } = workspaceChatService;

function badRequest(res, message) {
  return res.status(400).json({ success: false, error: message });
}

// GET /api/workspace/:projectId/chats
const listChats = async (req, res, next) => {
  try {
    const chats = await workspaceChatService.listChats(req.user._id, req.params.projectId);
    return res.json({ success: true, chats });
  } catch (err) {
    next(err);
  }
};

// POST /api/workspace/:projectId/chats  { title? }
const createChat = async (req, res, next) => {
  try {
    const chat = await workspaceChatService.createChat(
      req.user._id,
      req.params.projectId,
      { title: req.body?.title },
    );
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }
    return res.status(201).json({ success: true, chat });
  } catch (err) {
    if (err instanceof ChatValidationError) return badRequest(res, err.message);
    next(err);
  }
};

// PATCH /api/workspace/chats/:chatId  { title }
const renameChat = async (req, res, next) => {
  try {
    const chat = await workspaceChatService.renameChat(
      req.user._id,
      req.params.chatId,
      { title: req.body?.title },
    );
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found.' });
    }
    return res.json({ success: true, chat });
  } catch (err) {
    if (err instanceof ChatValidationError) return badRequest(res, err.message);
    next(err);
  }
};

// DELETE /api/workspace/chats/:chatId — soft delete (archive)
const archiveChat = async (req, res, next) => {
  try {
    const chat = await workspaceChatService.archiveChat(req.user._id, req.params.chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listChats, createChat, renameChat, archiveChat };
