const mongoose = require('mongoose');

/**
 * WorkspaceMessage — a single turn in a WorkspaceChat conversation.
 *
 * Introduced in Sprint 6 (v1.2.0). `citations` is reserved for future
 * repository file/line references that will let assistant messages
 * point users at the code they're grounded in. `usage` is a free-form
 * bag that tracks token counts when the AI provider exposes them.
 */
const workspaceMessageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkspaceChat',
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: { type: String, default: '' },
  // Reserved for future file references. Each entry will carry enough to
  // link back into the RepositoryAnalysis (path + optional line range).
  citations: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  // Token accounting from the AI provider — { promptTokens, completionTokens, totalTokens }.
  usage: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

const WorkspaceMessage = mongoose.model('WorkspaceMessage', workspaceMessageSchema);
module.exports = WorkspaceMessage;
