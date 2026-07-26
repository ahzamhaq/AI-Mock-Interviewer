const workspaceContextService = require('../services/workspaceContext.service');

/**
 * workspaceContext.controller — thin HTTP layer over
 * workspaceContext.service.
 *
 * Sprint 6 Commit 4: reads the assembled context for a project the
 * caller owns. Missing project → 404 (not 403) so we don't leak the
 * existence of project ids that belong to other users. Same
 * non-leaking convention as the chat + message controllers.
 */

// GET /api/workspace/:projectId/context
const getContext = async (req, res, next) => {
  try {
    const context = await workspaceContextService.getWorkspaceContext(
      req.user._id,
      req.params.projectId,
    );
    if (!context) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }
    return res.json({ success: true, context });
  } catch (err) {
    next(err);
  }
};

module.exports = { getContext };
