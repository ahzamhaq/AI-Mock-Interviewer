/**
 * github.service — thin wrapper around the GitHub REST API.
 *
 * Only endpoints Sprint 2 actually uses live here. Each function accepts an
 * OPTIONAL access token; without one, calls are made against the public API
 * (60 req/hr rate limit) which is sufficient for pasted-URL analysis of
 * public repos. With a token, the same functions unlock private-repo access
 * and the 5000 req/hr authenticated limit.
 *
 * We use Node 18+ native `fetch` on purpose so this module adds no new
 * runtime dependency. All responses are JSON except file-content, which
 * arrives base64-encoded per the GitHub contents API.
 *
 * Error surface: every function throws a plain Error with a user-safe
 * message on non-2xx. Controllers wrap these with HTTP status codes.
 */

const API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const USER_AGENT = 'interviewai-pro';

function buildHeaders(token) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': USER_AGENT,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(path, { token, method = 'GET', query, body } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const init = {
    method,
    headers: buildHeaders(token),
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(`GitHub request failed: ${err.message}`);
  }

  if (res.status === 401 || res.status === 403) {
    // 403 with rate-limit reset is a distinct failure mode worth surfacing.
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new Error('GitHub API rate limit exceeded. Connect a GitHub account or try again later.');
    }
    throw new Error('GitHub rejected the request. The connected account may need to reauthorize.');
  }
  if (res.status === 404) {
    // GitHub returns 404 for "repo doesn't exist", "owner doesn't exist",
    // and "you can't see it" (private, no access). Surface GitHub's own
    // message when present so the reason is obvious to the user.
    let detail = '';
    try {
      const j = await res.json();
      if (j?.message) detail = ` — GitHub says: "${j.message}"`;
    } catch { /* body may not be JSON */ }
    throw new Error(`Repository not found${detail}. Check the URL, or connect GitHub if it's private.`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.message ? ` (${j.message})` : '';
    } catch { /* swallow — body may not be JSON */ }
    throw new Error(`GitHub request failed with status ${res.status}${detail}`);
  }

  return res.json();
}

// ── Public endpoints ─────────────────────────────────────────────────────────

/**
 * Fetch a repository's metadata. Works with or without a token; private
 * repos require a token whose owner has read access.
 */
async function getRepo(owner, repo, { token } = {}) {
  return ghFetch(`/repos/${owner}/${repo}`, { token });
}

/**
 * Fetch the full file tree at a given ref. GitHub returns `truncated: true`
 * on very large repos — the analysis pipeline handles that by falling back
 * to a per-directory walk (out of scope for the wrapper).
 */
async function getRepoTree(owner, repo, ref, { token } = {}) {
  return ghFetch(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}`, {
    token,
    query: { recursive: 1 },
  });
}

/**
 * Fetch a single file's raw contents. GitHub's contents API returns base64
 * text; we decode to a UTF-8 string here and expose the size the API
 * reported so callers can enforce byte budgets.
 *
 * Returns { content, size, encoding: 'utf8', sha, path }.
 */
async function getFileContent(owner, repo, path, ref, { token } = {}) {
  const raw = await ghFetch(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    token,
    query: { ref },
  });
  if (Array.isArray(raw)) {
    throw new Error(`Path resolves to a directory, not a file: ${path}`);
  }
  if (raw.encoding !== 'base64') {
    // GitHub occasionally returns encoding: 'none' for very large files; we
    // treat that as unavailable so the pipeline moves on.
    throw new Error(`Unsupported file encoding for ${path}: ${raw.encoding}`);
  }
  const content = Buffer.from(raw.content || '', 'base64').toString('utf8');
  return { content, size: raw.size ?? content.length, encoding: 'utf8', sha: raw.sha, path: raw.path };
}

// ── Authenticated endpoints ──────────────────────────────────────────────────

/**
 * List the authenticated user's repositories. Sorted by most-recently-pushed
 * so the picker surfaces likely candidates first. `search` filters
 * client-side (GitHub's `/user/repos` endpoint has no `q` param); callers
 * doing large-scale search should use `/search/repositories` instead, which
 * is not needed for Sprint 2.
 */
async function listUserRepos(token, { page = 1, perPage = 30 } = {}) {
  return ghFetch('/user/repos', {
    token,
    query: {
      sort: 'pushed',
      direction: 'desc',
      per_page: perPage,
      page,
      // 'all' includes private + collab repos as well as the user's own.
      affiliation: 'owner,collaborator,organization_member',
    },
  });
}

/**
 * Fetch the authenticated user (login, id, avatar). Used during OAuth
 * callback to persist the GitHub identity onto the User record.
 */
async function getAuthenticatedUser(token) {
  return ghFetch('/user', { token });
}

/**
 * Best-effort token revocation on disconnect. GitHub's revoke endpoint
 * requires the OAuth app's own client credentials, not the user's token,
 * so we send a Basic-auth request instead of the usual Bearer flow.
 *
 * Failures are non-fatal — the caller should proceed to clear the local
 * `githubIntegration` regardless.
 */
async function revokeToken(token) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth app credentials are not configured.');
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const url = `${API_BASE}/applications/${clientId}/grant`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': USER_AGENT,
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: token }),
  });
  // 204 = success, 404 = grant already gone. Both are fine.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to revoke GitHub token (status ${res.status}).`);
  }
  return true;
}

// ── OAuth token exchange ─────────────────────────────────────────────────────

/**
 * Exchange an OAuth code for an access token. Called by the OAuth callback
 * controller. Returns { accessToken, tokenType, scope } on success.
 */
async function exchangeCodeForToken({ code, redirectUri }) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth app credentials are not configured.');
  }
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub token exchange failed with status ${res.status}.`);
  }
  const j = await res.json();
  if (j.error || !j.access_token) {
    throw new Error(j.error_description || j.error || 'GitHub token exchange did not return a token.');
  }
  return {
    accessToken: j.access_token,
    tokenType: j.token_type,
    scope: (j.scope || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// encodeURIComponent escapes '/' which we need to preserve inside the path.
function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

module.exports = {
  getRepo,
  getRepoTree,
  getFileContent,
  listUserRepos,
  getAuthenticatedUser,
  revokeToken,
  exchangeCodeForToken,
};
