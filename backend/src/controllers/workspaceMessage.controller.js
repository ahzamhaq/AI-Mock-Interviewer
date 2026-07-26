const workspaceMessageService = require('../services/workspaceMessage.service');

/**
 * workspaceMessage.controller — thin HTTP layer over
 * workspaceMessage.service.
 *
 * Sprint 6 Commit 3: real messaging. Controllers only translate the
 * service's null → 404 and MessageValidationError → 400. Ownership +
 * input validation + persistence all live in the service.
 */

const { MessageValidationError } = workspaceMessageService;

function badRequest(res, message) {
  return res.status(400).json({ success: false, error: message });
}

// GET /api/workspace/chats/:chatId/messages
const getMessages = async (req, res, next) => {
  try {
    const messages = await workspaceMessageService.loadMessages(
      req.user._id,
      req.params.chatId,
    );
    if (messages === null) {
      return res.status(404).json({ success: false, error: 'Chat not found.' });
    }
    return res.json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};

// POST /api/workspace/chats/:chatId/messages  { content }
const sendMessage = async (req, res, next) => {
  try {
    const result = await workspaceMessageService.sendMessage(
      req.user._id,
      req.params.chatId,
      { content: req.body?.content },
    );
    if (result === null) {
      return res.status(404).json({ success: false, error: 'Chat not found.' });
    }
    return res.status(201).json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    });
  } catch (err) {
    if (err instanceof MessageValidationError) return badRequest(res, err.message);
    next(err);
  }
};

// POST /api/workspace/chats/:chatId/messages/:messageId/regenerate
// Sprint 6 Commit 6: rebuild the most recent assistant reply without
// duplicating any AI pipeline logic — service reuses workspaceAI +
// promptBuilder + workspaceContext exactly like sendMessage does.
const regenerateMessage = async (req, res, next) => {
  try {
    const result = await workspaceMessageService.regenerateAssistantMessage(
      req.user._id,
      req.params.chatId,
      req.params.messageId,
    );
    if (result === null) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }
    return res.status(201).json({
      success: true,
      assistantMessage: result.assistantMessage,
    });
  } catch (err) {
    if (err instanceof MessageValidationError) return badRequest(res, err.message);
    next(err);
  }
};

module.exports = { getMessages, sendMessage, regenerateMessage };
