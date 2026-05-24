const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { synthesize } = require('../controllers/tts.controller');

const router = express.Router();
router.use(protect);
router.post('/', synthesize);

module.exports = router;
