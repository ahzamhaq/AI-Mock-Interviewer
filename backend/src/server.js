require('dotenv').config();
const app = require('./app');
const connectDB = require('./utils/database');
const User = require('./models/User.model');
const { startDemoCleanupScheduler } = require('./services/demoCleanup.service');

const PORT = process.env.PORT || 5000;

// Emails whose accounts are shared demos. Anyone logging in with these
// credentials becomes the SAME user record — so we mark them isDemo=true
// on boot and force-disconnect any GitHub token that a prior demo visitor
// may have attached. Overridable via the DEMO_EMAILS env var (comma-sep).
const DEMO_EMAILS = (
  process.env.DEMO_EMAILS || 'demo@interviewai.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Idempotent on-boot maintenance for the shared demo account(s):
 *   1. Ensure isDemo=true on the flagged records.
 *   2. If a prior visitor connected GitHub, forcibly disconnect it so a
 *      new visitor can't inherit the token or see the linked login.
 *   3. Log what changed. Errors here are non-fatal — we still serve.
 */
async function reconcileDemoAccounts() {
  if (!DEMO_EMAILS.length) return;
  try {
    const flagged = await User.updateMany(
      { email: { $in: DEMO_EMAILS }, isDemo: { $ne: true } },
      { $set: { isDemo: true } },
    );
    if (flagged.modifiedCount) {
      console.log(`[demo] flagged ${flagged.modifiedCount} account(s) as isDemo`);
    }

    const disconnected = await User.updateMany(
      { email: { $in: DEMO_EMAILS }, 'githubIntegration.connected': true },
      {
        $set: {
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
    if (disconnected.modifiedCount) {
      console.log(`[demo] force-disconnected GitHub on ${disconnected.modifiedCount} account(s)`);
    }
  } catch (err) {
    console.error('[demo] reconciliation failed:', err.message);
  }
}

connectDB().then(async () => {
  await reconcileDemoAccounts();
  // Nightly wipe of demo-account state (interviews, projects, presets,
  // streak, etc.). Boot reconcile handles tokens; this handles volume.
  startDemoCleanupScheduler();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🔧 Boot marker: sprint2-diagnostics ${new Date().toISOString()}\n`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
