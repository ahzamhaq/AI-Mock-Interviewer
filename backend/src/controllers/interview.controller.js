const Interview = require('../models/Interview.model');
const User = require('../models/User.model');
const achievements = require('../services/achievements/evaluate');
const interviewBlueprint = require('../services/interviewBlueprint');
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
const { getStrategy } = require('../services/interviewStrategies');
const judge0 = require('../services/judge0.service');
const { isSupported: isJudge0LangSupported } = require('../constants/judge0Languages');
const codeEvaluation = require('../services/codeEvaluation.service');

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
  // Sprint 7 Commit 4 — attach hidden test cases from the mode strategy.
  // DSA seeds a small static mock suite; other modes get an empty array.
  // Primary questions get tests; follow-ups reuse the parent's suite so
  // /submit keeps producing consistent results within a thread.
  const strategy = getStrategy(interview.mode);
  let hiddenTests = [];
  if (!meta.isFollowUp && typeof strategy.seedHiddenTests === 'function') {
    try {
      const seeded = strategy.seedHiddenTests(interview, q);
      if (Array.isArray(seeded)) hiddenTests = seeded;
    } catch { /* fall through with empty tests */ }
  } else if (meta.isFollowUp && meta.parentIndex != null) {
    const parent = interview.questions[meta.parentIndex];
    if (parent && Array.isArray(parent.hiddenTests)) hiddenTests = parent.hiddenTests;
  }

  interview.questions.push({
    questionText: q.text,
    questionType: q.type || meta.questionType || 'technical',
    topic: q.topic || meta.topic || '',
    hints: q.hints || [],
    hiddenTests,
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
    missingConcepts: decision.missingConcepts,
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

    // Project-mode context (Sprint 2). Present only when the interview was
    // created from a Workspace. The AI service consumes this to ground
    // question generation in the candidate's real code. When absent, the
    // engine behaves exactly as before.
    projectMode: cfg.projectMode?.projectId ? {
      subMode:             cfg.projectMode.subMode,
      analysisSummary:     cfg.projectMode.analysisSummary,
      techStack:           cfg.projectMode.techStack || [],
      importantFiles:      cfg.projectMode.importantFiles || [],
      architectureSummary: cfg.projectMode.architectureSummary,
    } : null,
  };
}

