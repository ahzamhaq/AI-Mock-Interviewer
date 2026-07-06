const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId },
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['technical', 'hr', 'behavioral', 'system_design'], default: 'technical' },
  topic: { type: String, default: '' },               // topic label for weak-topic tracking
  hints: { type: [String], default: [] },             // surfaced hints if user requests
  isFollowUp: { type: Boolean, default: false },      // marks dynamically-generated follow-ups
  parentQuestionIndex: { type: Number, default: null },// links follow-ups to their parent

  // Adaptive engine metadata — why this question was selected and what it was meant to probe
  difficultyAtAsk: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  selectionReason: { type: String, default: '' }, // 'blueprint' | 'follow_up' | 'revisit_weak' | 'pivot' | 'memorized_probe'
  followUpDepth: { type: Number, default: 0 },     // 0 = primary, 1+ = chained follow-ups

  // Conversational realism layer
  intent: { type: String, default: '' },           // hidden interviewer intent (e.g. 'test tradeoffs')
  transition: { type: String, default: '' },       // short bridge phrase shown before the question
  reaction: { type: String, default: '' },         // subtle acknowledgment of the previous answer
  answerLength: { type: String, enum: ['empty', 'too_short', 'normal', 'too_long'], default: 'normal' },

  // Response quality flags from responseQuality.detect() — feed the next-question prompt
  qualityFlags: { type: [String], default: [] },
  primaryQualityFlag: { type: String, default: null },

  // Expected concepts for this question — extracted once at evaluation time and
  // cached so we can re-show them on the results page without re-asking the LLM.
  expectedConcepts: { type: [String], default: [] },

  // Silence events recorded for this question (timestamps + nudge types issued)
  silenceEvents: {
    type: [{
      at: { type: Date, default: Date.now },
      silenceMs: Number,
      nudgeType: String,
      phrase: String,
    }],
    default: [],
  },
  userAnswer: { type: String, default: '' },
  transcript: { type: String, default: '' },
  aiFeedback: {
    strengths: [String],
    weaknesses: [String],
    betterAnswer: String,
    improvements: [String],
    followUpQuestion: String,
    score: { type: Number, min: 0, max: 10, default: 0 },
    technicalScore: { type: Number, min: 0, max: 10, default: 0 },
    communicationScore: { type: Number, min: 0, max: 10, default: 0 },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    completenessScore: { type: Number, min: 0, max: 10, default: 0 },
    grammarScore: { type: Number, min: 0, max: 10, default: 0 },
    reasoningScore: { type: Number, min: 0, max: 10, default: 0 },
    practicalScore: { type: Number, min: 0, max: 10, default: 0 },

    // ── Strict rubric fields (new) ────────────────────────────────────
    // Relevance is the GATEKEEPER — low relevance hard-caps the overall score
    // regardless of fluency, length, or confidence.
    relevanceScore:           { type: Number, min: 0, max: 10, default: 0 },
    technicalAccuracyScore:   { type: Number, min: 0, max: 10, default: 0 },
    implementationDepthScore: { type: Number, min: 0, max: 10, default: 0 },
    conceptualGroundingScore: { type: Number, min: 0, max: 10, default: 0 },

    // Concept-grounding evidence — feeds the results UI and the engine's
    // weak-topic tracker. `mentionedConcepts` is a subset of expectedConcepts
    // (stored on the question) that the candidate actually touched.
    mentionedConcepts: { type: [String], default: [] },
    missingConcepts:   { type: [String], default: [] },

    // Coarse-grained category — drives follow-up strategy in the adaptive engine.
    responseCategory: {
      type: String,
      enum: [
        'excellent', 'strong', 'partially_correct', 'vague', 'off_topic',
        'memorized', 'buzzword_heavy', 'shallow', 'technically_incorrect',
        'implementation_weak', 'empty',
      ],
      default: 'partially_correct',
    },

    // The reason the score was capped (if any) — e.g. "off_topic", "no_implementation_depth"
    scoreCapReason: { type: String, default: '' },
    rawScore: { type: Number, min: 0, max: 10, default: 0 }, // pre-cap score for transparency

    summary: String,
  },
  voiceMetrics: {
    wordsPerMinute: { type: Number, default: 0 },
    fillerWordCount: { type: Number, default: 0 },
    fillerWords: [String],
    speakingPace: { type: String, enum: ['too_slow', 'ideal', 'too_fast', 'unknown'], default: 'unknown' },
    pauseCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
  },
  answeredAt: { type: Date, default: Date.now },
  skipped: { type: Boolean, default: false },
});

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: { type: String, default: 'Mock Interview' },
  status: {
    type: String,
    enum: ['setup', 'in_progress', 'completed', 'abandoned'],
    default: 'setup',
  },

  // ── Interview mode ────────────────────────────────────────────────────
  // Distinguishes the two Sprint-2 first-class flows. Defaults to 'general'
  // so every pre-existing interview keeps behaving exactly as before; the
  // analytics pipeline treats missing/legacy values as 'general'.
  mode: {
    type: String,
    enum: ['general', 'project'],
    default: 'general',
    index: true,
  },
  config: {
    role: {
      type: String,
      enum: ['frontend_developer', 'backend_developer', 'fullstack_developer', 'sde', 'data_analyst', 'hr', 'other'],
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: ['fresher', '1-2_years', '3+_years'],
      required: true,
    },
    companyType: {
      type: String,
      enum: ['faang', 'startup', 'service_based', 'product_based', 'any'],
      default: 'any',
    },
    targetCompany: { type: String, default: '' },
    interviewType: {
      type: String,
      enum: ['technical', 'hr', 'behavioral', 'system_design', 'mixed'],
      default: 'mixed',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    totalQuestions: { type: Number, default: 5, min: 1, max: 20 },
    jobDescription: { type: String, default: '' },
    useResume: { type: Boolean, default: false },

    // ── Project-mode enrichment (Sprint 2) ──────────────────────────────
    // Present only when this interview was created from a Workspace. All
    // fields are SNAPSHOTS taken at creation time: analyses can be re-run
    // later, but this interview's grounding context should stay immutable
    // so scoring and (future) replay remain reproducible.
    //
    // The engine itself is not modified — controllers pass these fields
    // into the existing question-generation context. NOTE the deliberate
    // naming: this `config.projectMode` is distinct from
    // `liveState.projectContext`, which is the adaptive engine's live
    // detection of "the candidate started describing a personal project."
    projectMode: {
      projectId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
      subMode:             { type: String, enum: ['architecture', 'debugging', 'code_review'], default: 'architecture' },
      analysisSummary:     { type: String, default: '' },
      techStack:           { type: [String], default: [] },
      importantFiles:      { type: [String], default: [] },
      architectureSummary: { type: String, default: '' },
    },
  },
  questions: { type: [answerSchema], default: [] },
  currentQuestionIndex: { type: Number, default: 0 },

  // ── Adaptive engine fields ────────────────────────────────────────────────
  // Whether this interview uses the adaptive engine (one-at-a-time question generation).
  // Older interviews created before the engine landed have adaptive=false and behave
  // identically to before (pre-generated question list).
  adaptive: { type: Boolean, default: false },

  // Interviewer "personality" — derived from company + role + experience at creation time.
  // Drives prompt tone: "friendly senior engineer" vs "rigorous FAANG interviewer" etc.
  persona: {
    style: { type: String, default: 'senior engineer' },        // free-form
    tone:  { type: String, default: 'professional' },           // friendly | rigorous | curious | professional
    rigor: { type: String, default: 'moderate' },               // light | moderate | strict
  },

  // Personality ID — points into the personality registry (services/personalities.js).
  // Set at creation. Drives reaction style, follow-up aggression, probing depth,
  // tempo, and the prompt voice guidelines.
  personalityId: { type: String, default: 'engineering_manager' },

  // Pressure level — set at creation. Multiplies the engine's base follow-up
  // probability, interruption rate, and base difficulty in the prompt.
  pressure: { type: String, enum: ['relaxed', 'standard', 'intense'], default: 'standard' },

  // Round type — drives type mix, depth bias, and the question style hint in
  // prompts. 'general' preserves existing behavior; specific rounds (technical,
  // system_design, behavioral, hiring_manager, etc.) shift focus.
  round: { type: String, default: 'general' },

  // Strategy log — visible record of why the engine made each decision.
  // Capped to last 30 entries by the engine. Useful for analytics + UI replay.
  strategyLog: {
    type: [{
      at: { type: Date, default: Date.now },
      action: String,
      topic: String,
      rationale: String,
      qualityFlags: [String],
      pacing: String,
      difficulty: String,
    }],
    default: [],
  },

  // Plan generated at interview creation. The engine consults this when picking
  // the next question — but it's a guideline, not a script. Live performance can
  // cause the engine to revisit weak areas, skip planned topics, etc.
  blueprint: {
    totalPlanned: { type: Number, default: 5 },
    mode: { type: String, enum: ['breadth', 'balanced', 'depth'], default: 'balanced' },
    plannedTopics: { type: [String], default: [] },
    typeMix: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { technical: 3, behavioral: 1, system_design: 1 }
    seedQuestionIds: { type: [String], default: [] },
  },

  // Live, mutable state updated after every answer. The engine reads this to
  // decide what to ask next: bump difficulty, pivot topics, revisit weak areas.
  liveState: {
    currentDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    coveredTopics: { type: [String], default: [] },
    weakTopicsThisSession: { type: [String], default: [] },     // topics where score < 6
    strongTopicsThisSession: { type: [String], default: [] },   // topics where score >= 8
    rollingAvgScore: { type: Number, default: 0 },              // avg of last 3 answers
    followUpDepth: { type: Number, default: 0 },                // active follow-up chain depth
    consecutiveLowScores: { type: Number, default: 0 },         // count of < 5 in a row
    consecutiveHighScores: { type: Number, default: 0 },        // count of >= 8 in a row
    memorizedFlags: { type: Number, default: 0 },               // times answer was flagged generic/memorized
    lastTopic: { type: String, default: '' },
    lastScore: { type: Number, default: 0 },
    // Topic saturation — count of questions spent on each topic.
    // The engine uses this to back off when a topic has been thoroughly explored.
    topicDepthBudget: { type: Map, of: Number, default: {} },
    // Conversational hints carried from the last evaluation to the next-question selection
    lastAnswerLength: { type: String, default: 'normal' },
    lastMemorized: { type: Boolean, default: false },

    // Derived pacing signal from pacing.compute() — re-derived each turn but
    // cached here so the UI / log can surface it.
    pacingTempo: { type: String, enum: ['slow', 'normal', 'fast'], default: 'normal' },

    // Project deep-dive context. When the engine detects the candidate is
    // describing a real project, it enters "deep-dive" mode and walks through
    // architecture → tradeoffs → scale → failures → observability axes.
    // Reset when the engine pivots away from project discussion.
    projectContext: {
      active: { type: Boolean, default: false },
      name: { type: String, default: null },
      coveredAxes: { type: [String], default: [] },
      lastAxis: { type: String, default: null },
      probeCount: { type: Number, default: 0 },
      // The index of the question that originally triggered the project mode,
      // so we can chain follow-ups back to it.
      rootQuestionIndex: { type: Number, default: null },
    },
  },

  results: {
    overallScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0 },
    grammarScore: { type: Number, default: 0 },
    totalFillerWords: { type: Number, default: 0 },
    averageWPM: { type: Number, default: 0 },
    strengths: [String],
    weaknesses: [String],
    overallFeedback: String,
    recommendation: String,
    grade: { type: String, enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'], default: 'C' },
    // Natural conversational closing line spoken at end-of-interview
    closing: { type: String, default: '' },
  },

  duration: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

interviewSchema.virtual('progress').get(function () {
  if (!this.questions.length) return 0;
  return Math.round((this.currentQuestionIndex / this.questions.length) * 100);
});

interviewSchema.methods.calculateResults = function () {
  const answered = this.questions.filter(q => !q.skipped && q.aiFeedback.score > 0);
  if (!answered.length) return;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  this.results.overallScore = Math.round(avg(answered.map(q => q.aiFeedback.score)) * 10) / 10;
  this.results.technicalScore = Math.round(avg(answered.map(q => q.aiFeedback.technicalScore)) * 10) / 10;
  this.results.communicationScore = Math.round(avg(answered.map(q => q.aiFeedback.communicationScore)) * 10) / 10;
  this.results.confidenceScore = Math.round(avg(answered.map(q => q.aiFeedback.confidenceScore)));
  this.results.completenessScore = Math.round(avg(answered.map(q => q.aiFeedback.completenessScore)) * 10) / 10;
  this.results.grammarScore = Math.round(avg(answered.map(q => q.aiFeedback.grammarScore)) * 10) / 10;
  this.results.totalFillerWords = this.questions.reduce((sum, q) => sum + q.voiceMetrics.fillerWordCount, 0);

  const wpms = this.questions.filter(q => q.voiceMetrics.wordsPerMinute > 0).map(q => q.voiceMetrics.wordsPerMinute);
  this.results.averageWPM = wpms.length ? Math.round(avg(wpms)) : 0;

  const score = this.results.overallScore;
  if (score >= 9) this.results.grade = 'A+';
  else if (score >= 8) this.results.grade = 'A';
  else if (score >= 7) this.results.grade = 'B+';
  else if (score >= 6) this.results.grade = 'B';
  else if (score >= 5) this.results.grade = 'C+';
  else if (score >= 4) this.results.grade = 'C';
  else if (score >= 3) this.results.grade = 'D';
  else this.results.grade = 'F';
};

const Interview = mongoose.model('Interview', interviewSchema);
module.exports = Interview;
