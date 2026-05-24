const express = require('express');
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { getStats, getUsers, toggleUserStatus } = require('../controllers/admin.controller');

const router = express.Router();
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/toggle', toggleUserStatus);

module.exports = router;
