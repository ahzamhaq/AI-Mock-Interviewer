// Adaptive Engine — decides what happens next in an interview.
//
// Inputs: the live Interview document (with blueprint + liveState + answered questions).
// Outputs: a decision object that the controller executes:
//   { action: 'follow_up' | 'revisit_weak' | 'pivot' | 'memorized_probe' | 'finalize',
//     topic, difficulty, questionType, parentIndex, rationale }
//
// The engine is intentionally rule-based at this layer. The LLM is invoked *after*
// the decision, to actually phrase the question. That separation gives us:
//   - predictable, debuggable behavior (we can log the rationale)
//   - cheap decision-making (no extra LLM call per question just to pick the action)
//   - the LLM does what it's good at — phrasing — not branch logic.

const topicGraph = require('./topicGraph');
const conversation = require('./conversationStyle');
const pacing = require('./pacing');
const projectDeepDive = require('./projectDeepDive');
const roundProfiles = require('./roundProfiles');

// ── Tunable thresholds ────────────────────────────────────────────────────────
const SCORE_STRONG = 8;      // >= this on a primary question → consider follow-up depth
const SCORE_WEAK = 5;        // < this → mark weak, consider revisit
const MAX_FOLLOWUP_DEPTH = 2;        // never chain more than 2 follow-ups on one topic
const MAX_FOLLOWUPS_PER_INTERVIEW = 4; // overall cap so a long interview doesn't drift into one topic
const STRONG_STREAK_FOR_DIFFICULTY_BUMP = 2;
const WEAK_STREAK_FOR_DIFFICULTY_DROP = 2;
const ROLLING_WINDOW = 3;
// Probability of revisiting an unresolved weak topic at any given pivot point
const REVISIT_BIAS = 0.35;
// Topic saturation — beyond this many questions on one topic, dramatically lower its priority
const TOPIC_SATURATION_THRESHOLD = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function answered(interview) {
  return interview.questions.filter(q => !q.skipped && q.aiFeedback?.score > 0);
}

