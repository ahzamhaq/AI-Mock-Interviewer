// Interview Engine — modality-agnostic orchestrator.
//
// This is the public surface that controllers (text today; voice/video tomorrow)
// call to drive an interview. It hides the internals — adaptive engine, AI
// service, memory, conversation style, pacing, response quality, etc. — behind
// a small, stable interface.
//
// Design contract: methods take and return PLAIN OBJECTS, not the Mongoose
// document directly. Callers (controllers) handle persistence. This makes the
// engine reusable across modalities and also testable without a database.
//
// ── Surface ────────────────────────────────────────────────────────────────
//   plan(config, memory, options)              → blueprint
//   firstQuestion(interview, resumeText)       → { question, decision }
//   evaluateAndDecide(interview, turn)         → { feedback, decision, qualityFlags, liveStateDelta }
//   composeQuestion(interview, decision, resumeText) → { question, reaction, transition }
//   handleSilence(interview, silenceMs, prevNudges) → { nudgeType, phrase, ... }
//   closeInterview(interview)                  → { closing, overallFeedback }
//   resume(interview)                          → { recap, lastQuestion, contextHint }
//
// ── Turn shape (modality-agnostic input) ─────────────────────────────────
//   {
//     questionIndex,
//     answer:    string,
//     transcript:string,        // populated for voice; same as answer for text
//     voiceMetrics: { ... } || null,
//     skipped:   boolean,
//     // future: audio: { wavBase64 }, video: { frames }, code: { snapshot }
//   }
//
// The internal adaptive engine still works directly on the Mongoose doc for
// efficiency; this facade is the *narrow waist* that other modalities will
// share.

const aiService          = require('./ai.service');
const memoryService      = require('./memory.service');
const blueprintService   = require('./blueprint.service');
const adaptiveEngine     = require('./adaptiveEngine');
const conversation       = require('./conversationStyle');
const personalities      = require('./personalities');
const pacing             = require('./pacing');
const topicGraph         = require('./topicGraph');
const silenceHandler     = require('./silenceHandler');
const responseQuality    = require('./responseQuality');
const projectDeepDive    = require('./projectDeepDive');
const roundProfiles      = require('./roundProfiles');

// ── Plan an interview (blueprint) ─────────────────────────────────────────
function plan(config, memory, options = {}) {
  return blueprintService.build(config, memory, options);
}

// ── Compose the first question (called once after creation) ──────────────
async function firstQuestion(interview, resumeText) {
  const blueprint = interview.blueprint;
  const decision = {
    action: 'pivot',
    topic: pickSeedTopic(interview),
    questionType: Object.keys(blueprint.typeMix || {})[0] || interview.config.interviewType || 'technical',
    difficulty: interview.config.difficulty || 'medium',
  };
  decision.intent = conversation.pickIntent(decision, interview.liveState, decision.questionType);

  const generated = await aiService.generateAdaptiveQuestion(
    buildGenContext(interview, decision, resumeText)
  );
  return { question: generated, decision };
}

// ── Evaluate the just-given answer and pick the next action ──────────────
// `turn` is the modality-agnostic turn object.
async function evaluateAndDecide(interview, turn) {
  const idx = turn.questionIndex;
  const question = interview.questions[idx];
  if (!question) throw new Error('Question not found at index ' + idx);

  // Persist the answer onto the question
  question.userAnswer = turn.answer || '';
  question.transcript = turn.transcript || turn.answer || '';
  question.skipped = !!turn.skipped;
  if (turn.voiceMetrics) {
    question.voiceMetrics = turn.voiceMetrics;
  }

  // Evaluate (nuanced multi-dim scoring)
  let feedback = null;
  if (!turn.skipped && turn.answer && turn.answer.trim().length >= 5) {
    feedback = await aiService.evaluateAnswer(question.questionText, turn.answer, interview.config);
    question.aiFeedback = feedback;
  }

  // Response quality flags — store on the question
  let qualityFlags = [];
  if (turn.answer && turn.answer.trim().length >= 10) {
    const q = responseQuality.detect(turn.answer);
    qualityFlags = q.flags;
    question.qualityFlags = qualityFlags;
    question.primaryQualityFlag = q.primaryFlag;
  }

  // Update live state (covered topics, weak/strong, streaks, pacing, project ctx)
  adaptiveEngine.updateLiveState(interview, idx);

  // Decide next action (engine consults blueprint, live state, pacing, project ctx)
  const decision = adaptiveEngine.decideNext(interview);

  // Record a strategy log entry — visible to UI / debugging
  recordStrategy(interview, decision, qualityFlags);

  // If we already decided to finalize, return early — no question generation
  if (decision.action === 'finalize') {
    return { feedback, decision, qualityFlags, isComplete: true };
  }

  // Enrich the decision with conversational metadata (intent, callback)
  decision.intent = decision.intent || conversation.pickIntent(decision, interview.liveState, decision.questionType);

  // Quality-flag-aware intent override — gentle bias (only if engine didn't
  // already pick a specific intent for the action)
  if (question.primaryQualityFlag && decision.action !== 'pivot' && !decision.projectAxis) {
    const qIntent = responseQuality.intentForFlag(question.primaryQualityFlag);
    if (qIntent) decision.qualityIntentHint = qIntent;
  }

  if (decision.action !== 'follow_up' && decision.action !== 'memorized_probe') {
    decision.callback = conversation.extractCallback(interview);
  }

  return { feedback, decision, qualityFlags, isComplete: false };
}

