const crypto = require('crypto');
const User = require('../models/User.model');

/**
 * presets.controller — CRUD for user-owned saved interview presets.
 *
 * A preset is: { id, name, payload, createdAt, updatedAt }
 *   • payload is the exact shape POST /api/interviews accepts.
 *   • id is a server-generated random hex string. Stable across renames.
 *
 * Storage lives on User.savedPresets (see User.model.js). This controller
 * is intentionally the ONLY writer of that field.
 *
 * All handlers assume `protect` middleware has set req.user.
 */

const MAX_PRESETS_PER_USER = 20;

// GET /api/presets
const list = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('savedPresets').lean();
    res.json({ success: true, presets: user?.savedPresets || [] });
  } catch (err) { next(err); }
};

// POST /api/presets  { name, payload }
const create = async (req, res, next) => {
  try {
    const { name, payload } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Preset name is required.' });
    }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Preset payload is required.' });
    }

    const user = await User.findById(req.user._id).select('savedPresets');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    if (user.savedPresets.length >= MAX_PRESETS_PER_USER) {
      return res.status(400).json({
        success: false,
        error: `You can save at most ${MAX_PRESETS_PER_USER} presets.`,
      });
    }

    const now = new Date();
    const preset = {
      id: crypto.randomBytes(8).toString('hex'),
      name: name.trim().slice(0, 60),
      payload,
      createdAt: now,
      updatedAt: now,
    };
    user.savedPresets.push(preset);
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, preset });
  } catch (err) { next(err); }
};

// PATCH /api/presets/:id  { name? }
const rename = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'A new name is required.' });
    }

    const user = await User.findById(req.user._id).select('savedPresets');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const preset = user.savedPresets.find((p) => p.id === req.params.id);
    if (!preset) return res.status(404).json({ success: false, error: 'Preset not found.' });

    preset.name = name.trim().slice(0, 60);
    preset.updatedAt = new Date();
    // Mongoose won't autodetect Mixed sub-doc field mutation reliably;
    // mark the array modified so the change persists.
    user.markModified('savedPresets');
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, preset });
  } catch (err) { next(err); }
};

// DELETE /api/presets/:id
const remove = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('savedPresets');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const before = user.savedPresets.length;
    user.savedPresets = user.savedPresets.filter((p) => p.id !== req.params.id);
    if (user.savedPresets.length === before) {
      return res.status(404).json({ success: false, error: 'Preset not found.' });
    }
    await user.save({ validateBeforeSave: false });

    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { list, create, rename, remove };
