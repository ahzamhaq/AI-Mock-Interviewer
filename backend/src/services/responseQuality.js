// Response Quality Detection — fast heuristic signals about WHAT KIND of answer
// the candidate gave, beyond just a score.
//
// These flags feed the adaptive engine so it can tailor the next question:
//   vague + shallow      → request implementation depth
//   buzzwordy            → ask for concrete example
//   overconfident        → introduce an edge case
//   rambling             → narrow the next question
//   uncertain/hedged     → either nudge or simplify
//   contradiction        → ask candidate to reconcile
//   generic              → probe for personal experience
//
// All detection is heuristic — no LLM calls here. Combined with the existing
// memorization detection (ai.service / adaptiveEngine.isMemorizedSignal), this
// gives the engine a rich quality picture per answer.

const BUZZWORDS = new Set([
  'synergy', 'leverage', 'leveraged', 'leveraging',
  'best practice', 'best practices', 'industry standard',
  'cutting edge', 'next-gen', 'state-of-the-art',
  'paradigm', 'scalable solution', 'mission critical',
  'robust', 'seamless', 'innovative',
  'ecosystem',
]);

const UNCERTAINTY_PHRASES = [
  /\bi\s+(?:think|guess|believe|suppose)\b/gi,
  /\bmaybe\b/gi,
  /\bi'?m\s+not\s+(?:sure|certain|positive)\b/gi,
  /\bnot\s+entirely\s+sure\b/gi,
  /\bsort\s+of\b/gi,
  /\bkind\s+of\b/gi,
  /\bprobably\b/gi,
];

const OVERCONFIDENCE_PHRASES = [
  /\balways\b/gi, /\bnever\b/gi, /\bobviously\b/gi, /\bclearly\b/gi,
  /\beveryone\s+knows\b/gi, /\bof\s+course\b/gi, /\bdefinitely\b/gi,
  /\babsolutely\b/gi, /\bthere's\s+no\s+question\b/gi,
];

const SPECIFIC_INDICATORS = [
  /\bfor\s+example\b/gi, /\bin\s+practice\b/gi, /\bin\s+production\b/gi,
  /\bI\s+(?:built|used|wrote|deployed|implemented|shipped|debugged)\b/g,
  /\bwhen\s+I\b/gi, /\bin\s+my\s+(?:project|case|experience)\b/gi,
  /\bversion\s+\d/gi, /\b\d+\s*(?:ms|seconds?|minutes?|hours?|requests?|users?)\b/gi,
];

// Simple contradiction signal: candidate uses "but" + a strong reverse claim
// after making an initial claim. Cheap regex — false positives are OK because
// the engine will just probe instead of being adversarial.
const CONTRADICTION_PATTERN = /\b(?:but|however|actually|on\s+second\s+thought|wait)\b/gi;

// ── Counters ────────────────────────────────────────────────────────────────
function countMatches(text, patterns) {
  let n = 0;
  for (const re of patterns) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function countBuzzwords(text) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const word of BUZZWORDS) {
    // Word-boundary-ish check
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g');
    const m = lower.match(re);
    if (m) n += m.length;
  }
  return n;
}

// ── Main detector — returns flags + a single "quality" summary string ──────
function detect(answerText, options = {}) {
  if (!answerText || answerText.trim().length < 20) {
    return {
      flags: ['too_short'],
      primaryFlag: 'too_short',
      wordCount: (answerText || '').trim().split(/\s+/).filter(Boolean).length,
    };
  }

  const text = answerText.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;

  const buzzCount = countBuzzwords(text);
  const uncertaintyCount = countMatches(text, UNCERTAINTY_PHRASES);
  const overconfidenceCount = countMatches(text, OVERCONFIDENCE_PHRASES);
  const specificCount = countMatches(text, SPECIFIC_INDICATORS);
  const contradictionCount = (text.match(CONTRADICTION_PATTERN) || []).length;

  const flags = [];

  // Rambling — long answer + low specificity ratio
  if (wc > 220 && specificCount / Math.max(wc, 1) < 0.01) flags.push('rambling');

  // Vague — moderate length but very few concrete indicators
  if (wc >= 15 && wc <= 220 && specificCount === 0 && buzzCount <= 1) flags.push('vague');

  // Buzzwordy — at least one buzzword without specificity
  if (buzzCount >= 1 && specificCount === 0) flags.push('buzzwordy');

  // Generic — moderately long but no first-person specifics or concrete numbers
  if (wc >= 40 && specificCount === 0) flags.push('generic');

  // Uncertain / hedged
  if (uncertaintyCount >= 3) flags.push('hedged');

  // Overconfident — multiple absolute claims and few hedges, low specificity
  if (overconfidenceCount >= 2 && uncertaintyCount === 0 && specificCount <= 1) flags.push('overconfident');

  // Contradiction — uses pivot words mid-answer
  if (contradictionCount >= 2) flags.push('contradicted_self');

  // Strong — first-person specific examples
  if (specificCount >= 2) flags.push('specific');

  // Primary flag — the one most likely to drive the engine's response.
  // Priority order: rambling > overconfident > contradicted_self > buzzwordy > vague > generic > hedged > specific
  const priority = ['rambling', 'overconfident', 'contradicted_self', 'buzzwordy', 'vague', 'generic', 'hedged', 'specific'];
  const primaryFlag = priority.find(f => flags.includes(f)) || null;

  return {
    flags,
    primaryFlag,
    wordCount: wc,
    buzzCount,
    uncertaintyCount,
    overconfidenceCount,
    specificCount,
    contradictionCount,
  };
}

// ── Suggested follow-up intent given a primary flag ─────────────────────────
// Used by the adaptive engine to bias intent selection on the next question.
const FLAG_TO_INTENT = {
  rambling:         'narrow_focus',
  overconfident:    'introduce_edge_case',
  contradicted_self:'reconcile',
  buzzwordy:        'concrete_example',
  vague:            'implementation_detail',
  generic:          'real_example',
  hedged:           'clarify_or_support',
  specific:         null, // no special probe; reward with depth/tradeoffs
  too_short:        'invite_elaboration',
};

function intentForFlag(flag) {
  return FLAG_TO_INTENT[flag] || null;
}

module.exports = { detect, intentForFlag, FLAG_TO_INTENT };
