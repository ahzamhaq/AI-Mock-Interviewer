const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { getProfile, updateProfile, uploadResume, getLeaderboard, changePassword } = require('../controllers/user.controller');

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/resume', upload.single('resume'), uploadResume);
router.put('/password', changePassword);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
