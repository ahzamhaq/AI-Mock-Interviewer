// Conversation Style service — the "human polish" layer over the adaptive engine.
//
// The engine decides WHAT to ask next (follow-up, pivot, revisit, etc.).
// This module decides HOW to phrase the transition into that question so the
// interview sounds like one continuous conversation instead of disconnected prompts.
//
// Design principle: keep this LIGHTWEIGHT. We use small in-memory pools of variations
// for stock pieces (reactions, transitions), and only spend an LLM call when the
// transition genuinely needs to reference a previous answer.

// ── Intent vocabulary ────────────────────────────────────────────────────────
// Hidden interviewer intent. Drives the AI prompt and the engine's next-step
// reasoning. Each question gets exactly one intent at generation time.
const INTENTS = {
  CONCEPTUAL:        'test conceptual understanding',
  IMPLEMENTATION:    'test practical implementation',
  DEBUGGING:         'test debugging depth',
  TRADEOFFS:         'test tradeoff reasoning',
  SCALABILITY:       'test scalability thinking',
  OPTIMIZATION:      'test optimization thinking',
  EDGE_CASES:        'test edge-case awareness',
  REAL_EXAMPLE:      'test real-world experience',
  ARCHITECTURE:      'test architecture decisions',
  FAILURE_SCENARIOS: 'test failure-mode reasoning',
  CLARIFICATION:     'clarify previous answer',
  STAR_BEHAVIORAL:   'elicit STAR-format story',
};

// ── Pick intent based on engine decision + live state ────────────────────────
function pickIntent(decision, liveState, questionType) {
  const score = liveState?.lastScore || 0;
  const hi = liveState?.consecutiveHighScores || 0;
  const lo = liveState?.consecutiveLowScores || 0;

  // Behavioral / HR
  if (questionType === 'behavioral' || questionType === 'hr') {
    return INTENTS.STAR_BEHAVIORAL;
  }

  // System design — depends on experience signal (strong → architecture/scale, else → conceptual)
  if (questionType === 'system_design') {
    return hi >= 1 ? INTENTS.ARCHITECTURE : INTENTS.CONCEPTUAL;
  }

  // Action-driven intent
  if (decision.action === 'follow_up') {
    // Strong candidate → push toward tradeoffs / scalability / edge cases
    if (hi >= 1 || score >= 8) {
      const advancedPool = [INTENTS.TRADEOFFS, INTENTS.SCALABILITY, INTENTS.EDGE_CASES, INTENTS.OPTIMIZATION, INTENTS.FAILURE_SCENARIOS];
      return advancedPool[Math.floor(Math.random() * advancedPool.length)];
    }
    // Middle ground → implementation depth
    if (score >= 6) return INTENTS.IMPLEMENTATION;
    // Weak — clarify (rare; usually the engine pivots instead of following up after weak)
    return INTENTS.CLARIFICATION;
  }

  if (decision.action === 'memorized_probe') {
    // Pick whichever is most "show me you actually did this" oriented
    return Math.random() < 0.5 ? INTENTS.REAL_EXAMPLE : INTENTS.IMPLEMENTATION;
  }

  if (decision.action === 'revisit_weak') {
    // Simplify — conceptual reinforcement
    return INTENTS.CONCEPTUAL;
  }

  // Pivot — fresh primary question
  // Vary intent over time to keep things interesting
  const pivotPool = lo >= 1
    ? [INTENTS.CONCEPTUAL, INTENTS.IMPLEMENTATION] // simpler if user is struggling
    : [INTENTS.CONCEPTUAL, INTENTS.IMPLEMENTATION, INTENTS.DEBUGGING, INTENTS.REAL_EXAMPLE];
  return pivotPool[Math.floor(Math.random() * pivotPool.length)];
}