function rollingAvg(scores, window = ROLLING_WINDOW) {
  if (!scores.length) return 0;
  const slice = scores.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function isMemorizedSignal(feedback) {
  if (!feedback) return false;

  // PRIMARY signal: the evaluator's LLM-derived category. This is more reliable
  // than the older heuristic because it looks at concept-grounding, not just
  // grammar vs. completeness.
  if (feedback.responseCategory === 'memorized') return true;
  if (feedback.responseCategory === 'buzzword_heavy') return true;

  // SECONDARY signal: low implementation depth + decent technical accuracy.
  // Suggests theoretical recall without practical grounding.
  const implDepth = feedback.implementationDepthScore;
  const techAcc   = feedback.technicalAccuracyScore;
  if (typeof implDepth === 'number' && typeof techAcc === 'number') {
    if (techAcc >= 6 && implDepth <= 3) return true;
  }

  // FALLBACK: original heuristic for backwards compat (older evaluations
  // without rubric fields).
  const g = feedback.grammarScore || 0;
  const c = feedback.completenessScore || 0;
  const t = feedback.technicalScore || 0;
  return g >= 8 && (c <= 5 && t <= 6);
}

function countPrimaryAnswered(interview) {
  return interview.questions.filter(q => !q.skipped && q.aiFeedback?.score > 0 && !q.isFollowUp).length;
}

function totalFollowUps(interview) {
  return interview.questions.filter(q => q.isFollowUp).length;
}

// Count how many follow-ups have already chained off this parent question.
function followUpChainDepth(interview, parentIndex) {
  if (parentIndex == null) return 0;
  let depth = 0;
  let cursor = parentIndex;
  // Walk forward through follow-ups whose parent is the cursor
  let found = true;
  while (found) {
    found = false;
    for (let i = cursor + 1; i < interview.questions.length; i++) {
      const q = interview.questions[i];
      if (q.isFollowUp && q.parentQuestionIndex === cursor) {
        depth += 1;
        cursor = i;
        found = true;
        break;
      }
    }
  }
  return depth;
}

// ── Public: update live state after an answer ─────────────────────────────────

function updateLiveState(interview, justAnsweredIndex) {
  const q = interview.questions[justAnsweredIndex];
  if (!q) return;
  const fb = q.aiFeedback || {};
  const score = fb.score || 0;
  const topic = q.topic || '';

  const ls = interview.liveState || {};
  ls.lastScore = score;
  ls.lastTopic = topic;

  // Covered topics — append if new
  if (topic && !ls.coveredTopics.includes(topic)) {
    ls.coveredTopics.push(topic);
  }

  // Topic depth budget — count questions per topic (Map in Mongo)
  if (topic) {
    if (!ls.topicDepthBudget) ls.topicDepthBudget = new Map();
    // Both Map and plain object access compatible
    const current = ls.topicDepthBudget instanceof Map
      ? (ls.topicDepthBudget.get(topic) || 0)
      : (ls.topicDepthBudget[topic] || 0);
    if (ls.topicDepthBudget instanceof Map) ls.topicDepthBudget.set(topic, current + 1);
    else ls.topicDepthBudget[topic] = current + 1;
  }

  // Classify answer length for the next decision
  if (!q.skipped && q.userAnswer) {
    ls.lastAnswerLength = conversation.classifyLength(q.userAnswer, q.questionType);
    // Persist on the answered question too for analytics/UI
    q.answerLength = ls.lastAnswerLength;
  } else {
    ls.lastAnswerLength = 'empty';
  }
  ls.lastMemorized = isMemorizedSignal(fb);

  // ── Project deep-dive detection ────────────────────────────────────────
  // If the candidate's answer sounds like a project description AND we aren't
  // already in deep-dive mode, mark a candidate for entry. The actual decision
  // to enter deep-dive happens in decideNext() (so we can weigh other signals).
  if (!q.skipped && q.userAnswer) {
    const detection = projectDeepDive.detectProject(q.userAnswer);
    if (detection.isProject) {
      const existing = ls.projectContext || {};
      if (!existing.active) {
        // New project — fresh context
        ls.projectContext = {
          active: true,
          name: detection.name,
          coveredAxes: [],
          lastAxis: null,
          probeCount: 0,
          rootQuestionIndex: justAnsweredIndex,
        };
      } else {
        // Already in deep-dive; preserve existing axes
        ls.projectContext = { ...existing, name: existing.name || detection.name };
      }
      interview.markModified('liveState.projectContext');
    }
  }

  // Weak / strong this session
  if (topic && score > 0) {
    if (score < SCORE_WEAK && !ls.weakTopicsThisSession.includes(topic)) {
      ls.weakTopicsThisSession.push(topic);
    }
    if (score >= SCORE_STRONG && !ls.strongTopicsThisSession.includes(topic)) {
      ls.strongTopicsThisSession.push(topic);
      // Topic redeemed itself — remove from weak list if it was there
      ls.weakTopicsThisSession = ls.weakTopicsThisSession.filter(t => t !== topic);
    }
  }

  // Rolling average across all answered (not just primary)
  const scores = answered(interview).map(a => a.aiFeedback.score);
  ls.rollingAvgScore = Math.round(rollingAvg(scores) * 10) / 10;

  // Streaks
  if (score >= SCORE_STRONG) {
    ls.consecutiveHighScores = (ls.consecutiveHighScores || 0) + 1;
    ls.consecutiveLowScores = 0;
  } else if (score < SCORE_WEAK) {
    ls.consecutiveLowScores = (ls.consecutiveLowScores || 0) + 1;
    ls.consecutiveHighScores = 0;
  } else {
    ls.consecutiveHighScores = 0;
    ls.consecutiveLowScores = 0;
  }

  // Memorized signal
  if (isMemorizedSignal(fb)) {
    ls.memorizedFlags = (ls.memorizedFlags || 0) + 1;
  }

  // Follow-up depth on the active chain
  if (q.isFollowUp) {
    ls.followUpDepth = (ls.followUpDepth || 0) + 1;
  } else {
    ls.followUpDepth = 0;
  }

  // Difficulty adjustment
  ls.currentDifficulty = adjustDifficulty(ls);

  // ── Re-derive pacing signal for the next turn ──────────────────────────
  const pace = pacing.compute(ls, interview.personalityId, interview.pressure);
  ls.pacingTempo = pace.tempo;

  interview.liveState = ls;
  interview.markModified('liveState');
  interview.markModified('liveState.topicDepthBudget');
}

// Read topic depth (works with both Map and plain object).
function topicDepth(ls, topic) {
  if (!ls || !ls.topicDepthBudget || !topic) return 0;
  if (ls.topicDepthBudget instanceof Map) return ls.topicDepthBudget.get(topic) || 0;
  // Mongoose may hydrate as plain object on read
  return ls.topicDepthBudget[topic] || 0;
}

// ── Public: pick the next action ──────────────────────────────────────────────

function decideNext(interview) {
  const ls = interview.liveState || {};
  const bp = interview.blueprint || {};
  const lastIndex = interview.questions.length - 1;
  const lastQ = interview.questions[lastIndex];
  const lastFb = lastQ?.aiFeedback || {};

  const primaryCount = countPrimaryAnswered(interview);
  const totalPlanned = bp.totalPlanned || interview.config.totalQuestions || 5;
  const mode = bp.mode || 'balanced';

  // Pacing/pressure signal for downstream branching
  const pace = pacing.compute(ls, interview.personalityId, interview.pressure);

  // ── Terminal: have we asked enough primary questions? ───────────────────
  if (primaryCount >= totalPlanned) {
    return { action: 'finalize', rationale: 'planned question count reached' };
  }

  // ── PROJECT DEEP-DIVE — if the last answer described a project AND we
  // haven't exhausted the deep-dive axes, prefer a deep-dive probe over a
  // regular follow-up. This is conditional on saturation rules and pacing.
  if (
    ls.projectContext?.active &&
    lastQ && !lastQ.skipped && lastQ.userAnswer &&
    (lastFb.score || 0) >= 3 && // don't deep-dive if the candidate gave up
    pace.followUpProbabilityMultiplier > 0.5 // and we're not in deep recovery
  ) {
    const axis = projectDeepDive.nextAxis(ls.projectContext, ls);
    if (axis) {
      const rootIndex = ls.projectContext.rootQuestionIndex ?? lastIndex;
      // Determine chain depth — count follow-ups since the project root
      const chainDepth = ls.projectContext.probeCount || 0;
      return {
        action: 'follow_up',
        topic: lastQ.topic,
        questionType: 'technical',
        parentIndex: rootIndex,
        followUpDepth: chainDepth + 1,
        difficulty: ls.currentDifficulty || 'medium',
        intent: axis.intent,
        projectAxis: axis,
        projectContextUpdate: projectDeepDive.recordAxis(ls.projectContext, axis.id),
        rationale: `project deep-dive: ${axis.label} (axis ${chainDepth + 1}/${projectDeepDive.MAX_PROJECT_PROBES})`,
      };
    }
    // Axes exhausted — clear project context so we can pivot
    ls.projectContext = projectDeepDive.reset();
    ls.projectContext.active = false;
    interview.markModified('liveState.projectContext');
  }

  // ── Should we follow up on the just-answered question? ─────────────────
  if (lastQ && lastQ.userAnswer && !lastQ.skipped) {
    const followUpDecision = decideFollowUp(interview, lastIndex, lastFb, mode, pace);
    if (followUpDecision) return followUpDecision;
  }

  // ── Should we probe a suspected memorized answer? ──────────────────────
  if (lastQ && !lastQ.skipped && isMemorizedSignal(lastFb) && (ls.memorizedFlags || 0) <= 2) {
    return {
      action: 'memorized_probe',
      topic: lastQ.topic,
      parentIndex: lastIndex,
      questionType: lastQ.questionType,
      difficulty: ls.currentDifficulty || 'medium',
      rationale: 'answer looked memorized/generic — probe practical depth',
    };
  }

  // ── Should we revisit a weak topic from this session? ──────────────────
  const unresolvedWeak = (ls.weakTopicsThisSession || []).filter(t => !(ls.strongTopicsThisSession || []).includes(t));
  if (unresolvedWeak.length > 0 && Math.random() < REVISIT_BIAS && primaryCount > 1) {
    const topic = unresolvedWeak[0];
    return {
      action: 'revisit_weak',
      topic,
      questionType: pickTypeForTopic(interview, topic),
      difficulty: 'easy', // simplify to reinforce understanding
      rationale: `revisiting weak topic "${topic}" with simpler framing`,
    };
  }

  // ── Otherwise: pivot to next planned topic ─────────────────────────────
  return pivot(interview);
}

// Decide whether to ask a follow-up on the just-answered question.
function decideFollowUp(interview, lastIndex, lastFb, mode, pace) {
  const lastQ = interview.questions[lastIndex];
  if (!lastQ) return null;

  // Hard caps
  if (totalFollowUps(interview) >= MAX_FOLLOWUPS_PER_INTERVIEW) return null;

  // Walk back to find the primary question this chain is rooted at
  const rootIndex = lastQ.isFollowUp ? lastQ.parentQuestionIndex : lastIndex;
  const currentChainDepth = lastQ.isFollowUp ? (lastQ.followUpDepth || 1) : 0;
  if (currentChainDepth >= MAX_FOLLOWUPS_PER_INTERVIEW) return null;

  const ls = interview.liveState || {};
  const score = lastFb.score || 0;
  const consecutiveLo = ls.consecutiveLowScores || 0;

  // RECOVERY MODE — after 2 consecutive weak answers, pivot instead of following up.
  // This avoids "punishing" a struggling candidate with deeper probes on the same topic.
  if (consecutiveLo >= 2) return null;

  // TOPIC SATURATION — if we've already spent 2+ questions on this topic, hold off
  // on more follow-ups in this family.
  if (topicDepth(ls, lastQ.topic) >= TOPIC_SATURATION_THRESHOLD) return null;

  // Mode-based base probability
  let probability = 0;
  if (mode === 'breadth') probability = 0.15;
  else if (mode === 'balanced') probability = 0.35;
  else if (mode === 'depth') probability = 0.55;

  // Adjust by score signal:
  //   strong answer → ask follow-up to push for tradeoffs/depth (~+0.25)
  //   weak answer  → don't pile on; pivot to a different topic
  //   middling     → moderate chance
  if (score >= SCORE_STRONG) probability += 0.25;
  else if (score < SCORE_WEAK) probability -= 0.4;
  else if (score >= 6) probability += 0.1;

  // Length signal:
  //   too_short → bump probability (we want to draw them out)
  //   too_long  → drop (they already over-explained; pivot to give breadth a chance)
  if (ls.lastAnswerLength === 'too_short') probability += 0.2;
  if (ls.lastAnswerLength === 'too_long') probability -= 0.2;

  // Response-quality bumps — certain flags strongly warrant a follow-up:
  //   vague / buzzwordy / generic / overconfident → ask for depth
  //   rambling / hedged                           → already moved the engine
  //   contradicted_self                           → reconcile via follow-up
  const qFlag = lastQ.primaryQualityFlag;
  if (qFlag === 'vague' || qFlag === 'buzzwordy' || qFlag === 'generic') probability += 0.25;
  if (qFlag === 'overconfident' || qFlag === 'contradicted_self') probability += 0.3;

  // LLM-derived response category from the strict evaluator — much stronger
  // signal than the regex flags above. These probe-worthy categories almost
  // always warrant a follow-up to extract real understanding.
  const cat = lastFb.responseCategory;
  if (cat === 'shallow' || cat === 'vague' || cat === 'buzzword_heavy') probability += 0.3;
  if (cat === 'memorized' || cat === 'implementation_weak')             probability += 0.35;
  if (cat === 'partially_correct')                                       probability += 0.15;
  // Excellent / strong → probe for depth only sometimes (push the strong candidate)
  if (cat === 'excellent') probability += 0.1;
  // Off-topic → pivot, don't pile on
  if (cat === 'off_topic') probability -= 0.6;

  // Round depth bias — system_design / architecture rounds expect deep probing.
  const round = roundProfiles.get(interview.round || 'general');
  if (round.depthBias != null) {
    // Center around 0.5: 0.9 → +0.4, 0.3 → -0.2
    probability += (round.depthBias - 0.5);
  }

  // Once we've gone 1 follow-up deep on a chain, halve probability
  if (currentChainDepth >= 1) probability *= 0.5;

  // Memorized answer → almost always probe (handled separately by `memorized_probe`
  // action above, but defensively bump probability here too)
  if (isMemorizedSignal(lastFb)) probability += 0.3;

  // ── Apply pacing/pressure multiplier ──────────────────────────────────
  // pace.followUpProbabilityMultiplier folds in personality aggression + pressure
  // factor + performance modifiers (recovery dampens, strong streak amplifies).
  if (pace?.followUpProbabilityMultiplier) {
    probability *= pace.followUpProbabilityMultiplier;
  }

  // Clamp to sane range
  probability = Math.max(0, Math.min(0.95, probability));

  if (Math.random() > probability) return null;

  return {
    action: 'follow_up',
    topic: lastQ.topic,
    questionType: lastQ.questionType,
    parentIndex: rootIndex,
    followUpDepth: currentChainDepth + 1,
    difficulty: ls.currentDifficulty || 'medium',
    rationale: `follow-up (depth ${currentChainDepth + 1}) on "${lastQ.topic}" — score ${score}, length ${ls.lastAnswerLength}`,
  };
}

// Pick the next planned topic that hasn't been over-explored yet.
//
// Natural conversation flow: in depth/balanced modes, we PREFER nearby topics
// (via topicGraph.nearbyTopics) over arbitrary planned topics so the conversation
// feels connected. In breadth mode, we walk the plan linearly to maximize coverage.
//
// Order of preference (depth/balanced):
//   1. Nearby concept of the last topic that is also on the plan AND not saturated
//   2. Nearby concept (any), not saturated, not yet covered
//   3. Fresh planned topic (not covered, not saturated)
//   4. Any uncovered planned topic
//   5. Fallback to nearby/any-nearby topic
//
// Breadth mode skips the "nearby" preference and walks the plan in order.
function pivot(interview) {
  const bp = interview.blueprint || {};
  const ls = interview.liveState || {};
  const covered = new Set((ls.coveredTopics || []).map(t => t.toLowerCase()));
  const isSaturated = (t) => topicDepth(ls, t) >= TOPIC_SATURATION_THRESHOLD;
  const mode = bp.mode || 'balanced';

  const planned = bp.plannedTopics || [];
  const lastTopic = ls.lastTopic;

  let nextTopic;
  let viaNearby = false;

  if (mode !== 'breadth' && lastTopic) {
    // Try to flow naturally via nearby concepts first
    const nearby = topicGraph.nearbyTopics(interview.config.role, lastTopic);
    const plannedSet = new Set(planned.map(t => t.toLowerCase()));

    // 1. Nearby AND planned AND unsaturated AND uncovered
    nextTopic = nearby.find(t =>
      plannedSet.has(t.toLowerCase()) &&
      !covered.has(t.toLowerCase()) &&
      !isSaturated(t)
    );

    // 2. Any nearby, unsaturated, uncovered
    if (!nextTopic) {
      nextTopic = nearby.find(t => !covered.has(t.toLowerCase()) && !isSaturated(t));
    }

    if (nextTopic) viaNearby = true;
  }

  // 3. Fresh, unsaturated planned topic
  if (!nextTopic) nextTopic = planned.find(t => !covered.has(t.toLowerCase()) && !isSaturated(t));

  // 4. Any uncovered planned topic
  if (!nextTopic) nextTopic = planned.find(t => !covered.has(t.toLowerCase()));

  // 5. Last resort — any nearby concept
  if (!nextTopic && lastTopic) {
    const nearby = topicGraph.nearbyTopics(interview.config.role, lastTopic);
    nextTopic = nearby.find(t => !isSaturated(t)) || nearby[0];
  }

  if (!nextTopic) nextTopic = 'general';

  // Pick question type from the planned mix, preferring under-served types
  const questionType = pickQuestionTypeFromMix(interview);

  return {
    action: 'pivot',
    topic: nextTopic,
    questionType,
    difficulty: ls.currentDifficulty || interview.config.difficulty || 'medium',
    rationale: `pivot to "${nextTopic}"${viaNearby ? ' (related to last topic)' : ''}${isSaturated(lastTopic) ? ' [last topic saturated]' : ''}`,
  };
}

function pickQuestionTypeFromMix(interview) {
  const mix = interview.blueprint?.typeMix || {};
  const asked = {};
  for (const q of interview.questions.filter(q => !q.isFollowUp)) {
    asked[q.questionType] = (asked[q.questionType] || 0) + 1;
  }
  // Find type with the largest remaining gap (planned - asked)
  let best = null;
  let bestGap = -Infinity;
  for (const [type, planned] of Object.entries(mix)) {
    const gap = (planned || 0) - (asked[type] || 0);
    if (gap > bestGap) {
      bestGap = gap;
      best = type;
    }
  }
  return best || interview.config.interviewType || 'technical';
}

// Heuristic for type selection when revisiting a topic.
function pickTypeForTopic(interview, topic) {
  // Behavioral/HR topics stay behavioral; everything else inherits the interview type.
  const behavioralHints = ['leadership', 'teamwork', 'conflict', 'communication', 'career'];
  const t = (topic || '').toLowerCase();
  if (behavioralHints.some(h => t.includes(h))) return 'behavioral';
  return interview.config.interviewType === 'mixed' ? 'technical' : interview.config.interviewType || 'technical';
}

// ── Difficulty engine ─────────────────────────────────────────────────────────

function adjustDifficulty(liveState) {
  const current = liveState.currentDifficulty || 'medium';
  const hi = liveState.consecutiveHighScores || 0;
  const lo = liveState.consecutiveLowScores || 0;

  if (hi >= STRONG_STREAK_FOR_DIFFICULTY_BUMP) {
    if (current === 'easy') return 'medium';
    if (current === 'medium') return 'hard';
    return 'hard';
  }
  if (lo >= WEAK_STREAK_FOR_DIFFICULTY_DROP) {
    if (current === 'hard') return 'medium';
    if (current === 'medium') return 'easy';
    return 'easy';
  }
  return current;
}

module.exports = {
  updateLiveState,
  decideNext,
  decideFollowUp,
  adjustDifficulty,
  isMemorizedSignal,
  topicDepth,
  // exposed for testing / debugging
  _internals: { followUpChainDepth, pickQuestionTypeFromMix, pivot },
};
