// Lightweight per-role topic graph.
//
// Each role maps to a tree of areas → topics → subtopics. The graph is intentionally
// shallow and approximate: the AI does most of the "nearby concept" reasoning at
// prompt time. The graph's job is to give the adaptive engine a *cheap* lookup
// for "if user just struggled on X, what topic should we revisit / pivot to?".
//
// Keep this generic enough that ANY company/stack can ride on top. The LLM is
// instructed to use the graph as a hint, not a hard taxonomy.

const ROLE_GRAPHS = {
  frontend_developer: {
    core: {
      JavaScript: ['Closures', 'Event Loop', 'Async/Promises', 'Prototypes', 'this binding', 'Modules'],
      'TypeScript': ['Generics', 'Utility Types', 'Type Narrowing', 'Inference'],
      Browser: ['Rendering Pipeline', 'Reflow/Repaint', 'Storage', 'Web APIs', 'Security (CORS/CSP)'],
      Performance: ['Code Splitting', 'Bundling', 'Lazy Loading', 'Memoization', 'Network Optimization'],
    },
    framework: {
      React: ['Hooks', 'Rendering', 'State Management', 'Context', 'Performance', 'Suspense'],
      'State Mgmt': ['Redux', 'Zustand', 'Context patterns', 'Server state (React Query)'],
      Styling: ['CSS-in-JS', 'Tailwind', 'Responsive', 'Accessibility'],
    },
    engineering: {
      Testing: ['Unit', 'Integration', 'E2E (Playwright/Cypress)', 'RTL'],
      'System Design (FE)': ['Component Architecture', 'Design Systems', 'SSR/SSG', 'Caching strategies'],
      Tooling: ['Webpack/Vite', 'CI/CD', 'Linting', 'Type checking'],
    },
  },

  backend_developer: {
    core: {
      'Language Fundamentals': ['Concurrency', 'Memory Management', 'Error Handling', 'Type Systems'],
      'Data Structures': ['Hash Maps', 'Trees', 'Heaps', 'Graphs'],
      Algorithms: ['Searching', 'Sorting', 'Graph Algorithms', 'Dynamic Programming'],
    },
    systems: {
      Databases: ['Indexing', 'Transactions', 'ACID', 'Normalization', 'NoSQL vs SQL', 'Sharding'],
      'API Design': ['REST', 'GraphQL', 'Versioning', 'Rate Limiting', 'Auth (JWT/OAuth)'],
      Caching: ['Redis', 'CDN', 'HTTP Caching', 'Cache Invalidation'],
      'Message Queues': ['Kafka', 'RabbitMQ', 'Pub/Sub patterns', 'Idempotency'],
    },
    architecture: {
      'System Design': ['Load Balancing', 'Horizontal Scaling', 'Microservices', 'Event-Driven', 'CQRS'],
      Reliability: ['Circuit Breakers', 'Retries', 'Observability', 'SLI/SLO'],
      Security: ['AuthN/AuthZ', 'Encryption', 'OWASP', 'Secrets Management'],
    },
  },

  fullstack_developer: {
    core: {
      JavaScript: ['Closures', 'Event Loop', 'Async/Promises', 'Modules'],
      'Frontend Frameworks': ['React/Vue', 'Rendering', 'State Management'],
      'Backend Frameworks': ['Express/Nest', 'Routing', 'Middleware'],
    },
    integration: {
      'API Layer': ['REST', 'GraphQL', 'WebSockets', 'Auth'],
      Databases: ['SQL', 'NoSQL', 'ORM', 'Migrations'],
      DevOps: ['Docker', 'CI/CD', 'Deployment', 'Monitoring'],
    },
    architecture: {
      'System Design': ['Component Boundaries', 'Caching', 'Scaling', 'Real-time'],
      Testing: ['Unit', 'Integration', 'E2E'],
    },
  },

  sde: {
    core: {
      'Data Structures': ['Arrays', 'Hash Maps', 'Linked Lists', 'Trees', 'Heaps', 'Graphs', 'Tries'],
      Algorithms: ['Two Pointers', 'Sliding Window', 'BFS/DFS', 'Dynamic Programming', 'Greedy', 'Backtracking'],
      Complexity: ['Time Complexity', 'Space Complexity', 'Tradeoffs'],
    },
    cs: {
      'Operating Systems': ['Processes vs Threads', 'Concurrency', 'Synchronization', 'Memory'],
      Networks: ['TCP/UDP', 'HTTP', 'DNS', 'Load Balancing'],
      Databases: ['Indexing', 'Transactions', 'Joins', 'Query Optimization'],
      'OOP/Design Patterns': ['SOLID', 'Common Patterns', 'Encapsulation'],
    },
    architecture: {
      'System Design': ['Scalability', 'Caching', 'Microservices', 'Sharding', 'Consistency Models'],
      'Low-Level Design': ['Class Design', 'API Design', 'State Management'],
    },
  },

  data_analyst: {
    core: {
      SQL: ['Joins', 'Window Functions', 'CTEs', 'Aggregations', 'Query Optimization'],
      Statistics: ['Distributions', 'Hypothesis Testing', 'Correlation vs Causation', 'A/B Testing'],
      'Data Wrangling': ['Pandas', 'Cleaning', 'Transformation', 'Missing Data'],
    },
    analysis: {
      Visualization: ['Tableau/PowerBI', 'Chart Selection', 'Storytelling'],
      'Business Metrics': ['KPIs', 'Funnel Analysis', 'Cohort Analysis', 'Retention'],
      'ML Basics': ['Regression', 'Classification', 'Feature Engineering'],
    },
    communication: {
      'Stakeholder Communication': ['Narrative', 'Audience Adaptation'],
      'Case Studies': ['Product Sense', 'Root Cause Analysis'],
    },
  },

  hr: {
    behavioral: {
      'STAR Method': ['Situation', 'Task', 'Action', 'Result'],
      'Past Experience': ['Projects', 'Conflicts', 'Achievements', 'Failures'],
      Leadership: ['Initiative', 'Mentoring', 'Delegation'],
      Teamwork: ['Collaboration', 'Conflict Resolution', 'Communication'],
    },
    motivation: {
      'Career Goals': ['Short-term', 'Long-term'],
      'Company Fit': ['Values', 'Culture', 'Why this company'],
      'Self-awareness': ['Strengths', 'Weaknesses', 'Growth Areas'],
    },
    situational: {
      'Pressure Handling': ['Deadlines', 'Tight Resources'],
      'Ethical Dilemmas': ['Tradeoffs', 'Difficult Decisions'],
    },
  },

  other: {
    general: {
      Fundamentals: ['Core Concepts', 'Problem Solving'],
      Communication: ['Clarity', 'Reasoning'],
      Experience: ['Past Projects', 'Challenges Overcome'],
    },
  },
};

