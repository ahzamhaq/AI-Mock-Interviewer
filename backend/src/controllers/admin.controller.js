const User = require('../models/User.model');
const Interview = require('../models/Interview.model');

const getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalInterviews, completedInterviews, activeToday] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Interview.countDocuments(),
      Interview.countDocuments({ status: 'completed' }),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 86400000) } }),
    ]);

    const avgScoreResult = await Interview.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$results.overallScore' } } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalInterviews,
        completedInterviews,
        activeToday,
        completionRate: totalInterviews ? Math.round(completedInterviews / totalInterviews * 100) : 0,
        avgScore: avgScoreResult[0]?.avgScore ? Math.round(avgScoreResult[0].avgScore * 10) / 10 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('-password -resumeText'),
      User.countDocuments(query),
    ]);

    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats, getUsers, toggleUserStatus };
