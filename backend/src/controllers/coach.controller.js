const User = require('../models/User.model');
const coach = require('../services/coach.service');

/**
 * coach.controller — thin wrappers around the coach service. Two endpoints:
 *
 *   GET  /api/coach/roadmap           — cached-or-fresh
 *   POST /api/coach/roadmap/refresh   — forces regeneration
 *
 * The service owns caching and LLM interaction. This layer just resolves
 * the user, invokes the service, and returns.
 */

const getRoadmap = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { items, generatedAt, cached } = await coach.getRoadmap(user);
    res.json({ success: true, roadmap: { items, generatedAt, cached } });
  } catch (err) {
    next(err);
  }
};

const refreshRoadmap = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { items, generatedAt } = await coach.getRoadmap(user, { force: true });
    res.json({ success: true, roadmap: { items, generatedAt, cached: false } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRoadmap, refreshRoadmap };
