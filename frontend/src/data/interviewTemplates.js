/**
 * Interview template registry — static, code-defined starting points.
 *
 * Each template's `payload` is the EXACT shape that POST /api/interviews
 * accepts. This is the same shape saved presets and recent configs use;
 * templates, presets, and recents are three sources of one shape.
 *
 * Adding a template = one entry here. No other file change.
 * Enabling a Coming Soon interview type later = flip its `mode` in the
 * payload once the backend supports it.
 *
 * The Hub renders 4–6 templates in a responsive grid (Task 2). More can
 * ship; the Hub caps its display at 6 to keep the surface uncluttered.
 */

export const INTERVIEW_TEMPLATES = [
  {
    id: 'amazon-sde-1',
    name: 'Amazon SDE-1',
    description: 'FAANG-style SDE-1 loop with heavy DSA and system fundamentals.',
    icon: 'Building2',
    topics: ['DSA', 'System Design', 'OS', 'DBMS'],
    payload: {
      role: 'sde',
      experienceLevel: '1-2_years',
      companyType: 'faang',
      targetCompany: 'Amazon',
      interviewType: 'technical',
      difficulty: 'hard',
      totalQuestions: 6,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'depth',
      pressure: 'intense',
      personalityId: '',
      round: 'technical',
    },
  },
  {
    id: 'google-l3',
    name: 'Google L3',
    description: 'Rigorous L3 interview with graphs, DP, and clarifying questions.',
    icon: 'Sparkles',
    topics: ['Graphs', 'Dynamic Programming', 'Coding'],
    payload: {
      role: 'sde',
      experienceLevel: '1-2_years',
      companyType: 'faang',
      targetCompany: 'Google',
      interviewType: 'technical',
      difficulty: 'hard',
      totalQuestions: 5,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'depth',
      pressure: 'intense',
      personalityId: '',
      round: 'technical',
    },
  },
  {
    id: 'backend-node',
    name: 'Backend (Node.js)',
    description: 'Backend engineer role covering Node.js, databases, and APIs.',
    icon: 'Server',
    topics: ['Node.js', 'REST', 'SQL', 'Caching'],
    payload: {
      role: 'backend_developer',
      experienceLevel: '1-2_years',
      companyType: 'product_based',
      targetCompany: '',
      interviewType: 'technical',
      difficulty: 'medium',
      totalQuestions: 5,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'auto',
      pressure: 'standard',
      personalityId: '',
      round: 'technical',
    },
  },
  {
    id: 'frontend-react',
    name: 'Frontend (React)',
    description: 'React interview focused on hooks, performance, and accessibility.',
    icon: 'MonitorSmartphone',
    topics: ['React', 'JavaScript', 'CSS', 'Accessibility'],
    payload: {
      role: 'frontend_developer',
      experienceLevel: '1-2_years',
      companyType: 'product_based',
      targetCompany: '',
      interviewType: 'technical',
      difficulty: 'medium',
      totalQuestions: 5,
      jobDescription: '',
      useResume: false,
      lengthIntent: 'auto',
      pressure: 'standard',
      personalityId: '',
      round: 'technical',
    },
  },
  {
    id: 'campus-placement',
    name: 'Campus Placement',
    description: 'Balanced fresher interview mixing DSA, DBMS, and OS basics.',
    icon: 'GraduationCap',
    topics: ['DSA', 'DBMS', 'OS', 'Basics'],
    payload: {
      role: 'sde',
      experienceLevel: 'fresher',
      companyType: 'any',
      targetCompany: '',
      interviewType: 'mixed',
      difficulty: 'medium',
      totalQuestions: 5,
      jobDescription: '',
      useResume: true,
      lengthIntent: 'breadth',
      pressure: 'relaxed',
      personalityId: '',
      round: 'general',
    },
  },
  {
    id: 'startup-backend',
    name: 'Startup Backend',
    description: 'Fast-paced startup interview — full-stack awareness, tradeoffs.',
    icon: 'Rocket',
    topics: ['Node.js', 'Databases', 'Tradeoffs', 'Product Sense'],
    payload: {
      role: 'backend_developer',
      experienceLevel: '1-2_years',
      companyType: 'startup',
      targetCompany: '',
      interviewType: 'mixed',
      difficulty: 'medium',
      totalQuestions: 5,
      jobDescription: '',
      useResume: true,
      lengthIntent: 'auto',
      pressure: 'standard',
      personalityId: '',
      round: 'general',
    },
  },
];

/**
 * Convert a template into the InterviewReviewPage's Draft + confidence
 * shape (Commit 4). Templates skip the parser but land in the same
 * Review page — so we need to synthesize a high-confidence Draft.
 *
 * The mapping mirrors InterviewReviewPage.toWizardPayload in reverse.
 */
export function templateToDraft(template) {
  const p = template.payload;
  return {
    draft: {
      company:       p.targetCompany || null,
      role:          p.role,
      interviewType: p.interviewType,
      experience:    p.experienceLevel,
      difficulty:    p.difficulty,
      duration:      Math.round(p.totalQuestions * 5),
      questionCount: p.totalQuestions,
      personality:   null,
      pressure:      p.pressure,
      round:         p.round,
      topics:        Array.isArray(template.topics) ? template.topics.slice() : [],
      useResume:     !!p.useResume,
      useProjects:   false,
      followUps:     false,
      feedbackMode:  null,
      companyType:   p.companyType,
    },
    confidence: {
      company:       p.targetCompany ? 1 : 0,
      role:          1,
      interviewType: 1,
      experience:    1,
      difficulty:    1,
      duration:      1,
      questionCount: 1,
      personality:   0,
      pressure:      1,
      round:         1,
      topics:        template.topics?.length ? 1 : 0,
      useResume:     1,
      useProjects:   1,
      followUps:     0,
      feedbackMode:  0,
      companyType:   1,
    },
    unknown: [],
  };
}
