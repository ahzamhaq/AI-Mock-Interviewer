const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  listChats, createChat, renameChat, archiveChat,
} = require('../controllers/workspaceChat.controller');
const {
  getMessages, sendMessage, regenerateMessage,
} = require('../controllers/workspaceMessage.controller');

const router = express.Router();

// Every Workspace Chat endpoint is per-user; require auth. Same pattern
// as the rest of the workspace/project routes.
router.use(protect);

// Chats — scoped to a Project.
router.get('/:projectId/chats',  listChats);
router.post('/:projectId/chats', createChat);
router.patch('/chats/:chatId',   renameChat);
router.delete('/chats/:chatId',  archiveChat);

// Messages — scoped to a Chat.
router.get('/chats/:chatId/messages',  getMessages);
router.post('/chats/:chatId/messages', sendMessage);
router.post('/chats/:chatId/messages/:messageId/regenerate', regenerateMessage);

module.exports = router;
