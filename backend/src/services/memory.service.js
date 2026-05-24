// Adaptive memory + anti-repetition + weak-topic tracking.
// Used by the interview controller around question generation and completion.

const Interview = require('../models/Interview.model');
const QuestionHistory = require('../models/QuestionHistory.model');
const WeakTopic = require('../models/WeakTopic.model');
const { simpleEmbed, cosineSimilarity } = require('../utils/embedding');

const SIM_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.78');

// Gather memory context for a user / role.
async function getUserMemory(userId, role) {
  const [weakTopics, recentInterviews, historyCount] = await Promise.all([
    WeakTopic.find({ userId, role }).sort({ avgScore: 1 }).limit(5).lean(),
    Interview.find({ userId, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(3)
      .select('results config completedAt')
      .lean(),
    QuestionHistory.countDocuments({ userId }),
  ]);
  return { weakTopics, recentInterviews, historyCount };
}

// Build a compact "memory context" string that can be injected into AI prompts.
function buildMemoryContext(memory) {
  const lines = [];
  if (memory.recentInterviews.length) {
    const scores = memory.recentInterviews.map(i => i.results?.overallScore?.toFixed(1)).join(', ');
    lines.push(`Recent performance: last ${memory.recentInterviews.length} interviews scored ${scores}/10.`);
  } else {
    lines.push('This is the user\'s first interview.');
  }
  if (memory.weakTopics.length) {
    lines.push(
      `Known weak areas: ${memory.weakTopics
        .map(t => `${t.topic} (avg ${t.avgScore.toFixed(1)}/10)`)
        .join(', ')}. Bias more questions toward these.`
    );
  }
  return lines.join(' ');
}

// Check whether a candidate question text is too similar to anything
// in the user's last `limit` history entries. Returns true if duplicate.
async function isDuplicateQuestion(userId, text, limit = 100) {
  const candidate = simpleEmbed(text);
  const history = await QuestionHistory.find({ userId })
    .sort({ askedAt: -1 })
    .limit(limit)
    .select('embedding text')
    .lean();
  for (const h of history) {
    const emb = h.embedding && h.embedding.length ? h.embedding : simpleEmbed(h.text);
    if (cosineSimilarity(candidate, emb) >= SIM_THRESHOLD) return true;
  }
  return false;
}

// Persist a batch of questions to history for future anti-repetition.
async function saveQuestionsToHistory(userId, role, interviewId, questions) {
  if (!questions?.length) return;
  const docs = questions.map(q => ({
    userId,
    interviewId,
    role,
    text: q.questionText || q.text,
    topic: q.topic || '',
    type: q.questionType || q.type || '',
    embedding: simpleEmbed(q.questionText || q.text),
  }));
  try {
    await QuestionHistory.insertMany(docs, { ordered: false });
  } catch (e) {
    // ignore duplicate-key style errors — history is best-effort
    console.warn('[memory] saveQuestionsToHistory:', e.message);
  }
}

// After interview completion, roll up per-topic scores and upsert weak-topic stats.
async function updateWeakTopicsFromInterview(userId, interview) {
  if (!interview?.questions?.length) return;
  const role = interview.config?.role || '';
  const byTopic = {};

  for (const q of interview.questions) {
    if (q.skipped || !q.aiFeedback?.score) continue;
    // We don't store topic on the answer schema yet — use questionType as a coarse fallback.
    const topic = q.topic || q.questionType || 'general';
    if (!byTopic[topic]) byTopic[topic] = { total: 0, count: 0 };
    byTopic[topic].total += q.aiFeedback.score;
    byTopic[topic].count += 1;
  }

  // Two-phase per topic: read existing, blend running average, write back.
  // Atomic enough for our needs — concurrent interviews per user are rare.
  const ops = Object.entries(byTopic).map(async ([topic, d]) => {
    const incomingAvg = d.total / d.count;
    try {
      const existing = await WeakTopic.findOne({ userId, topic, role }).lean();
      const prevAttempts = existing?.attempts || 0;
      const prevAvg = existing?.avgScore || 0;
      const blendedAvg = prevAttempts > 0
        ? ((prevAvg * prevAttempts) + (incomingAvg * d.count)) / (prevAttempts + d.count)
        : incomingAvg;
      await WeakTopic.updateOne(
        { userId, topic, role },
        {
          $set: { avgScore: blendedAvg, lastAsked: new Date() },
          $inc: { attempts: d.count },
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn(`[memory] weak topic update (${topic}):`, e.message);
    }
  });

  await Promise.all(ops);
}

module.exports = {
  getUserMemory,
  buildMemoryContext,
  isDuplicateQuestion,
  saveQuestionsToHistory,
  updateWeakTopicsFromInterview,
  SIM_THRESHOLD,
};
