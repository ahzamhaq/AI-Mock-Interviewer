// Blueprint service — plans an interview before it starts.
//
// Given the user's config + memory, produce:
//   - mode (breadth | balanced | depth) based on total question count
//   - planned topic coverage (biased toward weak areas if memory exists)
//   - type mix (technical vs behavioral vs system design vs hr)
//   - interviewer personality (registry-based, drives many downstream traits)
//   - interviewer persona compatibility shim (style/tone/rigor)
//
// The blueprint is a *guideline*. The adaptive engine consults it but is free to
// deviate (revisit a weak topic, ask a follow-up instead of moving on, etc).

const topicGraph = require('./topicGraph');
const personalities = require('./personalities');
const roundProfiles = require('./roundProfiles');

const ROLE_MAP = {
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  fullstack_developer: 'Full Stack Developer',
  sde: 'Software Development Engineer',
  data_analyst: 'Data Analyst',
  hr: 'HR Manager',
  other: 'Engineer',
};

// Decide mode based on question count + user-supplied length intent.
function pickMode(totalQuestions, lengthIntent) {
  if (lengthIntent === 'breadth' || totalQuestions <= 4) return 'breadth';
  if (lengthIntent === 'depth' || totalQuestions >= 10) return 'depth';
  return 'balanced';
}

// Derive the interviewer personality + persona from config.
// Personality is picked from the registry (see personalities.js).
// Persona is the legacy shape (style/tone/rigor) kept for backwards compatibility
// with any code that still reads it directly.
function derivePersona(config, explicitPersonalityId) {
  const personalityId = personalities.pickPersonalityId(config, explicitPersonalityId);
  const p = personalities.get(personalityId);
  return {
    personalityId,
    // Legacy persona fields for downstream compatibility
    style: p.style,
    tone: p.tone,
    rigor: p.rigor,
  };
}

// Plan the type mix for the interview.
function planTypeMix(interviewType, totalQuestions, experienceLevel) {
  const N = totalQuestions;
  if (interviewType === 'technical') {
    return { technical: N };
  }
  if (interviewType === 'hr') {
    return { hr: N };
  }
  if (interviewType === 'behavioral') {
    return { behavioral: N };
  }
  if (interviewType === 'system_design') {
    // For seniors, mostly design; for freshers, mix in some technical
    return experienceLevel === 'fresher'
      ? { system_design: Math.max(1, N - 2), technical: 2 }
      : { system_design: N };
  }
  // mixed → distribute
  if (experienceLevel === '3+_years') {
    return {
      technical: Math.max(1, Math.floor(N * 0.5)),
      system_design: Math.max(1, Math.floor(N * 0.3)),
      behavioral: Math.max(1, N - Math.floor(N * 0.5) - Math.floor(N * 0.3)),
    };
  }
  return {
    technical: Math.max(1, Math.floor(N * 0.6)),
    behavioral: Math.max(1, Math.ceil(N * 0.3)),
    system_design: Math.max(0, N - Math.floor(N * 0.6) - Math.ceil(N * 0.3)),
  };
}

// Plan topic coverage. Bias toward weak topics from prior sessions, then fill the
// rest from the role's topic graph. Avoid topics already over-asked recently.
function planTopics(role, totalQuestions, weakTopics = [], recentTopics = []) {
  const allTopics = topicGraph.topicsForRole(role);
  const weakSet = new Set(weakTopics.map(t => (t || '').toLowerCase()));
  const recentSet = new Set(recentTopics.map(t => (t || '').toLowerCase()));

  // Bucket 1: weak topics from memory (up to 40% of interview)
  const weakSlots = Math.min(Math.ceil(totalQuestions * 0.4), weakTopics.length);
  const weakPicks = weakTopics.slice(0, weakSlots);

  // Bucket 2: topics not asked recently (to avoid repetition)
  const fresh = allTopics.filter(t => !recentSet.has(t.toLowerCase()) && !weakSet.has(t.toLowerCase()));
  const shuffled = fresh.sort(() => Math.random() - 0.5);
  const freshPicks = shuffled.slice(0, totalQuestions - weakPicks.length);

  // Bucket 3: if we still need more, pull from full topic list
  let combined = [...weakPicks, ...freshPicks];
  if (combined.length < totalQuestions) {
    const filler = allTopics
      .filter(t => !combined.some(c => c.toLowerCase() === t.toLowerCase()))
      .slice(0, totalQuestions - combined.length);
    combined = [...combined, ...filler];
  }

  return combined.slice(0, totalQuestions);
}

// ── Round-aware type mix ────────────────────────────────────────────────
// If the round has a typeBias (e.g. system_design round → {system_design: 1.0}),
// honor it. Otherwise fall back to the default type mix derived from the user's
// configured interviewType.
function planTypeMixForRound(round, fallbackMix, totalQuestions) {
  if (!round || !round.typeBias) return fallbackMix;
  const bias = round.typeBias;
  const total = Object.values(bias).reduce((s, v) => s + v, 0);
  if (total <= 0) return fallbackMix;

  const mix = {};
  let assigned = 0;
  const entries = Object.entries(bias);
  // First pass — proportional allocation
  for (let i = 0; i < entries.length; i++) {
    const [type, weight] = entries[i];
    const n = i === entries.length - 1
      ? Math.max(0, totalQuestions - assigned)
      : Math.round((weight / total) * totalQuestions);
    mix[type] = Math.max(0, n);
    assigned += mix[type];
  }
  return mix;
}

// Build the full blueprint.
function build(config, memory = {}, options = {}) {
  const totalQuestions = parseInt(config.totalQuestions) || 5;

  // Resolve round profile first — it may override personality and pressure suggestions
  const round = roundProfiles.get(options.round || config.round || 'general');

  // Personality: explicit > round hint > auto-derive
  const personalityIdInput = options.personalityId || round.personalityHint || null;
  const personaInfo = derivePersona(config, personalityIdInput);

  // Pressure: explicit > round suggestion > standard
  const pressure = options.pressure || round.pressureSuggestion || 'standard';

  // Mode: derived from question count + lengthIntent
  const mode = pickMode(totalQuestions, config.lengthIntent);

  // Type mix: round overrides if it has a typeBias
  const fallbackMix = planTypeMix(config.interviewType || 'mixed', totalQuestions, config.experienceLevel);
  const typeMix = planTypeMixForRound(round, fallbackMix, totalQuestions);

  const weakTopics = (memory.weakTopics || []).map(t => t.topic);
  const recentTopics = (memory.recentInterviews || [])
    .flatMap(iv => (iv.questions || []).map(q => q.topic))
    .filter(Boolean);

  const plannedTopics = planTopics(config.role, totalQuestions, weakTopics, recentTopics);

  return {
    totalPlanned: totalQuestions,
    mode,
    plannedTopics,
    typeMix,
    // Legacy persona shape — preserved for any consumers that still read it
    persona: { style: personaInfo.style, tone: personaInfo.tone, rigor: personaInfo.rigor },
    personalityId: personaInfo.personalityId,
    pressure,
    round: round.id,
    roleLabel: ROLE_MAP[config.role] || config.role,
  };
}

module.exports = { build, derivePersona, pickMode };
