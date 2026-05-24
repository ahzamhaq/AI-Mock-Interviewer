const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId },
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['technical', 'hr', 'behavioral', 'system_design'], default: 'technical' },
  topic: { type: String, default: '' },               // NEW: topic label for weak-topic tracking
  hints: { type: [String], default: [] },             // NEW: surfaced hints if user requests
  isFollowUp: { type: Boolean, default: false },      // NEW: marks dynamically-generated follow-ups
  parentQuestionIndex: { type: Number, default: null },// NEW: links follow-ups to their parent
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
  },
  questions: { type: [answerSchema], default: [] },
  currentQuestionIndex: { type: Number, default: 0 },

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
