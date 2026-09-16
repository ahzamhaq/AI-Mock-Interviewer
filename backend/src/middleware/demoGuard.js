/**
 * demoGuard — blocks state-mutating actions that would leak one demo
 * user's data to another. The demo credential is shared: every visitor
 * signing in with it authenticates as the SAME User record. Without this
 * guard, one demo user could connect their GitHub account and the next
 * demo visitor would inherit access to their private repositories.
 *
 * Applied to:
 *   • POST /api/integrations/github/authorize  (would start an OAuth
 *     flow that ends up storing a token on the shared demo user)
 *   • GET  /api/integrations/github/callback   (the OAuth return leg)
 *   • GET  /api/integrations/github/repos      (would decrypt whichever
 *     token happens to be on the shared user and list its repos)
 *   • POST /api/presets                        (cross-user pollution;
 *     lower severity but still bad UX for demo)
 *
 * Reads should stay open — integrations/github/status is safe because
 * the response never contains the token itself.
 *
 * Assumes `protect` middleware has already populated `req.user`.
 */
const demoGuard = (req, res, next) => {
  if (req.user?.isDemo) {
    return res.status(403).json({
      success: false,
      error: 'This action is disabled on the shared demo account. Please create your own account to continue.',
      code: 'DEMO_ACCOUNT_RESTRICTED',
    });
  }
  next();
};

module.exports = demoGuard;
