// Persistent record of every interview question asked to a user.
// Used by the anti-repetition engine for semantic similarity checks.

const mongoose = require('mongoose');

const questionHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
  text: { type: String, required: true },
  topic: { type: String, default: '' },
  type: { type: String, default: '' },
  role: { type: String, default: '' },
  // Lightweight hash-based embedding (no external API). Stored as plain array.
  embedding: { type: [Number], default: [] },
  askedAt: { type: Date, default: Date.now },
});

questionHistorySchema.index({ userId: 1, askedAt: -1 });

module.exports = mongoose.model('QuestionHistory', questionHistorySchema);
