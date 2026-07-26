import api from './api';

/**
 * workspaceContext — HTTP helper for the repository context object
 * assembled by workspaceContext.service on the backend.
 *
 * Kept in its own module (not folded into workspaceChat.js) so the
 * messaging layer and the context layer stay independent. WorkspaceChatPage
 * calls this once when the project changes; Commit 5's prompt builder
 * will consume the cached result without re-fetching per message.
 */

export function getWorkspaceContext(projectId) {
  return api.get(`/workspace/${projectId}/context`);
}
