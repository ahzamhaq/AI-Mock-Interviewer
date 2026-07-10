const recommendations = require('../services/recommendations.service');

/**
 * recommendations.controller — one endpoint powering the Continue Learning
 * rail on the Dashboard. Kept intentionally thin so the composition logic
 * lives in the service layer and is unit-testable in isolation.
 */

// GET /api/recommendations
const list = async (req, res, next) => {
  try {
    const cards = await recommendations.listRecommendations(req.user);
    res.json({ success: true, recommendations: cards });
  } catch (err) {
    next(err);
  }
};

module.exports = { list };
