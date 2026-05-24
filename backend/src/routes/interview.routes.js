const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createInterview, submitAnswer, completeInterview,
  getInterview, getInterviewHistory, abandonInterview, generateFollowUp,
} = require('../controllers/interview.controller');

const router = express.Router();

router.use(protect);

router.post('/', createInterview);
router.get('/history', getInterviewHistory);
router.get('/:id', getInterview);
router.post('/:interviewId/answer/:questionIndex', submitAnswer);
router.post('/:interviewId/follow-up/:questionIndex', generateFollowUp); // NEW
router.post('/:interviewId/complete', completeInterview);
router.patch('/:id/abandon', abandonInterview);

module.exports = router;
