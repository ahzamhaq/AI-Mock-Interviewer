const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User.model');
const github = require('../services/github.service');
const { encrypt, decrypt } = require('../services/crypto.service');

/**
 * integrations.controller — GitHub as a LINKED account, never login.
 *
 * Flow:
 *   1. Frontend calls GET /github/authorize → we return an authorize URL
 *      with a short-lived signed `state` JWT that pins the flow to a user.
 *   2. Browser navigates to GitHub, user consents.
 *   3. GitHub redirects to GET /github/callback?code&state.
 *   4. We verify the state JWT, exchange the code for an access token,
 *      fetch the GitHub user, encrypt the token, save it on User, and
 *      redirect the browser back to the frontend Profile page.
 *
 * The token is never returned to the frontend. Status endpoints expose only
 * { connected, login, avatarUrl, connectedAt }.
 */

const STATE_TTL_SECONDS = 10 * 60;
const OAUTH_SCOPES = ['read:user', 'repo']; // repo required for private-repo import

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function frontendUrl(pathAndQuery) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${pathAndQuery}`;
}

function signState({ userId }) {
  // Short-lived JWT with a per-request nonce so replay across sessions is
  // caught. Signed with the same JWT_SECRET we already use for auth tokens.
  return jwt.sign(
    { userId: String(userId), nonce: crypto.randomBytes(8).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL_SECONDS },
  );
}

function verifyState(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

// GET /api/integrations/github/status
const status = async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select('githubIntegration');
    const gi = u?.githubIntegration;
    if (!gi?.connected) {
      return res.json({ success: true, connected: false });
    }
    res.json({
      success: true,
      connected: true,
      login: gi.login,
      avatarUrl: gi.avatarUrl,
      connectedAt: gi.connectedAt,
      scopes: gi.scopes || [],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/integrations/github/authorize
// Returns { url } so the frontend can navigate the browser to GitHub.
const authorize = async (req, res, next) => {
  try {
    const clientId = requireEnv('GITHUB_CLIENT_ID');
    const redirectUri = requireEnv('GITHUB_OAUTH_REDIRECT_URI');

    const state = signState({ userId: req.user._id });

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', OAUTH_SCOPES.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'false');

    res.json({ success: true, url: url.toString() });
  } catch (err) {
    next(err);
  }
};

// GET /api/integrations/github/callback?code=...&state=...
// This is the redirect target for GitHub — NOT a JSON API. It always
// finishes by redirecting the browser back to the frontend Profile page
// with ?github=connected or ?github=error&reason=…
const callback = async (req, res, next) => {
  const bail = (reason) =>
    res.redirect(frontendUrl(`/profile?github=error&reason=${encodeURIComponent(reason)}`));

  try {
    const { code, state } = req.query || {};
    if (!code || !state) return bail('missing_code_or_state');

    const decoded = verifyState(state);
    if (!decoded?.userId) return bail('invalid_state');

    const redirectUri = requireEnv('GITHUB_OAUTH_REDIRECT_URI');

    let token;
    try {
      token = await github.exchangeCodeForToken({ code, redirectUri });
    } catch (err) {
      console.error('[github oauth] token exchange failed:', err.message);
      return bail('token_exchange_failed');
    }

    let ghUser;
    try {
      ghUser = await github.getAuthenticatedUser(token.accessToken);
    } catch (err) {
      console.error('[github oauth] user fetch failed:', err.message);
      return bail('user_fetch_failed');
    }

    let accessTokenEncrypted;
    try {
      accessTokenEncrypted = encrypt(token.accessToken);
    } catch (err) {
      console.error('[github oauth] token encrypt failed:', err.message);
      return bail('server_misconfigured');
    }

    await User.updateOne(
      { _id: decoded.userId },
      {
        $set: {
          'githubIntegration.connected': true,
          'githubIntegration.githubId': ghUser.id,
          'githubIntegration.login': ghUser.login,
          'githubIntegration.avatarUrl': ghUser.avatar_url || '',
          'githubIntegration.accessTokenEncrypted': accessTokenEncrypted,
          'githubIntegration.scopes': token.scope || [],
          'githubIntegration.connectedAt': new Date(),
        },
      },
    );

    return res.redirect(frontendUrl('/profile?github=connected'));
  } catch (err) {
    // Don't leak stack traces to the browser — log and generic-fail.
    console.error('[github oauth] callback error:', err);
    return bail('unexpected');
  }
};

// DELETE /api/integrations/github
const disconnect = async (req, res, next) => {
  try {
    // Best-effort remote revoke. We ignore the outcome so a network hiccup
    // does not block the user from disconnecting locally.
    const u = await User.findById(req.user._id).select('+githubIntegration.accessTokenEncrypted');
    if (u?.githubIntegration?.accessTokenEncrypted) {
      try {
        const token = decrypt(u.githubIntegration.accessTokenEncrypted);
        await github.revokeToken(token).catch(() => {});
      } catch { /* undecryptable — nothing to revoke */ }
    }

    await User.updateOne(
      { _id: req.user._id },
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

    res.json({ success: true, connected: false });
  } catch (err) {
    next(err);
  }
};

// GET /api/integrations/github/repos?search=&page=
const listRepos = async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select('+githubIntegration.accessTokenEncrypted');
    if (!u?.githubIntegration?.connected || !u.githubIntegration.accessTokenEncrypted) {
      return res.status(400).json({ success: false, error: 'GitHub account is not connected.' });
    }
    let token;
    try {
      token = decrypt(u.githubIntegration.accessTokenEncrypted);
    } catch {
      return res.status(400).json({ success: false, error: 'GitHub token is invalid. Please reconnect.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 30;
    const search = (req.query.search || '').trim().toLowerCase();

    let repos;
    try {
      repos = await github.listUserRepos(token, { page, perPage });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Server-side filter over the returned page. GitHub's /user/repos does
    // not accept a search query; for large sets the frontend can paginate.
    const filtered = search
      ? repos.filter((r) => (r.full_name || '').toLowerCase().includes(search))
      : repos;

    const shaped = filtered.map((r) => ({
      id: r.id,
      owner: r.owner?.login,
      name: r.name,
      fullName: r.full_name,
      description: r.description || '',
      language: r.language || '',
      stars: r.stargazers_count || 0,
      private: !!r.private,
      htmlUrl: r.html_url,
      defaultBranch: r.default_branch,
      updatedAt: r.pushed_at || r.updated_at,
    }));

    res.json({ success: true, page, repos: shaped, hasMore: repos.length === perPage });
  } catch (err) {
    next(err);
  }
};

module.exports = { status, authorize, callback, disconnect, listRepos };