// ── Reactions (subtle, infrequent, personality-aware) ────────────────────────
// Each reaction style has its own pool of variants. The personality registry
// determines which style to draw from. The default pool ("neutral") is used
// when a personality doesn't specify or when no personality is set.
//
// ~30% of the time we emit NO reaction at all (silence is fine).
const REACTIONS_BY_STYLE = {
  // Default — balanced, professional
  neutral: {
    strong: ["Solid reasoning.", "That's a fair tradeoff.", "Interesting take.", "Good — I follow the logic.", "Reasonable approach."],
    medium: ["Okay.", "I see your reasoning.", "Mm-hm.", "Right.", "Fair enough."],
    weak:   ["Hm, let's explore this from a different angle.", "Okay, let's step back a bit.", "Let me reframe that."],
    memorized: ["Got it — though that sounds fairly textbook.", "Right, that's the standard definition."],
    rambling:  ["Let me narrow that down.", "Let's focus in."],
    tooShort:  ["Can you give me a bit more on that?", "I'd like a little more detail there."],
  },

  // Friendly mentor — warm, encouraging
  encouraging: {
    strong: ["Nice work — that's a strong approach.", "Great reasoning.", "I really like how you framed that.", "Excellent — that shows real understanding."],
    medium: ["Good, that makes sense.", "Okay, I follow you.", "That's a fair start.", "Right, you're on the right track."],
    weak:   ["No worries, let's think through this together.", "Let's slow down and try a simpler angle.", "Hmm, let's break this down differently."],
    memorized: ["Right — that's the textbook view. Let's make it concrete.", "Good definition. Now let's see how it applies."],
    rambling:  ["Lots of good thoughts — let's focus in.", "That's helpful, let me zoom in."],
    tooShort:  ["Tell me a bit more about that.", "Can you walk me through your thinking?"],
  },

  // Strict / analytical — minimal, neutral, sometimes critical
  minimal: {
    strong: ["Right.", "Okay.", "Mm."],
    medium: ["Okay.", "Mm.", "Continue."],
    weak:   ["That's not quite right.", "Let me push back on that.", "I don't think that's complete."],
    memorized: ["That's textbook. Tell me what you actually did.", "Standard answer. Get specific."],
    rambling:  ["Be specific.", "Narrow it down.", "Get to the point."],
    tooShort:  ["More detail.", "Expand on that."],
  },

  // Analytical — probing, dissecting
  probing: {
    strong: ["Interesting. Why?", "Right — but why that choice?", "Okay. Let me push on the reasoning."],
    medium: ["Walk me through the reasoning.", "What's the basis for that?", "Okay — and why?"],
    weak:   ["Let's examine the assumption there.", "I don't follow — explain the link.", "That doesn't quite hold together."],
    memorized: ["That's the standard answer. What did YOU observe?", "Textbook. Make it concrete."],
    rambling:  ["Cut to the core claim.", "What's the one-line version?"],
    tooShort:  ["Give me your reasoning.", "Expand the chain."],
  },

  // Curious — startup/product style
  curious: {
    strong: ["Nice — I like that.", "Okay, that's interesting.", "Cool — what made you go that route?", "Smart."],
    medium: ["Okay, tell me more.", "Mm, go on.", "Interesting — keep going."],
    weak:   ["Hmm, let's try a different angle.", "Let me reframe."],
    memorized: ["Sure — but in your own project, how did it play out?", "Textbook answer. What did you actually do?"],
    rambling:  ["Let me narrow in on one thing.", "Focus me on the key decision."],
    tooShort:  ["Tell me more.", "Walk me through it."],
  },

  // Attentive — HR / behavioral
  attentive: {
    strong: ["That's a great example.", "I appreciate the specificity.", "Thanks for sharing that."],
    medium: ["Okay, I hear you.", "Got it.", "Right."],
    weak:   ["Let me reframe the question.", "Let's try a different scenario."],
    memorized: ["I'd love a real example here.", "Can you ground that in something that actually happened?"],
    rambling:  ["Let me focus the question.", "Let's narrow this down."],
    tooShort:  ["Tell me a bit more.", "Can you walk me through what happened?"],
  },

  // Analytical (management) — balanced
  analytical: {
    strong: ["Solid take.", "That tracks.", "Good reasoning."],
    medium: ["Okay, I follow.", "Right.", "Mm-hm."],
    weak:   ["Let me push back gently.", "I don't think that's the full picture."],
    memorized: ["That's the standard answer — go a level deeper.", "Textbook. What's your version?"],
    rambling:  ["Let me focus this.", "Pull it together for me."],
    tooShort:  ["A bit more, please.", "Develop the thought."],
  },

  // Thoughtful — calm conversational
  thoughtful: {
    strong: ["That's a nice way to put it.", "Mm — that's well reasoned."],
    medium: ["Okay.", "Right.", "I see what you mean."],
    weak:   ["Let me think about that with you.", "Hmm — let's try a different angle."],
    memorized: ["Right, that's the standard view. Now make it concrete."],
    rambling:  ["Let me bring us back to the core.", "Let's focus."],
    tooShort:  ["A bit more there?", "Can you say more?"],
  },
};

