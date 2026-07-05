// Multi-provider AI fallback manager.
// Tries primary provider first, falls back on 429/quota/404 to next.
// All providers expose the same generate(prompt, opts) -> string interface.

const { GoogleGenerativeAI } = require('@google/generative-ai');

let Groq;
try { Groq = require('groq-sdk'); } catch { Groq = null; }

const isRateOrModelError = (msg = '') =>
  /429|quota|rate|limit|exceeded|model.*not.*found|404/i.test(msg);

class AIProviderManager {
  constructor() {
    this._init();
  }

  _init() {
    this.primary = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    this.gemini = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    this.groq = (Groq && process.env.GROQ_API_KEY)
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;
    this.openrouterKey = process.env.OPENROUTER_API_KEY || null;
  }

  _availableProviders() {
    const has = {
      gemini: !!this.gemini,
      groq: !!this.groq,
      openrouter: !!this.openrouterKey,
    };
    const ordered = [this.primary, 'groq', 'gemini', 'openrouter'];
    const seen = new Set();
    return ordered.filter(p => has[p] && !seen.has(p) && seen.add(p));
  }

  async generate(prompt, opts = {}) {
    const providers = this._availableProviders();
    if (!providers.length) throw new Error('No AI provider configured (set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY)');

    let lastErr;
    for (const p of providers) {
      try {
        const text = await this._call(p, prompt, opts);
        if (text && text.trim()) return text;
      } catch (err) {
        lastErr = err;
        const msg = err?.message || '';
        if (isRateOrModelError(msg)) {
          console.warn(`[AI] ${p} fallback (${msg.slice(0, 80)})`);
          continue;
        }
        // Non-recoverable error from this provider — still try the next
        console.warn(`[AI] ${p} error: ${msg.slice(0, 80)} — trying next provider`);
      }
    }
    throw lastErr || new Error('All AI providers exhausted');
  }

  async _call(provider, prompt, opts) {
    switch (provider) {
      case 'gemini': return this._gemini(prompt, opts);
      case 'groq': return this._groq(prompt, opts);
      case 'openrouter': return this._openrouter(prompt, opts);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async _gemini(prompt, opts) {
    const MODELS = opts.model
      ? [opts.model]
      : ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-lite'];
    let lastErr;
    for (const modelName of MODELS) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: opts.temperature ?? 0.7,
            maxOutputTokens: opts.maxTokens ?? 2000,
          },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (e) {
        lastErr = e;
        if (isRateOrModelError(e?.message)) continue;
        throw e;
      }
    }
    throw lastErr;
  }

  async _groq(prompt, opts) {
    // Llama 3.3 70B is deprecated (decommission 2026-08-16). Migrated to GPT-OSS 120B
    // as primary with Qwen3 32B as fallback per Groq's recommendation.
    const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'];
    let lastErr;
    for (const model of MODELS) {
      try {
        const resp = await this.groq.chat.completions.create({
          model: opts.model || model,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 2000,
        });
        return resp.choices[0]?.message?.content || '';
      } catch (e) {
        lastErr = e;
        if (isRateOrModelError(e?.message)) continue;
        throw e;
      }
    }
    throw lastErr;
  }

  async _openrouter(prompt, opts) {
    const FREE_MODELS = [
      'openai/gpt-oss-20b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'z-ai/glm-4.5-air:free',
    ];
    const models = opts.model ? [opts.model] : FREE_MODELS;
    let lastErr;
    for (const model of models) {
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'AI Mock Interviewer',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 2000,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error?.message || `OpenRouter ${resp.status}`);
        const text = data.choices?.[0]?.message?.content || '';
        if (text.trim()) return text;
      } catch (e) {
        lastErr = e;
        if (isRateOrModelError(e?.message)) continue;
        throw e;
      }
    }
    throw lastErr || new Error('OpenRouter: all free models failed');
  }
}

module.exports = new AIProviderManager();