// Flatten the graph for the given role into a list of {area, topic, subtopics}.
function flatten(role) {
  const graph = ROLE_GRAPHS[role] || ROLE_GRAPHS.other;
  const out = [];
  for (const [area, topics] of Object.entries(graph)) {
    for (const [topic, subtopics] of Object.entries(topics)) {
      out.push({ area, topic, subtopics });
    }
  }
  return out;
}

// All topic names for a role (for blueprint selection / dedup lookup).
function topicsForRole(role) {
  return flatten(role).map(t => t.topic);
}

// Return topics in the same area as the given topic — used to "explore nearby concepts"
// when a candidate struggles. Falls back to subtopic siblings or random topics in role.
function nearbyTopics(role, topic) {
  const flat = flatten(role);
  const node = flat.find(n => n.topic.toLowerCase() === (topic || '').toLowerCase());
  if (node) {
    return flat.filter(n => n.area === node.area && n.topic !== node.topic).map(n => n.topic);
  }
  // Fuzzy search — topic might be a subtopic
  const owner = flat.find(n => n.subtopics.some(s => s.toLowerCase() === (topic || '').toLowerCase()));
  if (owner) return [owner.topic, ...flat.filter(n => n.area === owner.area && n.topic !== owner.topic).map(n => n.topic)];
  // Last resort — return any 3 topics
  return flat.slice(0, 3).map(n => n.topic);
}

// Compact human-readable representation for prompt injection.
function describeGraphForPrompt(role) {
  const graph = ROLE_GRAPHS[role] || ROLE_GRAPHS.other;
  const lines = [];
  for (const [area, topics] of Object.entries(graph)) {
    const topicList = Object.keys(topics).join(', ');
    lines.push(`${area}: ${topicList}`);
  }
  return lines.join(' | ');
}

module.exports = { flatten, topicsForRole, nearbyTopics, describeGraphForPrompt };