const NO_REACTION_PROBABILITY_BY_STYLE = {
  encouraging: 0.20,  // mentor reacts more
  minimal:     0.55,  // strict reacts less
  probing:     0.30,
  curious:     0.25,
  attentive:   0.20,  // HR reacts more
  analytical:  0.35,
  thoughtful:  0.30,
  neutral:     0.35,
};

function pickReaction({ score, isMemorized, length, isFollowUp, reactionStyle = 'neutral' }) {
  const pool = REACTIONS_BY_STYLE[reactionStyle] || REACTIONS_BY_STYLE.neutral;
  const noReactProb = NO_REACTION_PROBABILITY_BY_STYLE[reactionStyle] ?? 0.35;

  if (Math.random() < noReactProb) return '';

  // Length signals win first (they're the loudest cue)
  if (length === 'too_long') return rand(pool.rambling);
  if (length === 'too_short') return rand(pool.tooShort);

  if (isMemorized) return rand(pool.memorized);

  if (score >= 8)  return rand(pool.strong);
  if (score >= 5)  return rand(pool.medium);
  if (score >  0)  return rand(pool.weak);
  return '';
}

// ── Transitions (personality-aware) ──────────────────────────────────────────
// Each transition style has its own variants. Personalities map to styles via
// `transitionStyle`. Action-specific pools (follow_up, pivot, callback,
// revisit_weak, memorized_probe, recovery) are nested under each style.
const TRANSITIONS_BY_STYLE = {
  // Default
  neutral: {
    follow_up: ["Let's dig into that.", "Let me push on that a bit.", "I want to go deeper here.", "Stay with me on this.", "One more on this —"],
    pivot: ["Let's switch gears.", "Moving on —", "Different area now.", "Let's shift to something else.", "Okay, next thing."],
    pivot_with_topic: ["Let's switch to {topic}.", "Moving on to {topic} —", "I want to talk about {topic} now.", "Let's shift gears — {topic}."],
    callback: ["Earlier you mentioned {callback} —", "You touched on {callback} before; that connects here.", "Coming back to {callback} for a moment.", "Speaking of {callback} —"],
    revisit_weak: ["Let's come back to {topic} with a different angle.", "I want to revisit {topic} — try this one.", "Let's give {topic} another pass."],
    memorized_probe: ["Let me make this concrete.", "Let's get specific.", "Talk to me as if I'm reviewing your PR.", "Walk me through what you actually did."],
    recovery: ["No worries, let's try something more approachable.", "Let's reset.", "Different angle."],
    project_deepdive: ["Let's dig into that project a bit more.", "I want to understand that project better.", "Tell me more about how that worked."],
  },

  // Soft — friendly mentor
  soft: {
    follow_up: ["Let's go a little deeper here.", "Help me understand more about that.", "Stay with this for a moment —"],
    pivot: ["Okay, let's try something new.", "Let's move to a different area.", "Let's explore something else."],
    pivot_with_topic: ["Let's shift to {topic} — should be fun.", "How about we talk about {topic}?", "Let's try {topic} next."],
    callback: ["You mentioned {callback} earlier — that connects nicely.", "Coming back to {callback} for a moment.", "Earlier you brought up {callback} —"],
    revisit_weak: ["Let's gently come back to {topic}.", "I want to give {topic} another try with you."],
    memorized_probe: ["Let's make this real — your own experience.", "Tell me about your actual project here."],
    recovery: ["No problem, let's try a friendlier one.", "Let's reset and try this together.", "Don't worry, easier one coming."],
    project_deepdive: ["That project sounds interesting — let's explore it.", "Tell me more about how you built that."],
  },

  // Crisp — strict / analytical
  crisp: {
    follow_up: ["Go deeper.", "Push further.", "One more on this:"],
    pivot: ["Next.", "Moving on.", "Different topic."],
    pivot_with_topic: ["Next: {topic}.", "Moving to {topic}.", "{topic}."],
    callback: ["Earlier you said {callback} —", "On {callback}:"],
    revisit_weak: ["Back to {topic}.", "Try {topic} again."],
    memorized_probe: ["Be concrete.", "Specifics, please.", "What did YOU do?"],
    recovery: ["Different angle.", "Reset."],
    project_deepdive: ["About that project —", "On that project:"],
  },

  // Logical — analytical interviewer
  logical: {
    follow_up: ["Let's examine that more closely.", "Trace that reasoning a step further.", "Push the logic further:"],
    pivot: ["Let's analyze a different area.", "Shifting topics.", "Moving to another concept."],
    pivot_with_topic: ["Now consider {topic}.", "Let's analyze {topic}.", "Onto {topic} —"],
    callback: ["You posited {callback} earlier — relevant here.", "Recall your point about {callback}:"],
    revisit_weak: ["Let's revisit {topic} from a different angle.", "Back to {topic} with new framing:"],
    memorized_probe: ["Let's ground this in your actual experience.", "Concrete example, please."],
    recovery: ["Let's step back.", "Reset the framing."],
    project_deepdive: ["Let's analyze that project.", "Examining that project more closely —"],
  },

  // Practical — startup CTO
  practical: {
    follow_up: ["Let's get practical.", "What did this look like in practice?", "Real talk on this:"],
    pivot: ["Different topic.", "Let's switch.", "Moving on."],
    pivot_with_topic: ["Let's talk {topic}.", "Onto {topic} —", "Now {topic}."],
    callback: ["Earlier you mentioned {callback} — let's tie that in.", "On {callback} — quick question."],
    revisit_weak: ["Quick revisit on {topic}.", "Back to {topic} — different angle."],
    memorized_probe: ["Real example, please.", "What did you actually ship?", "What broke in production?"],
    recovery: ["Let's try something more practical.", "Different angle, real-world."],
    project_deepdive: ["Tell me about that project — production reality.", "Let's go inside that project."],
  },

  // Connective — engineering manager
  connective: {
    follow_up: ["That connects to something I want to explore.", "Let's stay with this.", "I want to understand more here."],
    pivot: ["Let's move to a related area.", "Connecting that to —", "On a related note —"],
    pivot_with_topic: ["That brings me to {topic}.", "Let's connect this to {topic}.", "Onto {topic} —"],
    callback: ["Tying back to {callback} you mentioned —", "That connects to {callback} earlier."],
    revisit_weak: ["Let's revisit {topic} — relevant here.", "Coming back to {topic}."],
    memorized_probe: ["Let's ground this in something concrete.", "From your own experience —"],
    recovery: ["Let's try a different angle.", "Easier framing —"],
    project_deepdive: ["About that project — let's go deeper.", "I want to understand the engineering behind it."],
  },

  // Reflective — HR
  reflective: {
    follow_up: ["Let me follow up on that.", "I want to understand more about your experience there.", "Can you say more?"],
    pivot: ["Let's move to something different.", "Different area for me —", "Switching topics —"],
    pivot_with_topic: ["I want to ask about {topic}.", "Onto {topic} —"],
    callback: ["You mentioned {callback} earlier — let me come back to that.", "Earlier you spoke about {callback} —"],
    revisit_weak: ["Let me come back to {topic}.", "Different angle on {topic} —"],
    memorized_probe: ["Can you give me a real example?", "Something specific you experienced —"],
    recovery: ["Let me try a different question.", "Different angle —"],
    project_deepdive: ["Tell me about that experience.", "Let's reflect on that project."],
  },

  // Flowing — calm conversational
  flowing: {
    follow_up: ["Let me sit with that for a moment.", "Following that thread —", "Building on that —"],
    pivot: ["Let me shift us slightly.", "Naturally moving to —", "On a different note —"],
    pivot_with_topic: ["That brings us to {topic}.", "Naturally — {topic}.", "Speaking of {topic}:"],
    callback: ["Coming back to {callback} you raised —", "That ties to {callback} earlier."],
    revisit_weak: ["Circling back to {topic} —", "Returning to {topic} —"],
    memorized_probe: ["Make this concrete for me.", "Your own example here —"],
    recovery: ["Let's try a different shape.", "Easier framing —"],
    project_deepdive: ["Let's spend time on that project.", "I'd like to wander into that project."],
  },

  // User-centric — product focused
  'user-centric': {
    follow_up: ["What does this look like for the user?", "Push that further:", "Stay with this —"],
    pivot: ["Different angle —", "Shifting topics —", "On to —"],
    pivot_with_topic: ["Let's talk {topic} from a product lens.", "Onto {topic} —"],
    callback: ["Earlier you mentioned {callback} — connects here.", "Coming back to {callback} —"],
    revisit_weak: ["Let's revisit {topic} from a user angle.", "Back to {topic} —"],
    memorized_probe: ["What did this mean for users?", "Concrete impact, please."],
    recovery: ["Different framing —", "Let's reset."],
    project_deepdive: ["Tell me about that project's user impact.", "Walk me through that project."],
  },
};

