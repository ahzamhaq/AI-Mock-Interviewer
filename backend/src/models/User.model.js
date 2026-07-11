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
  // Sprint 4 Commit 8: badge entries carry an unlock timestamp.
  //
  // The schema is Mixed so it accepts BOTH the legacy String shape and the
  // new { id, unlockedAt } object shape without a data migration. A
  // pre-save hook (see below) normalizes any surviving legacy strings to
  // objects the next time the user is saved — self-healing over time.
  //
  // `hasBadge()` (defined on this schema) and the frontend's
  // normalizeBadges() both handle either shape transparently.
  badges: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  points: { type: Number, default: 0 },

  // Stats
  averageScore: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },

  // ── AI Coach roadmap cache (Sprint 4) ─────────────────────────────────
  // The Coach page generates a personalized set of focus areas by asking
  // the LLM to interpret the user's WeakTopic, recent interviews, and
  // SkillRadar. That call is expensive; we cache the result on the user
  // for 24h and expose an explicit "refresh" endpoint.
  //
  // `items` is intentionally schemaless (Mixed) — the roadmap shape may
  // evolve as we tune the prompt without a migration burden. The frontend
  // validates the shape it renders. `generatedAt` is the cache key.
  coachRoadmap: {
    items:       { type: [mongoose.Schema.Types.Mixed], default: [] },
    generatedAt: { type: Date, default: null },
  },

  // ── Connected accounts ────────────────────────────────────────────────
  // GitHub is an OPTIONAL linked account, never part of login. Users who
  // never connect GitHub retain full access to the platform; the only
  // feature that requires connection is private-repo import.
  //
  // `accessTokenEncrypted` holds the OAuth token wrapped by
  // services/crypto.service.js (AES-256-GCM). It is `select: false` so it
  // is never returned by default queries, and every user-facing controller
  // strips it before responding.
  githubIntegration: {
    connected:            { type: Boolean, default: false },
    githubId:             { type: Number,  default: null },
    login:                { type: String,  default: '' },
    avatarUrl:            { type: String,  default: '' },
    accessTokenEncrypted: { type: String,  default: '', select: false },
    scopes:               { type: [String], default: [] },
    connectedAt:          { type: Date,    default: null },
  },

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

// Sprint 4 Commit 8: self-heal legacy string entries in badges. Runs on
// every save (cheap — array is tiny), converts anything that isn't already
// { id, unlockedAt } shaped. `unlockedAt` for legacy entries is set to
// `null` so the UI can tell "we don't know when" vs a real timestamp.
userSchema.pre('save', function (next) {
  if (Array.isArray(this.badges)) {
    this.badges = this.badges.map((b) => {
      if (typeof b === 'string') return { id: b, unlockedAt: null };
      if (b && typeof b === 'object' && typeof b.id === 'string') return b;
      return null;
    }).filter(Boolean);
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * hasBadge — cheap membership check that tolerates BOTH shapes of the
 * `badges` array:
 *   • Legacy:   [String]              (pre-Sprint-4)
 *   • Sprint 4: [{ id, unlockedAt }]  (introduced in Sprint 4 Commit 8)
 *
 * Every read path in the codebase should go through this helper so the
 * migration is invisible to callers. Achievement evaluation code uses it
 * to guarantee idempotency: if the user already has a badge, unlock is a
 * no-op regardless of which shape stored it.
 */
userSchema.methods.hasBadge = function (id) {
  if (!id || !Array.isArray(this.badges)) return false;
  return this.badges.some((b) => (typeof b === 'string' ? b === id : b?.id === id));
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
