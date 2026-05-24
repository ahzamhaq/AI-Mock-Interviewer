const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // Profile
  targetRole: {
    type: String,
    enum: ['frontend_developer', 'backend_developer', 'fullstack_developer', 'sde', 'data_analyst', 'hr', 'other'],
    default: 'sde',
  },
  targetCompany: { type: String, default: '' },
  experience: {
    type: String,
    enum: ['fresher', '1-2_years', '3+_years'],
    default: 'fresher',
  },
  resumeUrl: { type: String, default: null },
  resumeText: { type: String, default: '' },

  // Gamification
  streak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastInterviewDate: { type: Date, default: null },
  totalInterviews: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  badges: [{ type: String }],
  points: { type: Number, default: 0 },

  // Stats
  averageScore: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  showOnLeaderboard: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

userSchema.virtual('interviewHistory', {
  ref: 'Interview',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateStreak = function () {
  const now = new Date();
  const lastDate = this.lastInterviewDate;
  if (!lastDate) {
    this.streak = 1;
  } else {
    const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.streak += 1;
    } else if (diffDays > 1) {
      this.streak = 1;
    }
  }
  if (this.streak > this.longestStreak) this.longestStreak = this.streak;
  this.lastInterviewDate = now;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
