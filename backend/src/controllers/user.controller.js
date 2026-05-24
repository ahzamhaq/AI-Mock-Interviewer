const User = require('../models/User.model');
const path = require('path');
const fs = require('fs');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'targetRole', 'targetCompany', 'experience', 'showOnLeaderboard'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const resumeUrl = `/uploads/${req.file.filename}`;
    let resumeText = '';

    // Extract text from txt files
    if (req.file.mimetype === 'text/plain') {
      resumeText = fs.readFileSync(req.file.path, 'utf-8').substring(0, 3000);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { resumeUrl, resumeText },
      { new: true }
    );

    res.json({ success: true, resumeUrl: user.resumeUrl, message: 'Resume uploaded successfully' });
  } catch (error) {
    next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find({
      isActive: true,
      showOnLeaderboard: true,
      totalInterviews: { $gt: 0 },
    })
      .sort({ points: -1, averageScore: -1 })
      .limit(50)
      .select('name averageScore totalInterviews points streak bestScore');

    res.json({ success: true, leaderboard: users });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, uploadResume, getLeaderboard, changePassword };
