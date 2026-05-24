const Interview = require('../models/Interview.model');
const User = require('../models/User.model');
const WeakTopic = require('../models/WeakTopic.model');

const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const [recentInterviews, scoreHistory, roleBreakdown] = await Promise.all([
      Interview.find({ userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .select('title config results completedAt duration'),

      Interview.find({ userId, status: 'completed' })
        .sort({ completedAt: 1 })
        .limit(20)
        .select('results.overallScore results.technicalScore results.communicationScore results.confidenceScore completedAt'),

      Interview.aggregate([
        { $match: { userId, status: 'completed' } },
        { $group: { _id: '$config.role', count: { $sum: 1 }, avgScore: { $avg: '$results.overallScore' } } },
      ]),
    ]);

    const scoreData = scoreHistory.map(i => ({
      date: i.completedAt,
      overall: i.results.overallScore,
      technical: i.results.technicalScore,
      communication: i.results.communicationScore,
      confidence: i.results.confidenceScore,
    }));

    res.json({
      success: true,
      stats: {
        totalInterviews: user.totalInterviews,
        averageScore: Math.round(user.averageScore * 10) / 10,
        bestScore: user.bestScore,
        streak: user.streak,
        longestStreak: user.longestStreak,
        points: user.points,
        badges: user.badges,
      },
      recentInterviews,
      scoreHistory: scoreData,
      roleBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

const getDetailedAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const interviews = await Interview.find({
      userId,
      status: 'completed',
      completedAt: { $gte: since },
    }).sort({ completedAt: 1 });

    // Filler word stats
    const fillerStats = interviews.reduce((acc, inv) => {
      inv.questions.forEach(q => {
        acc.total += q.voiceMetrics.fillerWordCount || 0;
        (q.voiceMetrics.fillerWords || []).forEach(w => {
          acc.words[w] = (acc.words[w] || 0) + 1;
        });
      });
      return acc;
    }, { total: 0, words: {} });

    // WPM trend
    const wpmTrend = interviews.map(inv => ({
      date: inv.completedAt,
      avgWPM: inv.results.averageWPM,
    }));

    // Score by question type
    const typeScores = {};
    const topicScores = {};
    interviews.forEach(inv => {
      inv.questions.forEach(q => {
        if (q.skipped || !q.aiFeedback.score) return;
        if (!typeScores[q.questionType]) typeScores[q.questionType] = { total: 0, count: 0 };
        typeScores[q.questionType].total += q.aiFeedback.score;
        typeScores[q.questionType].count += 1;

        const topic = q.topic || '';
        if (topic) {
          if (!topicScores[topic]) topicScores[topic] = { total: 0, count: 0 };
          topicScores[topic].total += q.aiFeedback.score;
          topicScores[topic].count += 1;
        }
      });
    });

    const typeAverages = Object.entries(typeScores).map(([type, data]) => ({
      type,
      avgScore: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    }));

    // Topic heatmap (lowest-scoring first)
    const topicHeatmap = Object.entries(topicScores)
      .map(([topic, d]) => ({ topic, avgScore: Math.round((d.total / d.count) * 10) / 10, count: d.count }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 10);

    // Persistent weak topics (from the WeakTopic model, across all sessions)
    const weakTopics = await WeakTopic.find({ userId })
      .sort({ avgScore: 1 })
      .limit(8)
      .select('topic role avgScore attempts lastAsked')
      .lean();

    // Skill radar — averages across all interviews in window
    const avg = (key) => interviews.length
      ? interviews.reduce((s, i) => s + (i.results[key] || 0), 0) / interviews.length
      : 0;
    const radar = [
      { axis: 'Technical', value: Math.round(avg('technicalScore') * 10) / 10, max: 10 },
      { axis: 'Communication', value: Math.round(avg('communicationScore') * 10) / 10, max: 10 },
      { axis: 'Confidence', value: Math.round(avg('confidenceScore') / 10 * 10) / 10, max: 10 },
      { axis: 'Completeness', value: Math.round(avg('completenessScore') * 10) / 10, max: 10 },
      { axis: 'Grammar', value: Math.round(avg('grammarScore') * 10) / 10, max: 10 },
    ];

    // Weekly consistency
    const weeklyData = {};
    interviews.forEach(inv => {
      const week = new Date(inv.completedAt);
      week.setDate(week.getDate() - week.getDay());
      const key = week.toISOString().split('T')[0];
      if (!weeklyData[key]) weeklyData[key] = { count: 0, totalScore: 0 };
      weeklyData[key].count += 1;
      weeklyData[key].totalScore += inv.results.overallScore;
    });

    res.json({
      success: true,
      analytics: {
        period: `${days} days`,
        totalInterviews: interviews.length,
        averageScore: interviews.length
          ? Math.round(interviews.reduce((s, i) => s + i.results.overallScore, 0) / interviews.length * 10) / 10
          : 0,
        fillerWordStats: fillerStats,
        wpmTrend,
        typeAverages,
        topicHeatmap,    // NEW: top weak topics by score within window
        weakTopics,      // NEW: persistent WeakTopic records
        radar,           // NEW: 5-axis skill radar

        weeklyConsistency: Object.entries(weeklyData).map(([week, d]) => ({
          week,
          count: d.count,
          avgScore: Math.round(d.totalScore / d.count * 10) / 10,
        })),
        scoreProgression: interviews.map(i => ({
          date: i.completedAt,
          overall: i.results.overallScore,
          technical: i.results.technicalScore,
          communication: i.results.communicationScore,
          confidence: i.results.confidenceScore,
          grade: i.results.grade,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats, getDetailedAnalytics };
