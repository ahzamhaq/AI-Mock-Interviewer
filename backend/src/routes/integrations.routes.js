const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const demoGuard = require('../middleware/demoGuard');
const {
  status,
  authorize,
  callback,
  disconnect,
  listRepos,
} = require('../controllers/integrations.controller');

const router = express.Router();

// NOTE ORDER: the OAuth callback is a browser-facing redirect target — it
// must NOT be behind `protect` because the request comes from GitHub, not
// from an authenticated fetch. The signed `state` JWT is what binds the
// callback back to a user. Demo-account guard for the callback lives
// inside integrations.controller#callback (reads decoded.userId, checks
// isDemo, redirects to the frontend with an error).
router.get('/github/callback', callback);

// Every other integrations endpoint is per-user; require auth.
router.use(protect);

// Status is a read — safe on the demo account (never returns the token).
router.get('/github/status', status);

// Everything else mutates or exposes token-scoped data. Guarded.
router.get('/github/authorize', demoGuard, authorize);
router.delete('/github',        demoGuard, disconnect);
router.get('/github/repos',     demoGuard, listRepos);

module.exports = router;