// ── Generate the next question text + conversational layering ────────────
async function composeQuestion(interview, decision, resumeText) {
  const ctx = buildGenContext(interview, decision, resumeText);

  // Generate text
  let generated = await aiService.generateAdaptiveQuestion(ctx);

  // Semantic dedup retries
  for (let i = 0; i < 2; i++) {
    const dup = await memoryService.isDuplicateQuestion(interview.userId, generated.text);
    if (!dup) break;
    generated = await aiService.generateAdaptiveQuestion({
      ...ctx,
      askedQuestions: [...ctx.askedQuestions, { text: generated.text, topic: decision.topic }],
    });
  }

  // Layer reaction + transition based on personality
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

  return { question: generated, reaction, transition };
}

// ── Handle silence / thinking ────────────────────────────────────────────
function handleSilence(interview, silenceMs, prevNudges = []) {
  return silenceHandler.decideNudge({
    silenceMs,
    liveState: interview.liveState || {},
    personalityId: interview.personalityId,
    pressure: interview.pressure,
    prevNudges,
  });
}

// ── Close the interview (results + closing line) ─────────────────────────
async function closeInterview(interview) {
  const overall = await aiService.generateOverallFeedback(interview);
  let closing = '';
  if (interview.adaptive) {
    try { closing = await aiService.generateClosingLine(interview); } catch {}
  }
  return { overall, closing };
}

// ── Resume — produce a context recap when the candidate reconnects ───────
function resume(interview) {
  const answered = (interview.questions || []).filter(q => !q.skipped && q.aiFeedback?.score > 0);
  const lastAnswered = answered[answered.length - 1];
  const currentQ = interview.questions[interview.currentQuestionIndex - 1] || lastAnswered;
  const topics = (interview.liveState?.coveredTopics || []).slice(-3).join(', ');

  let recap;
  if (lastAnswered) {
    const last = (lastAnswered.userAnswer || '').slice(0, 120);
    recap = `Welcome back. We were discussing ${lastAnswered.topic || 'the previous topic'}${topics ? ` — earlier we covered ${topics}` : ''}. You were saying: "${last}${last.length === 120 ? '…' : ''}"`;
  } else if (currentQ) {
    recap = `Welcome back. We were on this question: "${currentQ.questionText}". Take your time.`;
  } else {
    recap = `Welcome back. Let's pick up where we left off.`;
  }

  return {
    recap,
    lastQuestionIndex: interview.currentQuestionIndex - 1,
    lastQuestion: currentQ ? {
      text: currentQ.questionText,
      topic: currentQ.topic,
      type: currentQ.questionType,
    } : null,
    contextHint: topics,
  };
}

// ── Internals ────────────────────────────────────────────────────────────

function pickSeedTopic(interview) {
  const planned = interview.blueprint?.plannedTopics || [];
  return planned[0] || 'general';
}

function buildGenContext(interview, decision, resumeText) {
  const cfg = interview.config;
  const ls = interview.liveState || {};
  const parent = decision.parentIndex != null ? interview.questions[decision.parentIndex] : null;
  const pace = pacing.compute(ls, interview.personalityId, interview.pressure);
  const round = roundProfiles.get(interview.round || 'general');

  return {
    action: decision.action,
    topic: decision.topic,
    questionType: decision.questionType,
    difficulty: decision.difficulty || ls.currentDifficulty || 'medium',
    intent: decision.intent,
    qualityIntentHint: decision.qualityIntentHint,
    persona: { style: interview.persona?.style, tone: interview.persona?.tone, rigor: interview.persona?.rigor },
    personality: personalities.get(interview.personalityId),
    pressure: interview.pressure,
    pacingHint: pace.promptHint,
    projectAxis: decision.projectAxis,
    round: round.id !== 'general' ? round : null,
    config: {
      role: cfg.role,
      experienceLevel: cfg.experienceLevel,
      companyType: cfg.companyType,
      targetCompany: cfg.targetCompany,
      interviewType: cfg.interviewType,
    },
    parentQuestion: parent?.questionText,
    parentAnswer: parent?.userAnswer,
    askedQuestions: interview.questions.map(q => ({ text: q.questionText, topic: q.topic })),
    resumeText,
    jobDescription: cfg.jobDescription,
    graphHint: topicGraph.nearbyTopics(cfg.role, decision.topic).slice(0, 4).join(', '),
    callback: decision.callback,
    answerLength: ls.lastAnswerLength,
    consecutiveLowScores: ls.consecutiveLowScores,
  };
}

// Append a small strategy note to the interview document. Kept short — these
// accumulate over the interview and feed both the analytics view and any
// future "show the candidate why I asked this" UI.
function recordStrategy(interview, decision, qualityFlags) {
  if (!interview.strategyLog) interview.strategyLog = [];
  const note = {
    at: new Date(),
    action: decision.action,
    topic: decision.topic,
    rationale: decision.rationale,
    qualityFlags: qualityFlags || [],
    pacing: interview.liveState?.pacingTempo,
    difficulty: interview.liveState?.currentDifficulty,
  };
  interview.strategyLog.push(note);
  // Cap the log to last 30 entries to avoid bloat
  if (interview.strategyLog.length > 30) {
    interview.strategyLog = interview.strategyLog.slice(-30);
  }
  if (interview.markModified) interview.markModified('strategyLog');
}

module.exports = {
  plan,
  firstQuestion,
  evaluateAndDecide,
  composeQuestion,
  handleSilence,
  closeInterview,
  resume,
  // exposed for testing / direct controller usage if needed
  _internals: { buildGenContext, recordStrategy },
};