const NO_TRANSITION_PROBABILITY = 0.15;

function pickTransition({ action, topic, callback, score, consecutiveLowScores, transitionStyle = 'neutral', isProjectDeepDive = false }) {
  const pool = TRANSITIONS_BY_STYLE[transitionStyle] || TRANSITIONS_BY_STYLE.neutral;

  // Recovery mode — user is struggling, soften the lead-in
  if (consecutiveLowScores >= 2 && Math.random() < 0.5) {
    return rand(pool.recovery || TRANSITIONS_BY_STYLE.neutral.recovery);
  }

  if (Math.random() < NO_TRANSITION_PROBABILITY) return '';

  // Project deep-dive transitions take precedence when we're inside a deep-dive
  if (isProjectDeepDive && action === 'follow_up') {
    return rand(pool.project_deepdive || TRANSITIONS_BY_STYLE.neutral.project_deepdive);
  }

  // Callback transitions are universal but personality-flavored
  if (callback && Math.random() < 0.45) {
    return rand(pool.callback || TRANSITIONS_BY_STYLE.neutral.callback).replace('{callback}', callback);
  }

  if (action === 'follow_up')       return rand(pool.follow_up || TRANSITIONS_BY_STYLE.neutral.follow_up);
  if (action === 'memorized_probe') return rand(pool.memorized_probe || TRANSITIONS_BY_STYLE.neutral.memorized_probe);
  if (action === 'revisit_weak')    return rand(pool.revisit_weak || TRANSITIONS_BY_STYLE.neutral.revisit_weak).replace('{topic}', topic || 'that topic');

  if (topic && Math.random() < 0.4) {
    const tpl = pool.pivot_with_topic || TRANSITIONS_BY_STYLE.neutral.pivot_with_topic;
    return rand(tpl).replace('{topic}', topic);
  }
  return rand(pool.pivot || TRANSITIONS_BY_STYLE.neutral.pivot);
}

