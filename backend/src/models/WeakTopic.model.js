// Tracks per-user, per-role topic performance.
// Updated after each interview completion. Read by question generator
// to bias future interviews toward weak areas.

const mongoose = require('mongoose');

const weakTopicSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  topic: { type: String, required: true },
  role: { type: String, default: '' },
  avgScore: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  lastAsked: { type: Date, default: Date.now },
}, { timestamps: true });

weakTopicSchema.index({ userId: 1, topic: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('WeakTopic', weakTopicSchema);
