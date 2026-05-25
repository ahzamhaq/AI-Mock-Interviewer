// Silence / Thinking Handler — decides how the interviewer should react when the
// candidate goes quiet or stalls.
//
// The frontend tracks silence duration locally (typing pause or no-speech timer)
// and calls a backend nudge endpoint when a threshold is crossed. This service
// produces:
//   {
//     nudgeType: 'silent' | 'encourage' | 'rephrase' | 'narrow' | 'hint' | 'simplify',
//     phrase:    string,     // optional spoken/displayed text
//     spoken:    boolean,    // should TTS speak this
//     escalate:  boolean,    // tells the frontend to schedule another check
//   }
//
// Design:
//   - Reactions are template-pool based (no LLM call → fast, predictable).
//   - The current question is NOT regenerated; we only nudge.
//   - Strict personalities + intense pressure tolerate longer silence, give fewer hints.
//   - Friendly personalities + relaxed pressure nudge sooner and warmer.

const personalities = require('./personalities');

// Thresholds in seconds. Different personalities cross them at different rates,
// controlled by `silenceTolerance` (computed below).
const NUDGE_TIERS = [
  { afterMs: 6000,  type: 'silent'     },  // small pause; almost always do nothing
  { afterMs: 14000, type: 'encourage'  },  // warm nudge
  { afterMs: 25000, type: 'rephrase'   },  // re-frame
  { afterMs: 40000, type: 'narrow'     },  // narrow scope
  { afterMs: 60000, type: 'hint'       },  // small hint
  { afterMs: 85000, type: 'simplify'   },  // simplify entirely
];

// Personality-aware tolerance multiplier (>1 = more patient, <1 = faster nudges).
function silenceTolerance(personalityId) {
  const p = personalities.get(personalityId);
  // strict/analytical: very patient with silence (low encouragement, high probing tolerance)
  // friendly/HR:       nudge sooner (high encouragement)
  // Map: lower encouragement => longer tolerance.
  const enc = p.encouragement ?? 0.5;
  // 1.4 at enc=0.15 (strict) → 0.6 at enc=0.85 (mentor)
  return Math.max(0.5, Math.min(1.8, 1.6 - enc));
}

// Pressure shifts tolerance further.
const PRESSURE_MULT = { relaxed: 1.25, standard: 1.0, intense: 0.7 };

// Nudge phrase pools — keyed by personality reactionStyle (with neutral fallback).
const PHRASES = {
  neutral: {
    encourage: ["Take your time.", "Think out loud.", "Whenever you're ready."],
    rephrase:  ["Let me rephrase that.", "Different angle: ", "Let me put it another way."],
    narrow:    ["Focus specifically on one part.", "Just the core decision is enough.", "Let's narrow this — just the first step."],
    hint:      ["A small hint: think about the data flow first.", "Start from inputs and outputs.", "Hint: where would the bottleneck appear?"],
    simplify:  ["Let's try a simpler version.", "Forget edge cases — just the basic case.", "Walk me through any approach, even rough."],
  },
  encouraging: {
    encourage: ["No worries, take your time.", "Think out loud — whatever comes to mind.", "You're doing fine, take a moment."],
    rephrase:  ["Let me rephrase that for clarity.", "Let me ask it differently.", "Maybe this angle helps:"],
    narrow:    ["Let's narrow it down — focus on just one part.", "Forget the rest, just one step is enough.", "Try the core scenario first."],
    hint:      ["Small nudge: think about the data flow.", "Here's a hint — what changes between requests?", "Try starting from the basic input."],
    simplify:  ["Let's try a much simpler version of this.", "No pressure — rough approach is fine.", "Even pseudocode works."],
  },
  minimal: {
    encourage: ["Take your time."],
    rephrase:  ["Rephrasing:", "Different angle:"],
    narrow:    ["Just the core decision.", "Focus narrower."],
    hint:      ["", ""], // strict interviewer rarely hints
    simplify:  ["Simpler version then.", "Basic case only."],
  },
  probing: {
    encourage: ["What's your first instinct?", "Start anywhere — I'll follow."],
    rephrase:  ["Let me reframe.", "Try this angle:"],
    narrow:    ["Just the bottleneck.", "Focus on one constraint."],
    hint:      ["Consider the worst case first.", "Where does it break?"],
    simplify:  ["Drop the constraints. Bare problem only.", "Forget optimization — just brute force."],
  },
  curious: {
    encourage: ["Just say what comes to mind.", "Whatever your gut says.", "Take your time — I'm interested."],
    rephrase:  ["Let me rephrase.", "Different framing:"],
    narrow:    ["Just one piece.", "Smallest scenario only."],
    hint:      ["Think about what ships first.", "What's the MVP version?"],
    simplify:  ["Just the rough idea.", "Even hand-wavy works."],
  },
  attentive: {
    encourage: ["Take a moment.", "Whenever you're ready.", "No rush."],
    rephrase:  ["Let me rephrase.", "Let me ask it another way."],
    narrow:    ["Just one example is fine.", "Focus on one situation."],
    hint:      ["Think about a recent project.", "When did this last happen for you?"],
    simplify:  ["Just describe any time it came up.", "A small example is fine."],
  },
  analytical: {
    encourage: ["Walk me through your thinking.", "Out loud — let me follow your reasoning."],
    rephrase:  ["Let me restate.", "Reframing:"],
    narrow:    ["Just one constraint.", "Focus on the bottleneck."],
    hint:      ["Consider the load profile.", "Start from where the system would fail."],
    simplify:  ["Strip the constraints. Bare version.", "Just the simplest case."],
  },
  thoughtful: {
    encourage: ["Take your time.", "Think out loud whenever you're ready."],
    rephrase:  ["Let me put it differently.", "Different framing:"],
    narrow:    ["Just the core decision.", "Focus on one piece."],
    hint:      ["A nudge: think about the data path.", "Start from the user input."],
    simplify:  ["Let's try a simpler version.", "Forget the edge cases for now."],
  },
};

