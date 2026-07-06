/**
 * repoUrl — parse GitHub repository references from the many shapes users
 * paste. The goal is to accept anything a reasonable user would consider a
 * "GitHub link" and normalize it to { owner, repo }.
 *
 * Accepted shapes (owner="acme", repo="widgets"):
 *   https://github.com/acme/widgets
 *   http://github.com/acme/widgets/
 *   https://github.com/acme/widgets.git
 *   github.com/acme/widgets
 *   www.github.com/acme/widgets
 *   git@github.com:acme/widgets.git
 *   https://github.com/acme/widgets/tree/main
 *   https://github.com/acme/widgets/blob/main/src/index.js
 *   acme/widgets                       (bare shorthand)
 *
 * Rejected:
 *   anything that does not resolve to exactly one owner + one repo
 *   URLs from providers other than github.com
 *
 * Kept as a small pure module so the URL flow (public-repo paste) and the
 * connected-GitHub flow share the same normalization and the parser is
 * unit-testable in isolation.
 */

// GitHub's own username / repo naming rules — loose but well-defined.
// Owners: alphanumerics + single hyphens, 1–39 chars, no leading/trailing hyphen.
// Repos:  alphanumerics + . _ - , 1–100 chars.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_RE  = /^[A-Za-z0-9._-]{1,100}$/;

function stripSuffix(name) {
  return name.replace(/\.git$/i, '');
}

function fromSshUrl(input) {
  // git@github.com:owner/repo(.git)?
  const m = input.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: stripSuffix(m[2]) };
}

function fromHttpLike(input) {
  // Coerce input into something the URL parser can handle. Users often paste
  // "github.com/acme/widgets" without a protocol; prefix https:// for those.
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let u;
  try {
    u = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return null;

  // Path is /owner/repo/... — we only care about the first two segments.
  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  return { owner: segments[0], repo: stripSuffix(segments[1]) };
}

function fromBareShorthand(input) {
  // owner/repo — exactly one slash, no protocol, no host.
  const m = input.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!m) return null;
  return { owner: m[1], repo: stripSuffix(m[2]) };
}

/**
 * Parse any accepted shape and return { owner, repo } or throw with a
 * user-safe error message. Controllers surface the error text directly to
 * the frontend so the message must be presentable.
 */
function parseRepoUrl(input) {
  if (typeof input !== 'string') {
    throw new Error('Repository URL is required.');
  }
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Repository URL is required.');

  const parsed =
    fromSshUrl(trimmed) ||
    fromHttpLike(trimmed) ||
    fromBareShorthand(trimmed);

  if (!parsed) {
    throw new Error("That doesn't look like a GitHub repository URL.");
  }

  if (!OWNER_RE.test(parsed.owner) || !REPO_RE.test(parsed.repo)) {
    throw new Error('Repository owner or name has invalid characters.');
  }

  return { owner: parsed.owner, repo: parsed.repo };
}

/**
 * Rebuild a canonical https URL from parsed parts. Handy for storing a
 * consistent `repoUrl` on the Project regardless of what the user pasted.
 */
function canonicalUrl({ owner, repo }) {
  return `https://github.com/${owner}/${repo}`;
}

module.exports = { parseRepoUrl, canonicalUrl };
