const Interview = require('../models/Interview.model');
const User = require('../models/User.model');
const aiService = require('../services/ai.service');
const memoryService = require('../services/memory.service');
const blueprintService = require('../services/blueprint.service');
const adaptiveEngine = require('../services/adaptiveEngine');
const topicGraph = require('../services/topicGraph');
const conversation = require('../services/conversationStyle');
const personalities = require('../services/personalities');
const pacing = require('../services/pacing');
const interviewEngine = require('../services/interviewEngine');
const silenceHandler = require('../services/silenceHandler');
const responseQuality = require('../services/responseQuality');
const roundProfiles = require('../services/roundProfiles');

// ── Internal helpers ──────────────────────────────────────────────────────────

// Find a fresh topic that hasn't been asked yet, biased toward the blueprint.
function pickSeedTopic(interview) {
  const planned = interview.blueprint?.plannedTopics || [];
  const covered = new Set((interview.liveState?.coveredTopics || []).map(t => t.toLowerCase()));
  return planned.find(t => !covered.has(t.toLowerCase())) || planned[0] || 'general';
}

// Project an answered question into the lightweight shape the AI service expects
// for dedup awareness.
function askedDigest(interview) {
  return interview.questions.map(q => ({ text: q.questionText, topic: q.topic }));
}

// Build the persona for prompt injection.
function persona(interview) {
  return interview.persona || interview.blueprint?.persona || { style: 'senior engineer', tone: 'professional', rigor: 'moderate' };
}

// Push a generated question onto the interview document.
function appendQuestion(interview, q, meta = {}) {
  interview.questions.push({
    questionText: q.text,
    questionType: q.type || meta.questionType || 'technical',
    topic: q.topic || meta.topic || '',
    hints: q.hints || [],
    isFollowUp: !!meta.isFollowUp,
    parentQuestionIndex: meta.parentIndex ?? null,
    difficultyAtAsk: meta.difficulty || interview.liveState?.currentDifficulty || 'medium',
    selectionReason: meta.selectionReason || meta.action || 'pivot',
    followUpDepth: meta.followUpDepth || 0,
    intent: meta.intent || '',
    transition: meta.transition || '',
    reaction: meta.reaction || '',
    aiFeedback: {},
    voiceMetrics: {},
  });
  return interview.questions.length - 1;
}

// Build the shared context object the AI service expects when generating questions.
async function buildGenContext(interview, decision, resumeText) {
  const cfg = interview.config;
  const ls = interview.liveState || {};
  const parent = decision.parentIndex != null ? interview.questions[decision.parentIndex] : null;

  // Compute pacing signal for the prompt
  const pace = pacing.compute(ls, interview.personalityId, interview.pressure);

  const roundInfo = roundProfiles.get(interview.round || 'general');

  return {
    action: decision.action,
    topic: decision.topic,
    questionType: decision.questionType,
    difficulty: decision.difficulty || ls.currentDifficulty || 'medium',
    intent: decision.intent,
    qualityIntentHint: decision.qualityIntentHint,
    persona: persona(interview),
    personality: personalities.get(interview.personalityId),
    pressure: interview.pressure,
    pacingHint: pace.promptHint,
    projectAxis: decision.projectAxis,
    round: roundInfo.id !== 'general' ? roundInfo : null,
    config: {
      role: cfg.role,
      experienceLevel: cfg.experienceLevel,
      companyType: cfg.companyType,
      targetCompany: cfg.targetCompany,
      interviewType: cfg.interviewType,
    },
    parentQuestion: parent?.questionText,
    parentAnswer: parent?.userAnswer,
    askedQuestions: askedDigest(interview),
    resumeText,
    jobDescription: cfg.jobDescription,
    graphHint: topicGraph.nearbyTopics(cfg.role, decision.topic).slice(0, 4).join(', '),
    callback: decision.callback,
    answerLength: ls.lastAnswerLength,
    consecutiveLowScores: ls.consecutiveLowScores,
  };
}

// Project a single question for the frontend response.
function serializeQuestion(q, index) {
  return {
    id: q._id,
    index,
    questionText: q.questionText,
    questionType: q.questionType,
    topic: q.topic,
    hints: q.hints || [],
    isFollowUp: !!q.isFollowUp,
    parentQuestionIndex: q.parentQuestionIndex,
    selectionReason: q.selectionReason,
    difficultyAtAsk: q.difficultyAtAsk,
    // Conversational realism layer — frontend speaks these BEFORE the question text
    transition: q.transition || '',
    reaction: q.reaction || '',
    // `intent` is intentionally NOT serialized to the frontend — it's a hidden field.
    expectedDuration: 120,
  };
}