// ── Answer-length classification ─────────────────────────────────────────────
// Cheap word-count heuristic. The engine consults this to decide if it should
// inject a redirect or ask for elaboration.
function classifyLength(answer, questionType = 'technical') {
  if (!answer) return 'empty';
  const words = answer.trim().split(/\s+/).length;
  // Behavioral answers are expected to be longer (STAR stories)
  if (questionType === 'behavioral' || questionType === 'hr') {
    if (words < 20)  return 'too_short';
    if (words > 250) return 'too_long';
    return 'normal';
  }
  if (words < 12)  return 'too_short';
  if (words > 200) return 'too_long';
  return 'normal';
}

// ── Callback extraction ──────────────────────────────────────────────────────
// Pull a short noun-phrase from a recent answer to use as a callback hook.
// Lightweight (no LLM call) — looks for capitalized technical terms or quoted/
// distinctive phrases. Returns null if nothing obvious surfaces.
function extractCallback(interview) {
  // Look at the last 2–4 answered primary questions
  const candidates = interview.questions
    .filter(q => !q.skipped && q.userAnswer && q.userAnswer.length > 30)
    .slice(-4);

  if (candidates.length < 1) return null;

  // Prefer something from 2-3 questions back, not the immediately previous one
  // (which the new question is already responding to).
  const pool = candidates.slice(0, -1);
  if (!pool.length) return null;

  for (const q of pool.reverse()) {
    const term = extractTechnicalTerm(q.userAnswer);
    if (term) return term;
  }
  return null;
}

// Find a notable technical term in an answer. Heuristic — looks for:
//   1. CamelCase / PascalCase identifiers (likely tech names)
//   2. ALL-CAPS acronyms
//   3. Multi-word capitalized phrases
function extractTechnicalTerm(text) {
  if (!text) return null;
  // PascalCase / camelCase
  const camel = text.match(/\b([A-Z][a-z]+[A-Z][A-Za-z0-9]*|[a-z]+[A-Z][A-Za-z0-9]+)\b/g);
  if (camel) {
    // Prefer the longer one — usually more specific
    const sorted = camel.sort((a, b) => b.length - a.length);
    return sorted[0];
  }
  // Acronyms 2-6 chars
  const acronym = text.match(/\b([A-Z]{2,6})\b/g);
  if (acronym) {
    // Filter out common short words that happen to be uppercase in some contexts
    const filtered = acronym.filter(a => !['I', 'OK', 'NO', 'YES'].includes(a));
    if (filtered.length) return filtered[0];
  }
  // Two-word title-cased
  const twoWord = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  if (twoWord) return twoWord[1];
  return null;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  INTENTS,
  pickIntent,
  pickReaction,
  pickTransition,
  classifyLength,
  extractCallback,
  // exposed for testing
  _internals: { extractTechnicalTerm, rand },
};
