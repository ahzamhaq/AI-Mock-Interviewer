const crypto = require('crypto');

/**
 * crypto.service — symmetric encryption for secrets we must store at rest
 * (GitHub OAuth access tokens today; other provider tokens later).
 *
 * Algorithm: AES-256-GCM with a random 12-byte IV per ciphertext. GCM
 * provides authenticated encryption — any tampering flips the auth-tag
 * check and decrypt() throws. Output format is compact and self-contained:
 *
 *   base64(iv) . base64(authTag) . base64(ciphertext)
 *
 * so a single string round-trips through Mongo without ambient state.
 *
 * Key management:
 *   - GITHUB_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex
 *     characters. Generate one with:  openssl rand -hex 32
 *   - The key is loaded lazily on first use so unrelated tests / imports do
 *     not crash when the env is missing.
 *   - Rotating the key requires re-encrypting stored tokens or forcing
 *     users to reconnect. Out of scope for Sprint 2.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SEP = '.';

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const hex = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'GITHUB_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to backend env.',
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `GITHUB_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). Expected 64 hex chars.`,
    );
  }
  cachedKey = buf;
  return cachedKey;
}

/**
 * Encrypt a UTF-8 plaintext. Returns the compact packed string described
 * above. Safe to store as-is in a Mongo String field.
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext) {
    throw new Error('encrypt() requires a non-empty string');
  }
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(SEP);
}

/**
 * Decrypt a packed ciphertext produced by encrypt(). Throws on any tamper
 * or malformed input — callers should treat a throw as "token unusable" and
 * force the user to reconnect their GitHub account.
 */
function decrypt(packed) {
  if (typeof packed !== 'string' || !packed) {
    throw new Error('decrypt() requires a non-empty string');
  }
  const parts = packed.split(SEP);
  if (parts.length !== 3) {
    throw new Error('decrypt() received malformed ciphertext');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Reset the cached key. Only intended for tests — production code should
 * never need to call this.
 */
function _resetKeyCache() {
  cachedKey = null;
}

module.exports = { encrypt, decrypt, _resetKeyCache };