// ── Create interview (adaptive) ───────────────────────────────────────────────

const createInterview = async (req, res, next) => {
  try {
    const {
      role, experienceLevel, companyType, targetCompany, interviewType,
      difficulty, totalQuestions, jobDescription, useResume, lengthIntent,
      // Optional explicit overrides
      personalityId,
      pressure,
      round, // 'technical' | 'behavioral' | 'system_design' | 'hiring_manager' | etc.
    } = req.body;

    const user = await User.findById(req.user._id);
    const resumeText = useResume ? user.resumeText : '';

    // Memory context — known weak topics, recent interviews
    const memory = await memoryService.getUserMemory(req.user._id, role);
    const memoryContext = memoryService.buildMemoryContext(memory);

    // Plan the interview
    const blueprint = blueprintService.build(
      { role, experienceLevel, companyType, targetCompany, interviewType, difficulty, totalQuestions, jobDescription, lengthIntent },
      memory,
      { personalityId, pressure, round }
    );

    // Create the interview document with the blueprint + initial liveState
    const interview = await Interview.create({
      userId: req.user._id,
      title: `${role.replace(/_/g, ' ')} - ${interviewType} Interview`,
      config: { role, experienceLevel, companyType, targetCompany, interviewType, difficulty, totalQuestions: blueprint.totalPlanned, jobDescription, useResume },
      adaptive: true,
      persona: blueprint.persona,
      personalityId: blueprint.personalityId,
      pressure: blueprint.pressure,
      round: blueprint.round || 'general',
      blueprint: {
        totalPlanned: blueprint.totalPlanned,
        mode: blueprint.mode,
        plannedTopics: blueprint.plannedTopics,
        typeMix: blueprint.typeMix,
      },
      liveState: {
        currentDifficulty: difficulty || 'medium',
        coveredTopics: [],
        weakTopicsThisSession: [],
        strongTopicsThisSession: [],
        rollingAvgScore: 0,
        followUpDepth: 0,
        consecutiveLowScores: 0,
        consecutiveHighScores: 0,
        memorizedFlags: 0,
        lastTopic: '',
        lastScore: 0,
        pacingTempo: 'normal',
        projectContext: { active: false, name: null, coveredAxes: [], lastAxis: null, probeCount: 0, rootQuestionIndex: null },
      },
      questions: [],
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Generate the very first question (a pivot, since nothing has been asked).
    // The first question has no reaction/transition — the greeting handles the lead-in.
    const firstDecision = {
      action: 'pivot',
      topic: pickSeedTopic(interview),
      questionType: Object.keys(blueprint.typeMix)[0] || interviewType || 'technical',
      difficulty: difficulty || 'medium',
    };
    firstDecision.intent = conversation.pickIntent(firstDecision, interview.liveState, firstDecision.questionType);
    const genContext = await buildGenContext(interview, firstDecision, resumeText);
    const firstQ = await aiService.generateAdaptiveQuestion(genContext);

    appendQuestion(interview, firstQ, {
      questionType: firstDecision.questionType,
      topic: firstDecision.topic,
      difficulty: firstDecision.difficulty,
      selectionReason: 'blueprint',
      intent: firstDecision.intent,
      transition: '',  // greeting covers the lead-in for Q1
      reaction: '',
    });

    await interview.save();

    // Personalized greeting (best-effort)
    let greeting = '';
    try {
      greeting = await aiService.generatePersonalizedGreeting(memoryContext, { role, targetCompany, companyType });
    } catch { /* greeting is optional */ }

    // Fire-and-forget memory write
    memoryService.saveQuestionsToHistory(req.user._id, role, interview._id, interview.questions).catch(() => {});

    res.status(201).json({
      success: true,
      greeting,
      interview: {
        id: interview._id,
        title: interview.title,
        config: interview.config,
        adaptive: true,
        persona: interview.persona,
        personalityId: interview.personalityId,
        personality: personalities.get(interview.personalityId), // surface label/style for UI
        pressure: interview.pressure,
        round: interview.round,
        roundInfo: roundProfiles.get(interview.round), // label/focus for UI
        blueprint: interview.blueprint,
        questions: interview.questions.map((q, i) => serializeQuestion(q, i)),
        currentQuestionIndex: 0,
        status: interview.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Submit answer ─────────────────────────────────────────────────────────────
// Evaluates the answer, updates live state, and returns feedback.
// The frontend then calls /next-question to actually get the next question
// (separating these keeps the request fast and lets the frontend show feedback
// while the next question generates in the background if it wants).

const submitAnswer = async (req, res, next) => {
  try {
    const { interviewId, questionIndex } = req.params;
    const { answer, transcript, voiceMetrics, skipped } = req.body;

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const idx = parseInt(questionIndex);
    const question = interview.questions[idx];
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
      aiFeedback = await aiService.evaluateAnswer(question.questionText, answer, interview.config);
      question.aiFeedback = aiFeedback;
    }

    // ── Response quality detection ─────────────────────────────────────
    // Fast heuristic flags (vague / buzzwordy / overconfident / contradicted /
    // rambling / etc.) — drive the engine's next-question intent bias.
    if (!skipped && answer && answer.trim().length >= 10) {
      const q = responseQuality.detect(answer);
      question.qualityFlags = q.flags;
      question.primaryQualityFlag = q.primaryFlag || null;
    }

    // Update live state (engine bookkeeping)
    if (interview.adaptive) {
      adaptiveEngine.updateLiveState(interview, idx);
    }

    interview.currentQuestionIndex = idx + 1;
    interview.markModified('questions');
    await interview.save();

    // For non-adaptive (legacy) interviews, signal completion the old way
    const isComplete = interview.adaptive
      ? false // adaptive flow uses /next-question to signal finalize
      : interview.currentQuestionIndex >= interview.questions.length;

    res.json({
      success: true,
      feedback: aiFeedback,
      adaptive: !!interview.adaptive,
      liveState: interview.adaptive ? {
        currentDifficulty: interview.liveState.currentDifficulty,
        rollingAvgScore: interview.liveState.rollingAvgScore,
        coveredTopics: interview.liveState.coveredTopics,
        weakTopicsThisSession: interview.liveState.weakTopicsThisSession,
        pacingTempo: interview.liveState.pacingTempo,
        projectActive: interview.liveState.projectContext?.active || false,
      } : null,
      nextQuestionIndex: idx + 1,
      isComplete,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get next adaptive question ────────────────────────────────────────────────
// The engine looks at the live state and decides: follow up, revisit, pivot, or finalize.

const getNextQuestion = async (req, res, next) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    if (!interview.adaptive) {
      // Legacy interviews — fall back to linear progression
      const nextIdx = interview.currentQuestionIndex;
      if (nextIdx >= interview.questions.length) {
        return res.json({ success: true, done: true, isComplete: true });
      }
      return res.json({
        success: true,
        done: false,
        question: serializeQuestion(interview.questions[nextIdx], nextIdx),
      });
    }

    // Adaptive flow — let the engine decide
    const decision = adaptiveEngine.decideNext(interview);

    if (decision.action === 'finalize') {
      return res.json({
        success: true,
        done: true,
        isComplete: true,
        rationale: decision.rationale,
      });
    }

    // ── Layer 1: pick the hidden intent (drives prompt) ────────────────────
    decision.intent = conversation.pickIntent(decision, interview.liveState, decision.questionType);

    // ── Layer 1b: quality-flag-driven intent hint ──────────────────────────
    // If the previous answer had a flag like vague / buzzwordy / overconfident,
    // pass a tailored hint to the AI prompt to bias the next question shape.
    const lastAnsweredQ = interview.questions[interview.questions.length - 1];
    if (lastAnsweredQ?.primaryQualityFlag && !decision.projectAxis) {
      const qHint = responseQuality.intentForFlag(lastAnsweredQ.primaryQualityFlag);
      if (qHint) decision.qualityIntentHint = qHint;
    }

    // ── Layer 2: pick a callback phrase from earlier answers (sometimes) ───
    // Don't use callbacks for follow-ups — the prompt already references the parent answer.
    if (decision.action !== 'follow_up' && decision.action !== 'memorized_probe') {
      decision.callback = conversation.extractCallback(interview);
    }

    // ── Record a strategy log entry — visible to UI / analytics ────────────
    if (!interview.strategyLog) interview.strategyLog = [];
    interview.strategyLog.push({
      at: new Date(),
      action: decision.action,
      topic: decision.topic,
      rationale: decision.rationale,
      qualityFlags: lastAnsweredQ?.qualityFlags || [],
      pacing: interview.liveState?.pacingTempo,
      difficulty: interview.liveState?.currentDifficulty,
    });
    if (interview.strategyLog.length > 30) {
      interview.strategyLog = interview.strategyLog.slice(-30);
    }
    interview.markModified('strategyLog');

    // Generate the actual question text
    const user = await User.findById(req.user._id);
    const resumeText = interview.config.useResume ? user.resumeText : '';
    const genContext = await buildGenContext(interview, decision, resumeText);
    const generated = await aiService.generateAdaptiveQuestion(genContext);

    // Semantic dedup — try a few times if we get something duplicate
    let questionText = generated.text;
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const dup = await memoryService.isDuplicateQuestion(req.user._id, questionText);
      if (!dup) break;
      const retry = await aiService.generateAdaptiveQuestion({
        ...genContext,
        askedQuestions: [...genContext.askedQuestions, { text: questionText, topic: decision.topic }],
      });
      questionText = retry.text;
      generated.text = retry.text;
      generated.topic = retry.topic;
      generated.hints = retry.hints;
    }

    // ── Layer 3: pick the conversational reaction + transition ─────────────
    const ls = interview.liveState || {};
    const p = personalities.get(interview.personalityId);
    const reaction = conversation.pickReaction({
      score: ls.lastScore,
      isMemorized: ls.lastMemorized,
      length: ls.lastAnswerLength,
      isFollowUp: decision.action === 'follow_up',
      reactionStyle: p.reactionStyle,
    });
    const transition = conversation.pickTransition({
      action: decision.action,
      topic: decision.topic,
      callback: decision.callback,
      score: ls.lastScore,
      consecutiveLowScores: ls.consecutiveLowScores,
      transitionStyle: p.transitionStyle,
      isProjectDeepDive: !!decision.projectAxis,
    });

    // ── Persist project context update if the engine made one ─────────────
    if (decision.projectContextUpdate) {
      interview.liveState.projectContext = {
        active: true,
        name: decision.projectContextUpdate.name || ls.projectContext?.name || null,
        coveredAxes: decision.projectContextUpdate.coveredAxes || [],
        lastAxis: decision.projectContextUpdate.lastAxis || null,
        probeCount: decision.projectContextUpdate.probeCount || 0,
        rootQuestionIndex: ls.projectContext?.rootQuestionIndex ?? null,
      };
      interview.markModified('liveState.projectContext');
    }

    const newIdx = appendQuestion(interview, generated, {
      questionType: decision.questionType,
      topic: decision.topic,
      difficulty: decision.difficulty,
      isFollowUp: decision.action === 'follow_up' || decision.action === 'memorized_probe',
      parentIndex: decision.parentIndex,
      followUpDepth: decision.followUpDepth || 0,
      selectionReason: decision.action,
      intent: decision.intent,
      transition,
      reaction,
    });

    interview.currentQuestionIndex = newIdx;
    interview.markModified('questions');
    await interview.save();

    // Save question to history for future dedup (fire-and-forget)
    memoryService.saveQuestionsToHistory(
      req.user._id, interview.config.role, interview._id,
      [interview.questions[newIdx]]
    ).catch(() => {});

    res.json({
      success: true,
      done: false,
      question: serializeQuestion(interview.questions[newIdx], newIdx),
      decision: {
        action: decision.action,
        topic: decision.topic,
        rationale: decision.rationale,
        // intent intentionally omitted — hidden from candidate
      },
      liveState: {
        currentDifficulty: interview.liveState.currentDifficulty,
        rollingAvgScore: interview.liveState.rollingAvgScore,
        coveredTopics: interview.liveState.coveredTopics,
        weakTopicsThisSession: interview.liveState.weakTopicsThisSession,
        pacingTempo: interview.liveState.pacingTempo,
        projectContext: {
          active: interview.liveState.projectContext?.active || false,
          name: interview.liveState.projectContext?.name || null,
          coveredAxes: interview.liveState.projectContext?.coveredAxes || [],
        },
      },
      primaryProgress: {
        asked: interview.questions.filter(q => !q.isFollowUp).length,
        planned: interview.blueprint?.totalPlanned || interview.config.totalQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Complete interview ────────────────────────────────────────────────────────

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

    // Overall feedback
    const overallFeedback = await aiService.generateOverallFeedback(interview);
    if (typeof overallFeedback === 'object') {
      interview.results.overallFeedback = overallFeedback.overallFeedback;
      interview.results.strengths = overallFeedback.strengths || [];
      interview.results.weaknesses = overallFeedback.weaknesses || [];
      interview.results.recommendation = overallFeedback.recommendation;
    }

    // Natural closing line — spoken/displayed on the results page so the interview
    // wraps up conversationally instead of cutting to scores immediately.
    if (interview.adaptive) {
      try {
        interview.results.closing = await aiService.generateClosingLine(interview);
      } catch { /* closing is optional */ }
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

    // Update persistent weak-topic averages
    memoryService.updateWeakTopicsFromInterview(req.user._id, interview).catch(() => {});

    res.json({ success: true, interview });
  } catch (error) {
    next(error);
  }
};

// ── Legacy: explicit follow-up endpoint ───────────────────────────────────────
// Kept for backwards compatibility with the original frontend. New adaptive flow
// uses /next-question and lets the engine decide whether to follow up.

const generateFollowUp = async (req, res, next) => {
  try {
    const { interviewId, questionIndex } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const q = interview.questions[parseInt(questionIndex)];
    if (!q || !q.userAnswer) return res.status(400).json({ success: false, error: 'Original answer required' });

    const followUpText = await aiService.generateFollowUpQuestion(q.questionText, q.userAnswer, interview.config);
    if (!followUpText) return res.json({ success: true, followUp: null });

    interview.questions.push({
      questionText: followUpText,
      questionType: q.questionType,
      topic: q.topic,
      isFollowUp: true,
      parentQuestionIndex: parseInt(questionIndex),
      selectionReason: 'follow_up_manual',
      aiFeedback: {},
      voiceMetrics: {},
    });
    await interview.save();

    const newIndex = interview.questions.length - 1;
    res.json({
      success: true,
      followUp: serializeQuestion(interview.questions[newIndex], newIndex),
    });
  } catch (error) {
    next(error);
  }
};

// ── Misc endpoints (unchanged behavior) ───────────────────────────────────────

const getInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });
    res.json({ success: true, interview });
  } catch (error) {
    next(error);
  }
};

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

// ── List available interviewer personalities ─────────────────────────────────
// Returns the static personality registry so the frontend can populate a picker
// in the setup flow. No interview state needed; safe to cache.
const listPersonalities = async (req, res) => {
  res.json({ success: true, personalities: personalities.list() });
};

// ── List available interview round profiles ──────────────────────────────────
const listRounds = async (req, res) => {
  res.json({ success: true, rounds: roundProfiles.list() });
};

// ── Silence / thinking nudge ────────────────────────────────────────────────
// Called by the frontend when the candidate has been silent past a threshold.
// Returns a context-aware nudge (silent / encourage / rephrase / narrow / hint
// / simplify) sized for the personality + pressure.
//
// Request body:
//   { silenceMs: number, prevNudges: string[] }
const handleNudge = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const { silenceMs = 0, prevNudges = [] } = req.body || {};

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const nudge = silenceHandler.decideNudge({
      silenceMs,
      liveState: interview.liveState || {},
      personalityId: interview.personalityId,
      pressure: interview.pressure,
      prevNudges,
    });

    // Persist a silence event onto the current question (best-effort)
    if (nudge.nudgeType) {
      const currentIdx = interview.currentQuestionIndex - 1;
      const q = interview.questions[currentIdx];
      if (q) {
        if (!q.silenceEvents) q.silenceEvents = [];
        q.silenceEvents.push({
          at: new Date(),
          silenceMs,
          nudgeType: nudge.nudgeType,
          phrase: nudge.phrase,
        });
        interview.markModified('questions');
        await interview.save();
      }
    }

    res.json({ success: true, nudge });
  } catch (error) {
    next(error);
  }
};

// ── Resume — produce a context recap when the candidate reconnects ───────────
// Allows graceful re-entry into an in-progress interview. The recap can be
// spoken/displayed; the frontend can then call /next-question to continue.
const resumeInterview = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    if (interview.status === 'completed') {
      return res.json({
        success: true,
        resumable: false,
        reason: 'Interview already completed.',
      });
    }
    if (interview.status === 'abandoned') {
      return res.json({
        success: true,
        resumable: false,
        reason: 'Interview was abandoned.',
      });
    }

    const recap = interviewEngine.resume(interview);

    res.json({
      success: true,
      resumable: true,
      recap: recap.recap,
      lastQuestionIndex: recap.lastQuestionIndex,
      lastQuestion: recap.lastQuestion,
      contextHint: recap.contextHint,
      interview: {
        id: interview._id,
        title: interview.title,
        config: interview.config,
        adaptive: interview.adaptive,
        round: interview.round,
        roundInfo: roundProfiles.get(interview.round || 'general'),
        personality: personalities.get(interview.personalityId),
        pressure: interview.pressure,
        status: interview.status,
        currentQuestionIndex: interview.currentQuestionIndex,
        // Send the full question list so the frontend can render history if it wants
        questions: interview.questions.map((q, i) => serializeQuestion(q, i)),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInterview, submitAnswer, getNextQuestion, completeInterview,
  getInterview, getInterviewHistory, abandonInterview, generateFollowUp,
  listPersonalities, listRounds, handleNudge, resumeInterview,
};
