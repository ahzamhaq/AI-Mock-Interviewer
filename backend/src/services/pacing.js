// Pacing — a small derived-signal helper.
//
// Pacing is NOT its own state machine. It's a function of (liveState, personality,
// pressure) that returns:
//
//   {
//     tempo: 'slow' | 'normal' | 'fast',
//     followUpProbabilityMultiplier: number,  // engine multiplies its base by this
//     redirectAggression: number,             // 0-1: how readily we cut off rambling
//     promptHint: string,                     // injected into ai.service prompt
//   }
//
// The adaptive engine and ai.service both call this — it's the single source of
// truth for "how fast should this conversation feel right now?"

const personalities = require('./personalities');

const PRESSURE_FACTORS = {
  relaxed:  { tempoBias: -0.25, followUpMult: 0.75, redirect: 0.05 },
  standard: { tempoBias:  0,    followUpMult: 1.0,  redirect: 0.15 },
  intense:  { tempoBias:  0.25, followUpMult: 1.35, redirect: 0.35 },
};

// Compute the pacing signal.
// `liveState` is the interview's running state; `personalityId` and `pressure`
// are set at interview creation.
function compute(liveState = {}, personalityId, pressure = 'standard') {
  const p = personalities.get(personalityId);
  const pf = PRESSURE_FACTORS[pressure] || PRESSURE_FACTORS.standard;

  const hi = liveState.consecutiveHighScores || 0;
  const lo = liveState.consecutiveLowScores || 0;
  const avg = liveState.rollingAvgScore || 0;
  const lastLen = liveState.lastAnswerLength || 'normal';

  // Start from personality's base tempo, shift by pressure, then by performance.
  let tempoScalar = (p.tempo ?? 0.5) + pf.tempoBias;

  // Strong streak → speed up; struggling → slow down
  if (hi >= 2)       tempoScalar += 0.2;
  else if (hi >= 1)  tempoScalar += 0.1;
  if (lo >= 2)       tempoScalar -= 0.25;
  else if (lo >= 1)  tempoScalar -= 0.1;

  // Rambling answers → speed up (we want to keep moving)
  if (lastLen === 'too_long')  tempoScalar += 0.1;
  // Very short answers → keep moderate (don't rush; let them think)
  if (lastLen === 'too_short') tempoScalar -= 0.05;

  // Clamp
  tempoScalar = Math.max(0, Math.min(1, tempoScalar));

  let tempo;
  if (tempoScalar < 0.4) tempo = 'slow';
  else if (tempoScalar > 0.65) tempo = 'fast';
  else tempo = 'normal';

  // Follow-up probability multiplier — personality aggressiveness × pressure
  // × performance modifier.
  let followUpMult = (p.followUpAggression / 0.5) * pf.followUpMult;
  if (lo >= 2) followUpMult *= 0.4;  // recovery mode dampens follow-ups
  if (hi >= 2) followUpMult *= 1.2;  // strong streak earns more depth

  // Redirect aggression — interruption probability when answer rambles
  let redirect = p.interruptionRate + pf.redirect;
  if (lastLen === 'too_long') redirect += 0.25;
  redirect = Math.min(1, Math.max(0, redirect));

  // Prompt hint — short instruction the LLM can use to adjust phrasing
  let promptHint;
  if (tempo === 'fast') {
    promptHint = 'Keep the question short and direct. The candidate is in the zone — push them.';
  } else if (tempo === 'slow') {
    promptHint = 'Slow the pace. Phrase the question to give the candidate room to think and respond without pressure.';
  } else {
    promptHint = 'Maintain a steady conversational pace.';
  }

  return {
    tempo,
    tempoScalar,
    followUpProbabilityMultiplier: followUpMult,
    redirectAggression: redirect,
    promptHint,
  };
}

module.exports = { compute, PRESSURE_FACTORS };
