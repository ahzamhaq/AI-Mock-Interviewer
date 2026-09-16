const User = require('../models/User.model');
const Interview = require('../models/Interview.model');
const Project = require('../models/Project.model');
const RepositoryAnalysis = require('../models/RepositoryAnalysis.model');

/**
 * demoCleanup — periodic reset for shared demo accounts.
 *
 * The demo credential (see DEMO_EMAILS env, defaults to
 * demo@interviewai.com) is shared across every visitor. Even with
 * demoGuard blocking token-sensitive writes (GitHub connect, preset
 * save), the account still accumulates:
 *
 *   • Interview documents (every visitor's mock sessions)
 *   • Project + RepositoryAnalysis records (public-URL analyses)
 *   • Recent config ring buffer, coach roadmap cache, streak counters,
 *     score totals, badges, in-flight OAuth state
 *
 * This service wipes those on a nightly schedule so the demo account
 * always feels like a fresh install for the next visitor. Runs on an
 * in-process timer — no cron dependency. First run is scheduled to
 * happen at the next occurrence of RUN_HOUR_UTC; subsequent runs are
 * 24h apart. On server restart the boot-time reconcile already handles
 * token wipe; this service handles data volume.
 *
 * Idempotent, safe to run repeatedly. All errors are caught and logged.
 */

// Match the same env used by server.js reconcileDemoAccounts.
function getDemoEmails() {
  return (process.env.DEMO_EMAILS || 'demo@interviewai.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RUN_HOUR_UTC = 3; // 03:00 UTC — low-traffic hour for most timezones
let timerHandle = null;

/**
 * Wipe interview/project/preset/etc. state for one demo user. Returns
 * a counters object so the caller can log what happened.
 */
async function wipeDemoUser(user) {
  const counters = {
    interviews: 0,
    projects: 0,
    analyses: 0,
    presets: 0,
    recents: 0,
    badges: 0,
  };

  // Interviews. Delete every row for this user regardless of status —
  // in-progress sessions from previous visitors are stale by definition.
  const invRes = await Interview.deleteMany({ userId: user._id });
  counters.interviews = invRes.deletedCount || 0;

  // Projects + their analyses. Delete analyses first to avoid dangling
  // references, then the projects themselves.
  const projects = await Project.find({ userId: user._id }).select('_id').lean();
  if (projects.length) {
    const projectIds = projects.map((p) => p._id);
    const analysisRes = await RepositoryAnalysis.deleteMany({ projectId: { $in: projectIds } });
    counters.analyses = analysisRes.deletedCount || 0;
    const projRes = await Project.deleteMany({ _id: { $in: projectIds } });
    counters.projects = projRes.deletedCount || 0;
  }

  // User-scoped sub-docs — reset to defaults. Preserves identity fields
  // (name, email, role, targetRole, experience) so the account is still
  // usable; wipes usage state so the next visitor gets a clean slate.
  counters.presets = (user.savedPresets || []).length;
  counters.recents = (user.recentConfigs || []).length;
  counters.badges  = (user.badges || []).length;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        savedPresets: [],
        recentConfigs: [],
        badges: [],
        coachRoadmap: { items: [], generatedAt: null },
        streak: 0,
        longestStreak: 0,
        lastInterviewDate: null,
        totalInterviews: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0,
        points: 0,
        // Belt-and-braces: strip any GitHub state that slipped past the
        // boot reconcile (e.g. if a hotfix bypassed demoGuard temporarily).
        'githubIntegration.connected': false,
        'githubIntegration.githubId': null,
        'githubIntegration.login': '',
        'githubIntegration.avatarUrl': '',
        'githubIntegration.accessTokenEncrypted': '',
        'githubIntegration.scopes': [],
        'githubIntegration.connectedAt': null,
      },
    },
  );

  return counters;
}

/**
 * Public entry point — sweep all flagged demo accounts.
 */
async function runCleanup() {
  const emails = getDemoEmails();
  if (!emails.length) return;

  const users = await User.find({ email: { $in: emails } });
  if (!users.length) return;

  for (const user of users) {
    try {
      const counters = await wipeDemoUser(user);
      console.log(
        `[demo cleanup] ${user.email}: `
        + `${counters.interviews} interviews · `
        + `${counters.projects} projects · `
        + `${counters.analyses} analyses · `
        + `${counters.presets} presets · `
        + `${counters.recents} recents · `
        + `${counters.badges} badges`,
      );
    } catch (err) {
      console.error(`[demo cleanup] ${user.email} failed:`, err.message);
    }
  }
}

/**
 * Milliseconds from now until the next 03:00 UTC. Used to schedule the
 * first tick precisely, then every 24h after.
 */
function msUntilNextRun() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RUN_HOUR_UTC, 0, 0, 0,
  ));
  if (next.getTime() <= now.getTime()) {
    // Already past today's window — schedule for tomorrow.
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * Kick off the recurring cleanup timer. Called once from server.js
 * after the DB is connected. Safe to call multiple times (no-ops after
 * the first).
 */
function startDemoCleanupScheduler() {
  if (timerHandle) return;

  const delay = msUntilNextRun();
  const hours = Math.round(delay / 3600000);
  console.log(`[demo cleanup] scheduler armed — first run in ~${hours}h (${RUN_HOUR_UTC}:00 UTC), every 24h after`);

  // First run at the next 03:00 UTC, then every 24h.
  timerHandle = setTimeout(function tick() {
    runCleanup().catch((err) => console.error('[demo cleanup] tick failed:', err.message));
    timerHandle = setInterval(
      () => runCleanup().catch((err) => console.error('[demo cleanup] tick failed:', err.message)),
      ONE_DAY_MS,
    );
  }, delay);
}

module.exports = { startDemoCleanupScheduler, runCleanup };
