const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createInterview, submitAnswer, getNextQuestion, completeInterview,
  getInterview, getInterviewHistory, abandonInterview, generateFollowUp,
  listPersonalities, listRounds, handleNudge, resumeInterview,
} = require('../controllers/interview.controller');

const router = express.Router();

router.use(protect);

router.get('/personalities', listPersonalities); // static registry of interviewer personalities
router.get('/rounds', listRounds);               // static registry of interview round types
router.post('/', createInterview);
router.get('/history', getInterviewHistory);
router.get('/:id', getInterview);
router.post('/:interviewId/answer/:questionIndex', submitAnswer);
router.post('/:interviewId/next-question', getNextQuestion); // adaptive next-question endpoint
router.post('/:interviewId/nudge', handleNudge);             // silence/thinking nudge
router.post('/:interviewId/resume', resumeInterview);        // session resume + recap
router.post('/:interviewId/follow-up/:questionIndex', generateFollowUp); // legacy / manual follow-up
router.post('/:interviewId/complete', completeInterview);
router.patch('/:id/abandon', abandonInterview);

module.exports = router;