// Sprint 7 Commit 2 — strategy layer for mode-specific gen context.
// Wraps buildGenContext() so DSA (and future strategies) can inject
// mode-aware fields + a prompt block without duplicating the base
// context assembly. Non-strategy modes fall through unchanged.
async function buildStrategyAwareGenContext(interview, decision, resumeText) {
  const base = await buildGenContext(interview, decision, resumeText);
  const strategy = getStrategy(interview.mode);
  const augment = strategy.augmentGenContext(interview, decision) || {};
  const merged = { ...base, ...augment };
  const promptInsert = strategy.buildPromptInsert(merged);
  if (promptInsert) merged.strategyPromptInsert = promptInsert;
  return merged;
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
    // Sprint 5 Commit 1: the InterviewBlueprint is the ONE object that
    // represents "an interview to create." Every downstream service
    // (Interview.create, blueprintService.build, buildGenContext,
    // memoryService, aiService.generatePersonalizedGreeting) reads from
    // this blueprint rather than from ad-hoc plucked fields.
    //
    // The frontend request body is unchanged. fromRequest() reads it and
    // produces the canonical shape; .resolve() loads project/resume
    // context from the DB; .validate() catches user-fixable mistakes.
    let bp = interviewBlueprint.fromRequest(req);

    const user = await User.findById(req.user._id);

    try {
      bp = await interviewBlueprint.resolve(bp, user);
      interviewBlueprint.validate(bp);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const resumeText = interviewBlueprint.toResumeText(bp);

    // Memory context — known weak topics, recent interviews
    const memory = await memoryService.getUserMemory(req.user._id, bp.role);
    const memoryContext = memoryService.buildMemoryContext(memory);

    // Plan the interview via the existing planner. Blueprint provides the
    // shapes the planner already expects — no planner change.
    const plan = blueprintService.build(
      interviewBlueprint.toPlannerConfig(bp),
      memory,
      interviewBlueprint.toPlannerOptions(bp),
    );

    // Create the interview document. `config` matches the pre-Sprint-5
    // schema exactly (blueprint.toInterviewConfig maps to it 1:1).
    const configForDoc = interviewBlueprint.toInterviewConfig(bp);
    configForDoc.totalQuestions = plan.totalPlanned;

    const interview = await Interview.create({
      userId: req.user._id,
      title:  interviewBlueprint.toTitle(bp),
      mode:   bp.mode,
      retryOf: bp.retryOf || undefined,
      // Sprint 5 Commit 6 — origin metadata. Every interview permanently
      // remembers how it was created so History, Results, Coach, and
      // Analytics can answer "where did this come from?" without needing
      // to reconstruct provenance.
      creationSource: bp.creationSource || 'guided',
      sourceMetadata: bp.sourceMetadata || {},
      config: configForDoc,
      adaptive: true,
      persona: plan.persona,
      personalityId: plan.personalityId,
      pressure: plan.pressure,
      round: plan.round || 'general',
      blueprint: {
        totalPlanned: plan.totalPlanned,
        mode: plan.mode,
        plannedTopics: plan.plannedTopics,
        typeMix: plan.typeMix,
      },
      liveState: {
        currentDifficulty: bp.difficulty,
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
    let firstDecision = {
      action: 'pivot',
      topic: pickSeedTopic(interview),
      questionType: Object.keys(plan.typeMix)[0] || bp.interviewType || 'technical',
      difficulty: bp.difficulty,
    };
    // Sprint 7 Commit 2 — DSA strategy overrides the seed to target
    // config.dsa.topic / focusAreas at the correct starting difficulty.
    firstDecision = getStrategy(interview.mode).seedDecision(interview, firstDecision);
    firstDecision.intent = conversation.pickIntent(firstDecision, interview.liveState, firstDecision.questionType);
    const genContext = await buildStrategyAwareGenContext(interview, firstDecision, resumeText);
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
      greeting = await aiService.generatePersonalizedGreeting(memoryContext, {
        role: bp.role,
        targetCompany: bp.targetCompany,
        companyType: bp.company,
      });
    } catch { /* greeting is optional */ }

    // Fire-and-forget memory write
    memoryService.saveQuestionsToHistory(req.user._id, bp.role, interview._id, interview.questions).catch(() => {});

    // Sprint 5 Commit 5: capture this interview's config on the user's
    // Recent Configurations ring buffer (max 5, newest first). Non-
    // blocking — a write failure must never break interview creation.
    // Retry payloads (identifiable by req._internalRetryOf) are skipped
    // so they don't crowd out user-driven configs.
    if (!req._internalRetryOf) {
      const recentPayload = {
        role: bp.role,
        experienceLevel: bp.experience,
        companyType: bp.company,
        targetCompany: bp.targetCompany,
        interviewType: bp.interviewType,
        difficulty: bp.difficulty,
        totalQuestions: bp.questionCount,
        jobDescription: bp.jobDescription,
        useResume: bp.useResume,
        lengthIntent: bp.lengthIntent,
        pressure: bp.pressure,
        personalityId: bp.personality,
        round: bp.round || 'general',
      };
      const recentLabel = bp.mode === 'project'
        ? interview.title
        : `${(bp.role || '').replace(/_/g, ' ')} · ${bp.interviewType}`;
      User.updateOne(
        { _id: req.user._id },
        {
          $push: {
            recentConfigs: {
              $each: [{ payload: recentPayload, label: recentLabel, createdAt: new Date() }],
              $position: 0,
              $slice: 5,
            },
          },
        },
      ).catch(() => { /* best-effort */ });
    }

    res.status(201).json({
      success: true,
      greeting,
      interview: {
        id: interview._id,
        title: interview.title,
        mode: interview.mode,
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
      // ── Question understanding phase ──────────────────────────────────
      // Lazy-extract the expected concepts the first time we evaluate this
      // question, then cache them on the question itself. Subsequent
      // evaluations (rare, only if the user re-submits) reuse the cache.
      if (!question.expectedConcepts || question.expectedConcepts.length === 0) {
        try {
          const concepts = await aiService.extractExpectedConcepts(
            question.questionText,
            interview.config
          );
          if (concepts && concepts.length) {
            question.expectedConcepts = concepts;
            interview.markModified('questions');
          }
        } catch { /* concepts are optional — fall through to less-strict eval */ }
      }

      aiFeedback = await aiService.evaluateAnswer(
        question.questionText,
        answer,
        interview.config,
        { expectedConcepts: question.expectedConcepts || [] }
      );
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

    // ── Layer 1b: response-category-driven intent hint ─────────────────────
    // The strict evaluator's `responseCategory` is the strongest signal —
    // use it first; fall back to the regex `primaryQualityFlag` if absent.
    const lastAnsweredQ = interview.questions[interview.questions.length - 1];
    if (lastAnsweredQ && !decision.projectAxis) {
      const cat = lastAnsweredQ.aiFeedback?.responseCategory;
      const CATEGORY_TO_HINT = {
        vague:                 'implementation_detail',
        shallow:               'implementation_detail',
        buzzword_heavy:        'concrete_example',
        memorized:             'real_example',
        implementation_weak:   'production_example',
        partially_correct:    'fill_missing_concept',
        technically_incorrect:'reconcile_or_correct',
        off_topic:             'redirect_to_question',
      };
      if (cat && CATEGORY_TO_HINT[cat]) {
        decision.qualityIntentHint = CATEGORY_TO_HINT[cat];
      } else if (lastAnsweredQ.primaryQualityFlag) {
        const qHint = responseQuality.intentForFlag(lastAnsweredQ.primaryQualityFlag);
        if (qHint) decision.qualityIntentHint = qHint;
      }

      // Also surface missing concepts so the follow-up prompt can probe them directly.
      const missing = lastAnsweredQ.aiFeedback?.missingConcepts;
      if (Array.isArray(missing) && missing.length) {
        decision.missingConcepts = missing.slice(0, 3);
      }
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
    // Sprint 7 Commit 2 — strategy-aware context so DSA questions get
    // the DSA prompt block + difficulty escalation for 'mixed' mode.
    const genContext = await buildStrategyAwareGenContext(interview, decision, resumeText);
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

    // ── Code Evaluation (Sprint 7 Commit 5) ─────────────────────────
    // Only run for DSA interviews — other modes' evaluation flows are
    // covered by the existing overall-feedback path above. The engine
    // NEVER throws; on failure it returns { status: 'failed', … } and
    // we persist the marker so the frontend can offer a Retry button.
    // Interview completion must succeed even if the LLM is unavailable.
    if (interview.mode === 'dsa') {
      const sourceCode = typeof req.body?.sourceCode === 'string' ? req.body.sourceCode : '';
      try {
        const result = await codeEvaluation.evaluate(interview, { sourceCode });
        interview.evaluation = result;
        interview.markModified('evaluation');
      } catch (evalErr) {
        // codeEvaluation.evaluate should not throw, but belt-and-braces:
        // any unexpected exception still lets completion proceed.
        console.error('[completeInterview] evaluation crashed:', evalErr?.message || evalErr);
        interview.evaluation = codeEvaluation.pending();
        interview.evaluation.status = 'failed';
        interview.evaluation.error  = 'Evaluation failed unexpectedly.';
        interview.markModified('evaluation');
      }
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

    // ── Achievement evaluation (Sprint 4) ────────────────────────────
    // Runs synchronously so the response payload can include unlocks.
    // The retry_redemption predicate needs the parent interview's score;
    // we load it opportunistically when this interview has a retryOf link.
    let parentInterview = null;
    if (interview.retryOf?.interviewId) {
      parentInterview = await Interview.findById(interview.retryOf.interviewId)
        .select('results')
        .lean()
        .catch(() => null);
    }
    const unlockedIds = achievements.evaluate(user, {
      kind: 'interview_completed',
      payload: { interview, parentInterview },
    });
    const applied = achievements.applyUnlocks(user, unlockedIds);
    if (applied.length) {
      await user.save({ validateBeforeSave: false });
    }
    const unlockedBadges = achievements.describeUnlocks(applied);

    // Update persistent weak-topic averages
    memoryService.updateWeakTopicsFromInterview(req.user._id, interview).catch(() => {});

    res.json({ success: true, interview, unlockedBadges });
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
        .select('title mode creationSource sourceMetadata config results duration completedAt createdAt'),
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

// ── Retry a question (Sprint 3) ───────────────────────────────────────────────
//
// POST /api/interviews/:id/retry-question  { questionIndex }
//
// Creates a NEW short interview (3 questions) that mirrors the parent's
// role/experience/company/persona but seeds the blueprint on the target
// question's topic. Past scores are preserved — retries produce a new
// interview so analytics, weak-topic tracking, and streak logic stay
// consistent. The `retryOf` pointer lets the ResultsPage show "Retried
// from …" and lets future analytics correlate parent ↔ retry outcomes.
//
// Implementation: build a fresh payload matching the shape createInterview
// accepts, mutate req.body + req._internalRetryOf, and delegate to
// createInterview so we reuse the full engine wiring (blueprint, first
// question, greeting, memory writes) instead of duplicating 150 lines.
const retryQuestion = async (req, res, next) => {
  try {
    const parentId = req.params.id;
    const { questionIndex } = req.body || {};
    const idx = Number(questionIndex);

    if (!parentId || Number.isNaN(idx) || idx < 0) {
      return res.status(400).json({ success: false, error: 'questionIndex is required' });
    }

    const parent = await Interview.findOne({ _id: parentId, userId: req.user._id });
    if (!parent) return res.status(404).json({ success: false, error: 'Interview not found' });

    const q = parent.questions?.[idx];
    if (!q) return res.status(400).json({ success: false, error: 'Question not found on that interview' });

    // Retry difficulty: scale down when the parent question was scored low
    // so users get a fair second attempt, not the same wall.
    const parentScore = q.aiFeedback?.score ?? 0;
    const parentDifficulty = q.difficultyAtAsk || parent.config.difficulty || 'medium';
    const difficulty = parentScore > 0 && parentScore < 5
      ? 'easy'
      : parentDifficulty;

    // Build the createInterview payload from the parent's context.
    const payload = {
      role: parent.config.role,
      experienceLevel: parent.config.experienceLevel,
      companyType: parent.config.companyType || 'any',
      targetCompany: parent.config.targetCompany || '',
      interviewType: q.questionType || parent.config.interviewType || 'technical',
      difficulty,
      totalQuestions: 3,
      jobDescription: parent.config.jobDescription || '',
      useResume: false,
      lengthIntent: 'depth',
      personalityId: parent.personalityId || '',
      pressure: parent.pressure || 'standard',
      round: parent.round || 'general',
    };

    // Overwrite req.body so the shared handler sees our payload, and stash
    // the retry pointer on `req` where createInterview will read it.
    req.body = payload;
    req._internalRetryOf = {
      interviewId: parent._id,
      questionIndex: idx,
      topic: q.topic || '',
    };

    return createInterview(req, res, next);
  } catch (err) {
    next(err);
  }
};

// ── DSA hint — progressive nudges for the current DSA question ─────────────
// Sprint 7 Commit 2. POST /interviews/:interviewId/hint
//
// Reads the current question, asks the DSA strategy to build a prompt for
// hint #(N+1), calls the LLM, appends the returned hint to
// question.hints, saves, and returns { hint, hintsGiven }.
//
// Guardrails:
//   • Only supported when the mode's strategy exposes buildHintPrompt
//     (today: DSA only).
//   • Blocked when config.dsa.allowHints === false.
//   • Capped at 3 hints per question so a candidate can't strip the
//     entire problem via repeated clicks.
//
// The hint is NOT scored against the answer — it's a coaching aid. Any
// follow-up scoring (if we add "penalize hint usage" later) reads
// question.hints.length.

const MAX_HINTS_PER_QUESTION = 3;

const requestHint = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found' });

    const strategy = getStrategy(interview.mode);
    if (!strategy.hintAvailable || !strategy.hintAvailable(interview) || typeof strategy.buildHintPrompt !== 'function') {
      return res.status(400).json({
        success: false,
        error: 'Hints are not enabled for this interview.',
      });
    }

    const idx = interview.currentQuestionIndex;
    const question = interview.questions[idx] || interview.questions[interview.questions.length - 1];
    if (!question) {
      return res.status(400).json({ success: false, error: 'No active question to hint.' });
    }

    const existing = Array.isArray(question.hints) ? question.hints : [];
    if (existing.length >= MAX_HINTS_PER_QUESTION) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_HINTS_PER_QUESTION} hints per question.`,
      });
    }

    const prompt = strategy.buildHintPrompt(interview, question, existing.length);
    let hintText = '';
    try {
      const raw = await aiService.generateText(prompt, { temperature: 0.6, maxTokens: 120 });
      hintText = (raw || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: 'The hint service is temporarily unavailable. Please try again.',
      });
    }

    if (!hintText) {
      return res.status(502).json({ success: false, error: 'Could not generate a hint.' });
    }

    question.hints = [...existing, hintText];
    interview.markModified('questions');
    await interview.save();

    return res.json({
      success: true,
      hint: hintText,
      hintsGiven: question.hints.length,
      maxHints: MAX_HINTS_PER_QUESTION,
    });
  } catch (err) {
    next(err);
  }
};

// ── Code execution (Sprint 7 Commit 4) ─────────────────────────────────────
// POST /interviews/:interviewId/run
// POST /interviews/:interviewId/submit
//
// Both routes accept { language, sourceCode, sampleTests?[] } and
// return a normalized execution result the frontend can render into
// the OutputPanel without further reshaping. `run` executes against
// the sample tests supplied in the request body; `submit` executes
// against the current question's stored hidden tests. Neither route
// performs AI code review or scoring — those belong to Commit 5.
//
// Cooldown enforcement is per-user, per-interview, per-endpoint, held
// in an in-process Map. This is intentionally lightweight — a single
// process across a small user base is the current deployment. If we
// scale horizontally later we'd move this to Redis; the API contract
// stays the same.

const RUN_COOLDOWN_MS    = 2_000;
const SUBMIT_COOLDOWN_MS = 5_000;
const cooldowns = new Map();

function cooldownKey(userId, interviewId, kind) {
  return `${userId}:${interviewId}:${kind}`;
}
function checkCooldown(userId, interviewId, kind, ms) {
  const key = cooldownKey(userId, interviewId, kind);
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  const remaining = last + ms - now;
  if (remaining > 0) return remaining;
  cooldowns.set(key, now);
  return 0;
}

async function loadInterviewForExecution(req) {
  const { interviewId } = req.params;
  return Interview.findOne({ _id: interviewId, userId: req.user._id });
}

function persistLastExecution(interview, patch) {
  interview.lastExecution = {
    kind:           patch.kind || '',
    language:       patch.language || '',
    status:         patch.status || '',
    stdout:         patch.stdout || '',
    stderr:         patch.stderr || '',
    compileOutput:  patch.compileOutput || '',
    executionTime:  patch.executionTime ?? null,
    memory:         patch.memory ?? null,
    exitCode:       patch.exitCode ?? null,
    passed:         patch.passed ?? null,
    total:          patch.total ?? null,
    executedAt:     new Date(),
  };
  interview.markModified('lastExecution');
}

const runCode = async (req, res, next) => {
  try {
    const { language, sourceCode, stdin } = req.body || {};

    if (!isJudge0LangSupported(language)) {
      return res.status(400).json({ success: false, error: `Language "${language}" is not supported for execution.` });
    }
    if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
      return res.status(400).json({ success: false, error: 'Please write some code before running.' });
    }

    const interview = await loadInterviewForExecution(req);
    if (!interview) {
      return res.status(404).json({ success: false, error: 'Interview not found.' });
    }

    const wait = checkCooldown(String(req.user._id), String(interview._id), 'run', RUN_COOLDOWN_MS);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${Math.ceil(wait / 1000)}s before running again.`,
        retryAfterMs: wait,
      });
    }

    console.log(`[judge0] run started interview=${interview._id} lang=${language}`);
    const result = await judge0.executeOnce({
      language,
      sourceCode,
      stdin: typeof stdin === 'string' ? stdin : '',
    });
    console.log(`[judge0] run finished interview=${interview._id} status=${result.status} time=${result.executionTime}s`);

    persistLastExecution(interview, {
      kind: 'run',
      language,
      status:         result.status,
      stdout:         result.stdout,
      stderr:         result.stderr,
      compileOutput:  result.compileOutput,
      executionTime:  result.executionTime,
      memory:         result.memory,
      exitCode:       result.exitCode,
    });
    await interview.save();

    return res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
};

const submitCode = async (req, res, next) => {
  try {
    const { language, sourceCode } = req.body || {};

    if (!isJudge0LangSupported(language)) {
      return res.status(400).json({ success: false, error: `Language "${language}" is not supported for execution.` });
    }
    if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
      return res.status(400).json({ success: false, error: 'Please write some code before submitting.' });
    }

    const interview = await loadInterviewForExecution(req);
    if (!interview) {
      return res.status(404).json({ success: false, error: 'Interview not found.' });
    }

    const wait = checkCooldown(String(req.user._id), String(interview._id), 'submit', SUBMIT_COOLDOWN_MS);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${Math.ceil(wait / 1000)}s before submitting again.`,
        retryAfterMs: wait,
      });
    }

    // Pull hidden tests off the CURRENT question. Follow-ups inherit
    // the parent's suite (assigned in appendQuestion).
    const idx = interview.currentQuestionIndex;
    const q = interview.questions[idx] || interview.questions[interview.questions.length - 1];
    const hiddenTests = (q && Array.isArray(q.hiddenTests)) ? q.hiddenTests : [];

    if (hiddenTests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'This question has no hidden tests attached.',
      });
    }

    console.log(`[judge0] submit started interview=${interview._id} lang=${language} tests=${hiddenTests.length}`);
    const suite = await judge0.executeSuite({
      language,
      sourceCode,
      tests: hiddenTests,
    });
    console.log(`[judge0] submit finished interview=${interview._id} passed=${suite.summary.passed}/${suite.summary.total} status=${suite.summary.status}`);

    // The "primary" result surfaced on the top-line status is the
    // aggregate; the per-test breakdown flows back untouched so the
    // frontend can render the pass/fail table.
    persistLastExecution(interview, {
      kind: 'submit',
      language,
      status:         suite.summary.status,
      stdout:         '',
      stderr:         '',
      compileOutput:  suite.results.find((r) => r.compileOutput)?.compileOutput || '',
      executionTime:  suite.results.reduce((sum, r) => sum + (r.executionTime || 0), 0) || null,
      memory:         Math.max(0, ...suite.results.map((r) => r.memory || 0)) || null,
      exitCode:       null,
      passed:         suite.summary.passed,
      total:          suite.summary.total,
    });
    await interview.save();

    return res.json({ success: true, summary: suite.summary, results: suite.results });
  } catch (err) {
    next(err);
  }
};

// ── Retry evaluation (Sprint 7 Commit 5) ───────────────────────────────────
// POST /interviews/:interviewId/evaluate
//
// Re-runs the Code Evaluation Engine for a DSA interview whose earlier
// evaluation failed (or was skipped). Reuses the code + execution
// already stored on the interview; the caller may optionally supply
// the latest source buffer via req.body.sourceCode. Judge0 is NEVER
// re-invoked — this is a pure LLM call.
const RETRY_EVAL_COOLDOWN_MS = 10_000;

const retryEvaluation = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
    if (!interview) return res.status(404).json({ success: false, error: 'Interview not found.' });
    if (interview.mode !== 'dsa') {
      return res.status(400).json({ success: false, error: 'Evaluation is only available for DSA interviews.' });
    }

    const wait = checkCooldown(String(req.user._id), String(interview._id), 'evaluate', RETRY_EVAL_COOLDOWN_MS);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${Math.ceil(wait / 1000)}s before retrying.`,
        retryAfterMs: wait,
      });
    }

    const sourceCode = typeof req.body?.sourceCode === 'string' ? req.body.sourceCode : '';
    const result = await codeEvaluation.evaluate(interview, { sourceCode });
    interview.evaluation = result;
    interview.markModified('evaluation');
    await interview.save();

    return res.json({ success: true, evaluation: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createInterview, submitAnswer, getNextQuestion, completeInterview,
  getInterview, getInterviewHistory, abandonInterview, generateFollowUp,
  listPersonalities, listRounds, handleNudge, resumeInterview,
  retryQuestion, requestHint,
  runCode, submitCode, retryEvaluation,
};
