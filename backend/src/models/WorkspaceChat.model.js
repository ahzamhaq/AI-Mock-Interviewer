const mongoose = require('mongoose');

/**
 * WorkspaceChat — one chat session inside a Project workspace.
 *
 * Introduced in Sprint 6 (v1.2.0). Persists conversations grounded in a
 * repository. `provider` + `model` are stored per chat so a user can
 * pin a specific provider mid-conversation without affecting other
 * chats. `lastMessagePreview` + `lastMessageAt` power the sidebar's
 * activity-based sort. `lastMessage` is a legacy alias kept in sync.
 */
const workspaceChatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  title:       { type: String, default: 'New Chat', trim: true },
  provider:    { type: String, default: '' },
  model:       { type: String, default: '' },
  // Sprint 6 Commit 3 introduced dedicated preview fields. `lastMessage`
  // is retained for backward compatibility with anything reading the
  // Commit 1 shape; new writes populate `lastMessagePreview` and
  // `lastMessageAt` so the sidebar can sort by real activity time.
  lastMessage:        { type: String, default: '' },
  lastMessagePreview: { type: String, default: '' },
  lastMessageAt:      { type: Date, default: null },
  archived:    { type: Boolean, default: false },
}, { timestamps: true });

const WorkspaceChat = mongoose.model('WorkspaceChat', workspaceChatSchema);
module.exports = WorkspaceChat;
