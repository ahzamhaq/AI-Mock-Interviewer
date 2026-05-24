const Interview = require('../models/Interview.model');
const User = require('../models/User.model');
const aiService = require('../services/ai.service');
const memoryService = require('../services/memory.service');

// Create a new interview session
const createInterview = async (req, res, next) => {
  try {
    const { role, experienceLevel, companyType, targetCompany, interviewType, difficulty, totalQuestions, jobDescription, useResume } = req.body;

    const user = await User.findById(req.user._id);
    const resumeText = useResume ? user.resumeText : '';

    // Build adaptive memory context for this session
    const memory = await memoryService.getUserMemory(req.user._id, role);
    const memoryContext = memoryService.buildMemoryContext(memory);

    // Generate questions with memory injected
    const aiQuestions = await aiService.generateInterviewQuestions({
      role, experienceLevel, companyType, targetCompany, interviewType,
      difficulty, totalQuestions: parseInt(totalQuestions) || 5,
      jobDescription, resumeText, memoryContext,
    });

    // Anti-repetition filter — replace duplicates with weak-topic-focused alternatives
    const filtered = [];
    const weakTopicQueue = (memory.weakTopics || []).map(t => t.topic);
    for (const q of aiQuestions) {
      const dup = await memoryService.isDuplicateQuestion(req.user._id, q.text);
      if (!dup) {
        filtered.push(q);
        continue;
      }
      const targetTopic = weakTopicQueue.shift() || q.topic || 'general';
      const replacement = await aiService.generateReplacementQuestion(
        { role, experienceLevel, difficulty, interviewType },
        targetTopic
      );
      if (replacement) filtered.push(replacement);
      else filtered.push(q); // fall back to original if AI can't replace
    }

    const finalQuestions = filtered.slice(0, parseInt(totalQuestions) || 5);

    const questions = finalQuestions.map((q) => ({
      questionText: q.text,
      questionType: q.type || interviewType,
      topic: q.topic || '',
      hints: q.hints || [],
      aiFeedback: {},
      voiceMetrics: {},
    }));

    const interview = await Interview.create({
      userId: req.user._id,
      title: `${role.replace(/_/g, ' ')} - ${interviewType} Interview`,
      config: { role, experienceLevel, companyType, targetCompany, interviewType, difficulty, totalQuestions: questions.length, jobDescription, useResume },
      questions,
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Personalized greeting (best-effort) + save to history (fire-and-forget)
    let greeting = '';
    try {
      greeting = await aiService.generatePersonalizedGreeting(memoryContext, { role, targetCompany, companyType });
    } catch { /* greeting is optional */ }

    memoryService.saveQuestionsToHistory(req.user._id, role, interview._id, questions).catch(() => {});

    res.status(201).json({
      success: true,
      greeting,
      interview: {
        id: interview._id,
        title: interview.title,
        config: interview.config,
        questions: interview.questions.map((q, i) => ({
          id: q._id,
          index: i,
          questionText: q.questionText,
          questionType: q.questionType,
          topic: q.topic,
          hints: q.hints || finalQuestions[i]?.hints || [],
          expectedDuration: finalQuestions[i]?.expectedDuration || 120,
        })),
        currentQuestionIndex: 0,
        status: interview.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Submit answer for a question
const submitAnswer = async (req, res, next) => {
  try {
    const { interviewId, questionIndex } = req.params;
    const { answer, transcript, voiceMetrics, skipped } = req.body;

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const question = interview.questions[parseInt(questionIndex)];
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    question.userAnswer = answer || '';
    question.transcript = transcript || answer || '';
    question.skipped = skipped || false;

    if (voiceMetrics) {
      question.voiceMetrics = {
        wordsPerMinute: voiceMetrics.wordsPerMinute || 0,
        fillerWordCount: voiceMetrics.fillerWordCount || 0,
        fillerWords: voiceMetrics.fillerWords || [],
        speakingPace: voiceMetrics.speakingPace || 'unknown',
        pauseCount: voiceMetrics.pauseCount || 0,
        totalDuration: voiceMetrics.totalDuration || 0,
      };
    }

    let aiFeedback = null;
    if (!skipped && answer && answer.trim().length >= 5) {
      aiFeedback = await aiService.evaluateAnswer(
        question.questionText,
        answer,
        interview.config
      );
      question.aiFeedback = aiFeedback;
    }

    interview.currentQuestionIndex = parseInt(questionIndex) + 1;
    await interview.save();

    res.json({
      success: true,
      feedback: aiFeedback,
      nextQuestionIndex: interview.currentQuestionIndex,
      isComplete: interview.currentQuestionIndex >= interview.questions.length,
    });
  } catch (error) {
    next(error);
  }
};

// Complete interview and calculate results
const completeInterview = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    interview.status = 'completed';
    interview.completedAt = new Date();
    interview.duration = interview.startedAt
      ? Math.round((interview.completedAt - interview.startedAt) / 1000)
      : 0;

    interview.calculateResults();

    // Get overall AI feedback
    const overallFeedback = await aiService.generateOverallFeedback(interview);
    if (typeof overallFeedback === 'object') {
      interview.results.overallFeedback = overallFeedback.overallFeedback;
      interview.results.strengths = overallFeedback.strengths || [];
      interview.results.weaknesses = overallFeedback.weaknesses || [];
      interview.results.recommendation = overallFeedback.recommendation;
    }

    await interview.save();

    // Update user stats
    const user = await User.findById(req.user._id);
    user.totalInterviews += 1;
    user.totalScore += interview.results.overallScore;
    user.averageScore = user.totalScore / user.totalInterviews;
    if (interview.results.overallScore > user.bestScore) {
      user.bestScore = interview.results.overallScore;
    }
    user.points += Math.round(interview.results.overallScore * 10);
    user.updateStreak();
    await user.save({ validateBeforeSave: false });

    // Update weak-topic averages (fire-and-forget, best-effort)
    memoryService.updateWeakTopicsFromInterview(req.user._id, interview).catch(() => {});

    res.json({ success: true, interview });
  } catch (error) {
    next(error);
  }
};

// Generate a dynamic follow-up question based on the user's previous answer.
// Frontend can call this after `submitAnswer` if it wants to ask a deeper follow-up.
const generateFollowUp = async (req, res, next) => {
  try {
    const { interviewId, questionIndex } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const q = interview.questions[parseInt(questionIndex)];
    if (!q || !q.userAnswer) return res.status(400).json({ success: false, error: 'Original answer required' });

    const followUpText = await aiService.generateFollowUpQuestion(q.questionText, q.userAnswer, interview.config);
    if (!followUpText) return res.json({ success: true, followUp: null });

    // Append the follow-up as a new question in the interview
    interview.questions.push({
      questionText: followUpText,
      questionType: q.questionType,
      topic: q.topic,
      isFollowUp: true,
      parentQuestionIndex: parseInt(questionIndex),
      aiFeedback: {},
      voiceMetrics: {},
    });
    await interview.save();

    const newIndex = interview.questions.length - 1;
    res.json({
      success: true,
      followUp: {
        id: interview.questions[newIndex]._id,
        index: newIndex,
        questionText: followUpText,
        questionType: q.questionType,
        topic: q.topic,
        isFollowUp: true,
        parentQuestionIndex: parseInt(questionIndex),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get interview by ID
const getInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });
    res.json({ success: true, interview });
  } catch (error) {
    next(error);
  }
};

// Get user's interview history
const getInterviewHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [interviews, total] = await Promise.all([
      Interview.find({ userId: req.user._id, status: 'completed' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title config results duration completedAt createdAt'),
      Interview.countDocuments({ userId: req.user._id, status: 'completed' }),
    ]);

    res.json({
      success: true,
      interviews,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    next(error);
  }
};

// Abandon interview
const abandonInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: 'in_progress' },
      { status: 'abandoned' },
      { new: true }
    );
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });
    res.json({ success: true, message: 'Interview abandoned' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createInterview, submitAnswer, completeInterview, getInterview, getInterviewHistory, abandonInterview, generateFollowUp };
