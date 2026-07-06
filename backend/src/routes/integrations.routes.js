const express = require('express');
const { protect } = require('../middleware/auth.middleware');
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
// callback back to a user.
router.get('/github/callback', callback);

// Every other integrations endpoint is per-user; require auth.
router.use(protect);

router.get('/github/status',    status);
router.get('/github/authorize', authorize);
router.delete('/github',        disconnect);
router.get('/github/repos',     listRepos);

module.exports = router;
