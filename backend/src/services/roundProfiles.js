// Round Profiles — registry of common interview round types and their behavioral
// expectations. A round is set at interview creation; the blueprint, persona,
// pressure, and prompts all shift accordingly.
//
// This is intentionally NOT exhaustive. Each profile is a small bundle of bias
// values that downstream services read; the LLM handles the rest in prompts.

const ROUNDS = {
  // Online assessment — automated screening style
  online_assessment: {
    id: 'online_assessment',
    label: 'Online Assessment',
    focus: 'concept verification & quick problem-solving',
    typeBias: { technical: 0.9, system_design: 0.1 },
    depthBias: 0.3,                // shallow probing — breadth matters more
    pressureSuggestion: 'standard',
    personalityHint: 'strict_technical',
    questionStyleHint: 'crisp, focused conceptual or coding-flavored questions',
  },

  // Recruiter / screening — fast, intro-style
  screening: {
    id: 'screening',
    label: 'Screening Round',
    focus: 'background, motivation, basic fit',
    typeBias: { behavioral: 0.6, technical: 0.4 },
    depthBias: 0.3,
    pressureSuggestion: 'relaxed',
    personalityHint: 'hr_interviewer',
    questionStyleHint: 'introductory, conversational, surface-level',
  },

  // Standard technical round
  technical: {
    id: 'technical',
    label: 'Technical Round',
    focus: 'implementation, debugging, optimization',
    typeBias: { technical: 1.0 },
    depthBias: 0.7,
    pressureSuggestion: 'standard',
    personalityHint: null, // use auto-derived
    questionStyleHint: 'implementation-oriented, with follow-ups on tradeoffs',
  },

  // Hiring manager round — engineering + alignment
  hiring_manager: {
    id: 'hiring_manager',
    label: 'Hiring Manager Round',
    focus: 'engineering judgment + team fit',
    typeBias: { technical: 0.5, behavioral: 0.3, system_design: 0.2 },
    depthBias: 0.6,
    pressureSuggestion: 'standard',
    personalityHint: 'engineering_manager',
    questionStyleHint: 'engineering decisions + collaboration scenarios',
  },

  // Behavioral / HR
  behavioral: {
    id: 'behavioral',
    label: 'Behavioral Round',
    focus: 'teamwork, ownership, conflict, communication',
    typeBias: { behavioral: 1.0 },
    depthBias: 0.5,
    pressureSuggestion: 'relaxed',
    personalityHint: 'hr_interviewer',
    questionStyleHint: 'STAR-format prompts about real experiences',
  },

  // System design
  system_design: {
    id: 'system_design',
    label: 'System Design Round',
    focus: 'architecture, scalability, tradeoffs',
    typeBias: { system_design: 1.0 },
    depthBias: 0.9,
    pressureSuggestion: 'standard',
    personalityHint: 'analytical',
    questionStyleHint: 'open-ended design prompts; expect probing on every choice',
  },

  // Leadership / staff+ round
  leadership: {
    id: 'leadership',
    label: 'Leadership Round',
    focus: 'ownership, mentorship, organizational thinking',
    typeBias: { behavioral: 0.7, system_design: 0.3 },
    depthBias: 0.7,
    pressureSuggestion: 'standard',
    personalityHint: 'engineering_manager',
    questionStyleHint: 'cross-team scenarios, mentoring, technical leadership',
  },

  // Architecture-only round (senior+)
  architecture: {
    id: 'architecture',
    label: 'Architecture Round',
    focus: 'system boundaries, scaling, reliability',
    typeBias: { system_design: 1.0 },
    depthBias: 0.95,
    pressureSuggestion: 'standard',
    personalityHint: 'analytical',
    questionStyleHint: 'architecture rationale, failure modes, scaling tradeoffs',
  },

  // Product discussion
  product: {
    id: 'product',
    label: 'Product Round',
    focus: 'user impact, tradeoffs, decision making',
    typeBias: { behavioral: 0.4, technical: 0.3, system_design: 0.3 },
    depthBias: 0.6,
    pressureSuggestion: 'standard',
    personalityHint: 'product_focused',
    questionStyleHint: 'how technical choices serve users / business outcomes',
  },

  // CTO / founder round
  founder: {
    id: 'founder',
    label: 'CTO / Founder Round',
    focus: 'ownership, shipping, scrappy engineering',
    typeBias: { behavioral: 0.4, technical: 0.3, system_design: 0.3 },
    depthBias: 0.7,
    pressureSuggestion: 'standard',
    personalityHint: 'startup_cto',
    questionStyleHint: 'practical engineering decisions, real-world tradeoffs',
  },

  // Senior / staff engineer round
  staff: {
    id: 'staff',
    label: 'Senior/Staff Engineer Round',
    focus: 'technical leadership, architecture, mentoring',
    typeBias: { system_design: 0.5, behavioral: 0.3, technical: 0.2 },
    depthBias: 0.85,
    pressureSuggestion: 'standard',
    personalityHint: 'analytical',
    questionStyleHint: 'cross-cutting architecture + leadership scenarios',
  },

  // Generic / unspecified — preserves existing behavior
  general: {
    id: 'general',
    label: 'General Interview',
    focus: 'mixed evaluation',
    typeBias: null,
    depthBias: 0.5,
    pressureSuggestion: null,
    personalityHint: null,
    questionStyleHint: null,
  },
};

const DEFAULT_ROUND = 'general';

function get(roundId) {
  return ROUNDS[roundId] || ROUNDS[DEFAULT_ROUND];
}

function list() {
  return Object.values(ROUNDS).map(r => ({ id: r.id, label: r.label, focus: r.focus }));
}

module.exports = { ROUNDS, DEFAULT_ROUND, get, list };
