const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { list } = require('../controllers/recommendations.controller');

const router = express.Router();
router.use(protect);
router.get('/', list);

module.exports = router;
