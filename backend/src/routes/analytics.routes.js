const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getDashboardStats, getDetailedAnalytics } = require('../controllers/analytics.controller');

const router = express.Router();

router.use(protect);
router.get('/dashboard', getDashboardStats);
router.get('/detailed', getDetailedAnalytics);

module.exports = router;
