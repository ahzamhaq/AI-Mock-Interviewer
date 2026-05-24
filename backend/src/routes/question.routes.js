const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const Question = require('../models/Question.model');

const router = express.Router();
router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const { role, type, difficulty, limit = 10 } = req.query;
    const query = { isActive: true };
    if (role) query.role = role;
    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;
    const questions = await Question.find(query).limit(parseInt(limit)).sort({ usageCount: 1 });
    res.json({ success: true, questions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
