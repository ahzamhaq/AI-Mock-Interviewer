const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getRoadmap, refreshRoadmap } = require('../controllers/coach.controller');

const router = express.Router();
router.use(protect);

router.get('/roadmap',         getRoadmap);
router.post('/roadmap/refresh', refreshRoadmap);

module.exports = router;
