const express = require('express');
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { getStats, getUsers, toggleUserStatus } = require('../controllers/admin.controller');
const { runCleanup } = require('../services/demoCleanup.service');

const router = express.Router();
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/toggle', toggleUserStatus);

// Manual trigger for the demo-account wipe. Same operation the nightly
// scheduler runs; useful when you need to reset the demo without waiting
// for 03:00 UTC. Admin-only via router.use above.
router.post('/demo/cleanup', async (req, res, next) => {
  try {
    await runCleanup();
    res.json({ success: true, message: 'Demo cleanup ran. Check server logs for per-account counts.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
