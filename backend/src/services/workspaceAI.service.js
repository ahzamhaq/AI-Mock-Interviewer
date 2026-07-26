const aiProviderManager = require('./aiProviderManager');
const promptBuilder = require('./promptBuilder.service');

/**
 * workspaceAI.service — orchestrates a single repository-aware AI reply.
 *
 * Sprint 6 Commit 5. This service is the ONLY place workspace chat
 * touches the AI Provider Manager. Its job is:
 *
 *   1. Ask promptBuilder to shape { context + history + user turn }
 *      into a single prompt string.
 *   2. Call aiProviderManager.generate with sensible generation opts.
 *   3. Return { text, usage, providerError? }.
 *
 * It does NOT persist anything. It does NOT know about Express, Mongo,
 * or ownership. The caller (workspaceMessage.service) handles storage.
 *
 * Failure contract: this service always resolves. On provider error it
 * returns a `providerError` flag + a friendly fallback string so the
 * caller can still persist a coherent assistant turn. Never throws for
 * a normal generation failure — throws only on programmer error.
 */

const TEMPERATURE = 0.3;      // grounded conversational tone, not creative writing
const MAX_TOKENS = 900;       // enough for a substantive answer, not so much it drifts
const FALLBACK_TEXT =
  "I'm sorry, I couldn't generate a response right now. Please try again in a moment.";

/**
 * Generate one assistant reply.
 *
 * @param {Object} input
 * @param {Object|null} input.repositoryContext
 * @param {Array}       input.conversationHistory
 * @param {string}      input.userMessage
 * @returns {Promise<{ text: string, usage: Object, providerError: (string|null) }>}
 */
async function generate({ repositoryContext = null, conversationHistory = [], userMessage = '' }) {
  const { prompt } = promptBuilder.build({
    repositoryContext,
    conversationHistory,
    userMessage,
  });

  let raw;
  try {
    raw = await aiProviderManager.generate(prompt, {
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
    });
  } catch (err) {
    // Provider chain exhausted / config error / network blowout. Log
    // internally, hand the caller a friendly fallback so the user's
    // conversation never ends in a dangling user turn.
    console.error('[workspaceAI] provider chain failed:', err.message);
    return {
      text: FALLBACK_TEXT,
      usage: {},
      providerError: err.message || 'provider_failure',
    };
  }

  const text = normalize(raw);
  if (!text) {
    // Provider returned an empty string — treat as failure but still
    // give the user something coherent.
    console.error('[workspaceAI] provider returned empty text');
    return {
      text: FALLBACK_TEXT,
      usage: {},
      providerError: 'empty_response',
    };
  }

  return {
    text,
    // aiProviderManager.generate() returns a plain string in the current
    // interface — no usage metadata. If the provider layer starts
    // surfacing usage later, wire it here.
    usage: {},
    providerError: null,
  };
}

function normalize(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // Strip stray leading/trailing markdown fences the model sometimes wraps.
  return s.replace(/^```(?:markdown|text)?\s*/i, '').replace(/```$/, '').trim();
}

module.exports = {
  generate,
  FALLBACK_TEXT,
};
