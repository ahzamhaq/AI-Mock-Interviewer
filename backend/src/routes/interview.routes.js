const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createInterview, submitAnswer, getNextQuestion, completeInterview,
  getInterview, getInterviewHistory, abandonInterview, generateFollowUp,
  listPersonalities, listRounds, handleNudge, resumeInterview,
  retryQuestion, requestHint,
  runCode, submitCode, retryEvaluation,
} = require('../controllers/interview.controller');
const { parse: parseInterviewPrompt } = require('../controllers/interviewParser.controller');

const router = express.Router();

router.use(protect);

router.get('/personalities', listPersonalities); // static registry of interviewer personalities
router.get('/rounds', listRounds);               // static registry of interview round types
router.post('/', createInterview);
router.post('/parse', parseInterviewPrompt); // Sprint 5 Commit 4 — NL prompt → Interview Draft
router.get('/history', getInterviewHistory);
router.get('/:id', getInterview);
router.post('/:interviewId/answer/:questionIndex', submitAnswer);
router.post('/:interviewId/next-question', getNextQuestion); // adaptive next-question endpoint
router.post('/:interviewId/nudge', handleNudge);             // silence/thinking nudge
router.post('/:interviewId/hint', requestHint);              // Sprint 7 Commit 2 — progressive DSA hint
router.post('/:interviewId/run', runCode);                   // Sprint 7 Commit 4 — Judge0 run (sample stdin)
router.post('/:interviewId/submit', submitCode);             // Sprint 7 Commit 4 — Judge0 submit (hidden tests)
router.post('/:interviewId/evaluate', retryEvaluation);      // Sprint 7 Commit 5 — retry Code Evaluation
router.post('/:interviewId/resume', resumeInterview);        // session resume + recap
router.post('/:interviewId/follow-up/:questionIndex', generateFollowUp); // legacy / manual follow-up
router.post('/:interviewId/complete', completeInterview);
router.post('/:id/retry-question', retryQuestion); // create a NEW short interview from one question of an old one
router.patch('/:id/abandon', abandonInterview);

module.exports = router;