function pickPhrase(nudgeType, reactionStyle) {
  const pool = PHRASES[reactionStyle] || PHRASES.neutral;
  const arr = pool[nudgeType] || PHRASES.neutral[nudgeType] || [];
  if (!arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Public: decide nudge given silence duration ──────────────────────────────
// `silenceMs` = how long the candidate has been silent/idle.
// `liveState` = the interview's live state.
// `personalityId`, `pressure` from the interview document.
// `prevNudges` = list of nudge types already issued this question (so we escalate).
function decideNudge({ silenceMs, liveState = {}, personalityId, pressure = 'standard', prevNudges = [] }) {
  const tolerance = silenceTolerance(personalityId) * (PRESSURE_MULT[pressure] || 1);
  const adjusted = silenceMs / tolerance;

  // Find the deepest tier we've passed
  let tier = null;
  for (const t of NUDGE_TIERS) {
    if (adjusted >= t.afterMs) tier = t;
  }
  if (!tier) {
    return { nudgeType: null, phrase: '', spoken: false, escalate: true };
  }

  // If this exact nudgeType has already been issued for this question,
  // escalate to the next tier so we don't repeat the same line.
  let chosenType = tier.type;
  if (prevNudges.includes(chosenType)) {
    const idx = NUDGE_TIERS.findIndex(t => t.type === chosenType);
    const next = NUDGE_TIERS[Math.min(idx + 1, NUDGE_TIERS.length - 1)];
    chosenType = next.type;
  }

  // 'silent' tier: deliberately do nothing audible. The frontend may show a
  // visual indicator but the interviewer stays quiet.
  if (chosenType === 'silent') {
    return { nudgeType: 'silent', phrase: '', spoken: false, escalate: true };
  }

  // Strict interviewers may still skip 'hint' entirely
  const p = personalities.get(personalityId);
  if (chosenType === 'hint' && p.encouragement < 0.25) {
    // Skip directly to simplify or stay silent
    chosenType = 'simplify';
  }

  // Recovery boost — if the candidate has been struggling, soften aggressively
  if ((liveState.consecutiveLowScores || 0) >= 2 && chosenType === 'hint') {
    // already a soft nudge, keep it
  }

  const phrase = pickPhrase(chosenType, p.reactionStyle);
  // 'simplify' is the only nudge that actually changes the question; the others
  // are conversational nudges. The frontend can decide whether to call
  // /next-question with a simplification request.
  return {
    nudgeType: chosenType,
    phrase,
    spoken: !!phrase,
    escalate: chosenType !== 'simplify',
  };
}

module.exports = {
  decideNudge,
  NUDGE_TIERS,
  // exposed for testing
  _internals: { silenceTolerance, pickPhrase },
};
