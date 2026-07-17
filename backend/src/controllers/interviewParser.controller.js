const interviewParser = require('../services/interviewParser.service');

/**
 * interviewParser.controller — POST /api/interviews/parse
 *
 * Thin handler. Delegates to interviewParser.service and translates its
 * ParserError into HTTP 400 with a user-safe message.
 *
 * This endpoint DOES NOT create an interview. It only interprets a
 * prompt. The actual interview creation happens later when the Review
 * page POSTs to /api/interviews with the (possibly edited) draft mapped
 * to the wizard payload.
 */

const parse = async (req, res, next) => {
  try {
    const { prompt, useResume, useProjects } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please describe your interview in a little more detail.',
      });
    }

    let result;
    try {
      result = await interviewParser.parsePrompt({
        prompt,
        useResume: !!useResume,
        useProjects: !!useProjects,
      });
    } catch (err) {
      if (err instanceof interviewParser.ParserError) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }

    return res.json({
      success: true,
      draft:      result.draft,
      confidence: result.confidence,
      reasons:    result.reasons || {}, // Sprint 5 Commit 6 — per-field explanations
      unknown:    result.unknown,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { parse };
