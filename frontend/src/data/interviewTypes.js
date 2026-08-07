/**
 * Interview type registry — the SINGLE source of truth for the cards
 * rendered on the InterviewHubPage. Enabling a future interview mode
 * (DSA, System Design, etc.) is a one-line change here: flip
 * `enabled: false` → `true` and give it a real `handler`.
 *
 * The registry lives client-side because the Hub is a pure UI decision
 * point — no backend involvement. Modes still need corresponding backend
 * support (blueprint recognizes `mode`, adaptive engine understands the
 * round). Sprint 5 Commit 1 already widened the backend `mode` enum for
 * all seven.
 *
 * Card shape:
 *   id          — matches Interview.model.js `mode` enum
 *   title       — display name
 *   description — one-line explanation
 *   icon        — Lucide icon name
 *   category    — visual grouping ('primary' | 'reserved')
 *   enabled     — false → renders as "Coming Soon" and cannot be clicked
 *   actionLabel — text on the CTA button
 */

export const INTERVIEW_TYPES = [
  {
    id: 'resume',
    title: 'Resume-Based Interview',
    description: 'Questions generated from your uploaded resume.',
    icon: 'FileText',
    category: 'primary',
    enabled: true,
    actionLabel: 'Start',
  },
  {
    id: 'project',
    title: 'Project Interview',
    description: 'Interview based on one of your analyzed GitHub projects.',
    icon: 'GitBranch',
    category: 'primary',
    enabled: true,
    actionLabel: 'Choose Project',
  },
  {
    id: 'custom',
    title: 'Custom Interview',
    description: 'Describe the interview you want in your own words.',
    icon: 'Sparkles',
    category: 'primary',
    enabled: true,
    actionLabel: 'Try',
  },
  {
    id: 'dsa',
    title: 'DSA Interview',
    description: 'Coding interview focused on data structures and algorithms.',
    icon: 'Code2',
    category: 'primary',
    enabled: true,
    actionLabel: 'Configure',
  },
  {
    id: 'aptitude',
    title: 'Aptitude Test',
    description: 'Practice quantitative, logical and verbal reasoning.',
    icon: 'Brain',
    category: 'reserved',
    enabled: false,
    actionLabel: 'Coming Soon',
  },
  {
    id: 'system_design',
    title: 'System Design',
    description: 'Architecture and scalability interviews.',
    icon: 'Layers',
    category: 'reserved',
    enabled: false,
    actionLabel: 'Coming Soon',
  },
  {
    id: 'behavioral',
    title: 'Behavioral / HR',
    description: 'STAR-based behavioral interviews.',
    icon: 'Users',
    category: 'reserved',
    enabled: false,
    actionLabel: 'Coming Soon',
  },
];

export const AVAILABLE_TYPES = INTERVIEW_TYPES.filter((t) => t.enabled);
export const RESERVED_TYPES = INTERVIEW_TYPES.filter((t) => !t.enabled);
