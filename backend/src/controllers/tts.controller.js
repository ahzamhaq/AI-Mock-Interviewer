const { getTTSAudio } = require('../services/tts.service');

// POST /api/tts  { text, voice? }
// Returns: audio/mpeg buffer (200) OR { useBrowser: true } when no server provider configured.
const synthesize = async (req, res, next) => {
  try {
    const { text, voice } = req.body;
    if (!text || typeof text !== 'string' || text.length > 2000) {
      return res.status(400).json({ success: false, error: 'Invalid or too-long text' });
    }
    const buffer = await getTTSAudio(text, { voice });
    if (!buffer) {
      // Tell client to use browser SpeechSynthesis
      return res.json({ success: true, useBrowser: true });
    }
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { synthesize };
