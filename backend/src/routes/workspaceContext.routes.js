const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getContext } = require('../controllers/workspaceContext.controller');

const router = express.Router();

// Per-user; require auth. Same pattern as workspaceChat.routes.
router.use(protect);

router.get('/:projectId/context', getContext);

module.exports = router;
