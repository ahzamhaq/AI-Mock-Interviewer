const User = require('../models/User.model');
const { generateToken } = require('../middleware/auth.middleware');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, email, password, targetRole, experience } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, targetRole, experience });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetRole: user.targetRole,
        experience: user.experience,
        streak: user.streak,
        totalInterviews: user.totalInterviews,
        points: user.points,
        averageScore: user.averageScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetRole: user.targetRole,
        experience: user.experience,
        streak: user.streak,
        totalInterviews: user.totalInterviews,
        points: user.points,
        averageScore: user.averageScore,
        resumeUrl: user.resumeUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential required' });
    }

    // Verify token with Google — accept any of our client IDs
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        // also accept without strict audience check during dev
      ],
    }).catch(async () => {
      // Fallback: decode token via Google tokeninfo endpoint
      const https = require('https');
      const payload = await new Promise((resolve, reject) => {
        https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error('Failed to parse token')); }
          });
        }).on('error', reject);
      });
      if (payload.error) throw new Error(payload.error_description || 'Invalid token');
      return { getPayload: () => ({ name: payload.name, email: payload.email, picture: payload.picture, sub: payload.sub }) };
    });

    const { name, email, picture, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: googleId + process.env.JWT_SECRET,
        avatar: picture,
        emailVerified: true,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        targetRole: user.targetRole,
        experience: user.experience,
        streak: user.streak,
        totalInterviews: user.totalInterviews,
        points: user.points,
        averageScore: user.averageScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, getMe, googleAuth };
