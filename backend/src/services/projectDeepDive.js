// Project Deep Dive — detects when the candidate is discussing a project and
// provides the next axis to probe (architecture → tradeoffs → scale → failures
// → monitoring), respecting the saturation/depth caps the existing engine already
// enforces.
//
// Design principle: this is a *small finite sequence*, not an ontology. The
// engine asks for "the next axis to probe given how many we've already done"
// and this service answers. The LLM then phrases the question.

// Ordered probe axes. Each axis has:
//   - id (stable, persisted on liveState.projectContext.coveredAxes)
//   - label (human-readable, surfaced to UI/log)
//   - intent (drives the AI prompt phrasing)
//   - exampleAngles (LLM uses one as a starting point; not a script)
const PROBE_AXES = [
  {
    id: 'architecture',
    label: 'Architecture decisions',
    intent: 'test architecture decisions',
    exampleAngles: [
      'Why this architecture over alternatives?',
      'What constraints drove the design?',
      'What components own what responsibility?',
    ],
  },
  {
    id: 'tradeoffs',
    label: 'Technology tradeoffs',
    intent: 'test tradeoff reasoning',
    exampleAngles: [
      'Why this database/framework over X?',
      'What did you give up by choosing this?',
      'What would you change in hindsight?',
    ],
  },
  {
    id: 'implementation',
    label: 'Implementation depth',
    intent: 'test practical implementation',
    exampleAngles: [
      'Walk me through the trickiest part you actually built.',
      'How did you handle [specific thing they mentioned]?',
      'What did the request flow actually look like?',
    ],
  },
  {
    id: 'scale',
    label: 'Scalability and bottlenecks',
    intent: 'test scalability thinking',
    exampleAngles: [
      'What breaks first at 10x traffic?',
      'Where is the bottleneck today?',
      'How would you shard or partition this?',
    ],
  },
  {
    id: 'failures',
    label: 'Failures and debugging',
    intent: 'test failure-mode reasoning',
    exampleAngles: [
      'Tell me about a production incident on this.',
      'What broke unexpectedly, and how did you debug it?',
      'What kind of bugs were the hardest to track down?',
    ],
  },
  {
    id: 'observability',
    label: 'Monitoring and observability',
    intent: 'test operational maturity',
    exampleAngles: [
      'How would you know if this was broken in prod?',
      'What metrics or logs did you watch?',
      'How do you know it is healthy right now?',
    ],
  },
  {
    id: 'ownership',
    label: 'Ownership and decisions',
    intent: 'test ownership and decision-making',
    exampleAngles: [
      'What decisions did YOU drive vs. inherit?',
      'What would the next contributor need to know?',
      'What is the most fragile part you own?',
    ],
  },
];

// ── Project detection ────────────────────────────────────────────────────
// Heuristic: does the candidate's answer sound like they're describing a
// concrete project they built? We use:
//   - first-person past-tense phrases ("I built", "we shipped", "I designed")
//   - tech stack mentions (regex for common stack words)
//   - length signal (project descriptions tend to be longer)
//
// We deliberately accept some false positives — if the engine occasionally
// enters deep-dive mode on a non-project answer, it'll just ask one practical
// follow-up before pivoting back, which is fine.
const PROJECT_VERBS = /\b(built|shipped|designed|implemented|deployed|wrote|architected|created|launched|migrated|refactored|owned|led)\b/i;
const STACK_HINTS = /\b(react|node|express|nest|django|flask|spring|kafka|redis|mongo|postgres|mysql|s3|aws|gcp|docker|kubernetes|microservice|api|graphql|rest)\b/i;
const FIRST_PERSON = /\b(I|we|my|our)\b/i;

// Returns { isProject: boolean, name: string|null }
function detectProject(answerText) {
  if (!answerText || answerText.length < 60) return { isProject: false, name: null };
  const text = answerText;
  const hasVerb  = PROJECT_VERBS.test(text);
  const hasStack = STACK_HINTS.test(text);
  const hasFirst = FIRST_PERSON.test(text);

  // Need at least 2 of the 3 signals
  const signals = (hasVerb ? 1 : 0) + (hasStack ? 1 : 0) + (hasFirst ? 1 : 0);
  if (signals < 2) return { isProject: false, name: null };

  // Try to extract a project name — look for noun phrases after "called" / "named"
  const nameMatch = text.match(/\b(?:called|named|project)\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,2})/);
  return { isProject: true, name: nameMatch ? nameMatch[1] : null };
}

// ── Next axis to probe ───────────────────────────────────────────────────
// Given which axes have already been covered in this project context, return
// the next one. Returns null if all axes are exhausted or we've hit the cap.
const MAX_PROJECT_PROBES = 4;

function nextAxis(projectContext = {}, liveState = {}) {
  const covered = new Set(projectContext.coveredAxes || []);

  // Hard cap — don't drill into a single project forever
  if (covered.size >= MAX_PROJECT_PROBES) return null;

  // Walk axes in order, skipping covered ones
  for (const axis of PROBE_AXES) {
    if (!covered.has(axis.id)) {
      // Skip implementation if we just did it (we generally only ask implementation once per project)
      if (axis.id === 'implementation' && projectContext.lastAxis === 'implementation') continue;
      return axis;
    }
  }
  return null;
}

// Update the project context after asking a probe.
function recordAxis(projectContext = {}, axisId) {
  const next = { ...projectContext };
  next.coveredAxes = [...new Set([...(projectContext.coveredAxes || []), axisId])];
  next.lastAxis = axisId;
  next.probeCount = (projectContext.probeCount || 0) + 1;
  return next;
}

// Reset project context when the engine pivots away from project discussion.
function reset() {
  return { coveredAxes: [], lastAxis: null, probeCount: 0, name: null };
}

module.exports = {
  PROBE_AXES,
  MAX_PROJECT_PROBES,
  detectProject,
  nextAxis,
  recordAxis,
  reset,
};
