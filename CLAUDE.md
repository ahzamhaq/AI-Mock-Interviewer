# CLAUDE.md — AI Mock Interviewer

This file gives Claude Code full context on this repository so a new session can be productive immediately without re-discovering the architecture. **Read this before making changes.** If anything here conflicts with what you find in the code, trust the code and update this file.

> This is a two-project monorepo: `backend/` (Express + MongoDB API) and `frontend/` (React + Vite SPA). There is no shared root `node_modules` — each has its own `package.json`.

---

## 1. Project Structure

```
AI mock interviewer/
├── package.json                 # root orchestrator: install:all / dev:backend / dev:frontend / build:frontend
├── README.md                    # user-facing docs — roadmap section is STALE (see §14)
├── backend/
│   ├── src/
│   │   ├── app.js                # Express app: helmet, CORS allowlist, rate limiting, route mounting
│   │   ├── server.js              # entrypoint — connects Mongo, starts HTTP server
│   │   ├── constants/
│   │   │   ├── dsa.js                    # DSA topics/difficulties/languages — single source of truth
│   │   │   └── judge0Languages.js        # language → Judge0 language_id mapping
│   │   ├── controllers/           # one per resource — thin, delegate to services
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js        # protect (JWT verify), adminOnly
│   │   │   ├── upload.middleware.js      # multer (resume upload)
│   │   │   ├── errorHandler.js, notFound.js
│   │   ├── models/                 # Mongoose schemas — see §4
│   │   ├── routes/                 # mirrors controllers 1:1, mounted in app.js
│   │   ├── services/                # ALL business logic lives here — see §6/§7/§8
│   │   │   ├── achievements/             # registry.js, evaluate.js
│   │   │   └── interviewStrategies/      # strategy pattern per interview mode — see §7
│   │   └── utils/
│   │       ├── database.js               # Mongo connection
│   │       └── embedding.js              # cheap hash-based similarity (NOT a real embedding API)
│   ├── vercel.json, render.yaml    # deploy configs for both platforms
│   └── .env.example                # see §12 — INCOMPLETE relative to actual required vars
└── frontend/
    ├── src/
    │   ├── App.jsx                 # all routes, lazy-loaded, ProtectedRoute/PublicRoute wrappers
    │   ├── pages/                   # one per route (~26 pages)
    │   ├── components/              # grouped by feature (see below)
    │   │   ├── dashboard/, interview/, interview/coding/ (Monaco DSA editor)
    │   │   ├── projects/, workspace/chat/, coach/, profile/, results/
    │   │   ├── analytics/, search/ (CommandPalette), settings/, avatar/, common/, layout/
    │   ├── context/                  # AuthContext, SearchContext (NO Redux/Zustand — Context + hooks only)
    │   ├── data/                     # client-side static registries (achievements, interviewTypes, dsaConstants, codeTemplates, interviewTemplates)
    │   ├── hooks/                     # useVoice, useHotkey, useAmplitudeAnalyzer
    │   └── services/                  # api.js (axios client), tts.js, execution.js, workspaceChat.js, workspaceContext.js, coachActions.js, badgeUnlocks.js
    └── .env.example
```

---

## 2. Technology Stack

**Backend** (`backend/`, Node 18+):
- Express 4, MongoDB via **Mongoose 8** (no Prisma/SQL — this project is Mongo-only)
- Auth: **JWT** (`jsonwebtoken`) + `bcryptjs`; **Google OAuth** (login, via `google-auth-library`); **GitHub OAuth** (account *linking* only, never login — for private repo access), tokens encrypted AES-256-GCM (`services/crypto.service.js`)
- AI: multi-provider fallback chain — **Gemini** (`@google/generative-ai`) → **Groq** (`groq-sdk`, optional dep) → **OpenRouter** (raw `fetch`, no SDK). See §6.
- Code execution: **Judge0 CE** via plain HTTP (no SDK) — `services/judge0.service.js`
- Security: helmet, cors (locked allowlist), express-rate-limit (100/15min global, 10/15min on `/api/auth`), compression, morgan (dev only)
- File upload: multer (resume)
- **No test suite exists.** `"test": "jest"` is declared in `backend/package.json` but there is no `jest` devDependency and no `*.test.js`/`__tests__` files anywhere.

**Frontend** (`frontend/`, Vite 5 + React 18):
- React Router v6, all pages lazy-loaded
- Styling: **Tailwind CSS 3** + Framer Motion for animation
- State: **React Context only** (`AuthContext`, `SearchContext`) + local component state/hooks — no global state library
- Charts: Recharts · Icons: lucide-react · Toasts: react-hot-toast
- Code editor: `@monaco-editor/react` (DSA workspace)
- Markdown: `react-markdown` + `remark-gfm` + `rehype-highlight`/`highlight.js` (workspace chat)
- 3D: `@react-three/fiber` + `three` are **optional deps** — used only for an abstract animated icosahedron "orb" avatar (`components/avatar/AvatarScene.jsx`, wrapped by `TalkingAvatar.jsx`). **This is NOT a photoreal/video avatar** — it's a color-pulsing 3D shape reacting to `isSpeaking`/`isListening`/amplitude.
- Voice: **browser-native** `SpeechSynthesis`/`SpeechRecognition` Web APIs (`hooks/useVoice.js`) with an **optional** server-side ElevenLabs TTS fallback (`TTS_PROVIDER=elevenlabs` env var; defaults to `browser`)
- **No test runner configured at all** on the frontend.

---

## 3. Application Architecture

**Communication:** Frontend axios client (`frontend/src/services/api.js`) → Express REST API under `/api/*`. JWT sent as `Authorization: Bearer <token>`, verified by `middleware/auth.middleware.js`'s `protect` on every router except the GitHub OAuth callback and `/api/health`.

**Auth flow:** Signup/login issue a JWT (`JWT_EXPIRES_IN`, default 7d). Google login verifies an id_token server-side via `google-auth-library`, then issues the same app JWT — Google is just an alternate credential check, not a separate session type. GitHub OAuth is entirely separate: it's initiated from an already-authenticated user (`/api/integrations/github/authorize`), and its `/callback` route is **deliberately mounted before `router.use(protect)`** because it's a browser redirect target — state is validated via a signed JWT instead.

**Interview creation flow:** Frontend wizard (`InterviewSetupPage.jsx` / `QuickInterviewPage.jsx` / NL parser) builds a config payload → `POST /api/interviews` → `interviewBlueprint.fromRequest` normalizes it (role/experience/company/mode/dsa-config/projectMode-config) → `interviewEngine.plan()` builds a `blueprint` (planned topics, type mix, breadth/balanced/depth mode) → `interviewEngine.firstQuestion()` generates Q1 via the AI provider.

**Interview execution flow (the adaptive engine):** For each answer: `POST /interviews/:id/answer/:questionIndex` → `interviewEngine.evaluateAndDecide()`:
1. Persist the answer onto the question sub-doc.
2. Score it via `ai.service.evaluateAnswer()` (multi-dimensional rubric — see §4 `answerSchema.aiFeedback`).
3. Flag response quality (`responseQuality.detect()` — vague/off-topic/memorized/etc).
4. `adaptiveEngine.updateLiveState()` — rolls up covered topics, weak/strong streaks, pacing, project-deep-dive context.
5. `adaptiveEngine.decideNext()` — picks the next action: `follow_up | revisit_weak | pivot | memorized_probe | finalize`.
6. If not finalizing, `composeQuestion()` generates the next question through the same AI pipeline, shaped by the current mode's **strategy** (§7).

Every decision is appended to `strategyLog` (capped at 30 entries) for UI/analytics transparency.

**AI request flow:** All AI calls funnel through `services/ai.service.js` → `services/aiProviderManager.js` (§6) — nothing else in the codebase calls Gemini/Groq/OpenRouter directly except `aiProviderManager.js` itself.

**Evaluation flow (DSA-specific):** `POST /interviews/:id/run` (sample stdin) and `/submit` (hidden tests) both call `judge0.service.executeOnce`/`executeSuite`, storing the latest result on `Interview.lastExecution`. On interview completion (or via `/evaluate` retry), `codeEvaluation.service.js` + `codeEvaluationPrompt.service.js` send the final code + execution result to the LLM for a structured technical evaluation (`Interview.evaluation`).

**Project/GitHub analysis flow:** `project.controller.js` creates a `Project` from a GitHub URL or repo picker → `github.service.js` fetches repo contents (OAuth token decrypted via `crypto.service.js`) → `repoAnalysis.service.js` applies a heuristic file-selection budget (40 files / 150KB) → one LLM call produces `{summary, techStack, importantFiles, architectureSummary}` → stored as a new `RepositoryAnalysis` doc (kept separate from `Project` so re-analysis doesn't clobber history; `Project` points at the latest one).

**Workspace/chat architecture:** Each `Project` can have multiple `WorkspaceChat` threads (`WorkspaceChat.model.js`), each holding ordered `WorkspaceMessage`s. `workspaceAI.service.js` orchestrates: `promptBuilder.service.js` builds a prompt grounded in the project's `RepositoryAnalysis` + chat history → `aiProviderManager` → normalized reply. The service **never persists itself** — the controller (`workspaceMessage.controller.js`) does the saving. `WorkspaceMessage.citations` field exists in the schema but is explicitly unused/reserved for a future "cite file/line" feature.

**DSA/code execution architecture:** See §8 — full detail there.

---

## 4. Database (MongoDB / Mongoose)

All models live in `backend/src/models/`. **No SQL, no Prisma** — every relationship below is a Mongoose `ref` (manual population), not a foreign key constraint.

### `User`
Auth fields + profile (`targetRole`, `targetCompany`, `experience`, `resumeUrl`/`resumeText`) + gamification (`streak`, `longestStreak`, `totalInterviews`, `badges[]`, `points`) + `savedPresets[]` / `recentConfigs[]` (ring buffer of last 5 configs, both share one `payload` shape — the same shape `POST /api/interviews` accepts) + `coachRoadmap` (24h LLM-generated cache, manual refresh endpoint) + `githubIntegration` (encrypted token, `select: false`, optional link — never required for core app use). Virtual `interviewHistory` populates `Interview` docs by `userId`. `badges` is `Mixed` to tolerate both a legacy `[String]` shape and the current `[{id, unlockedAt}]` shape — a `pre('save')` hook self-heals legacy entries; always read via `user.hasBadge(id)`, never index `badges` directly.

### `Interview` — the central, polymorphic entity
- `mode` enum: `general | project | resume | dsa | aptitude | behavioral | system_design | custom`. **Only `general`, `project`, and `dsa` actually run through the engine today** — the rest are reserved enum slots with no strategy module (see §7).
- `questions[]` — embedded `answerSchema` per question: question text/type/topic, hints, follow-up chain metadata, adaptive-engine selection metadata (`selectionReason`, `difficultyAtAsk`), conversational layer (`intent`/`transition`/`reaction`), `qualityFlags`, a rich multi-dimensional `aiFeedback` (score, technicalScore, communicationScore, confidenceScore, completenessScore, grammarScore, reasoningScore, practicalScore, **plus a stricter rubric**: `relevanceScore` as a hard gatekeeper that caps the overall score, `technicalAccuracyScore`, `implementationDepthScore`, `conceptualGroundingScore`, `mentionedConcepts`/`missingConcepts`, `responseCategory` enum, `scoreCapReason`, `rawScore`), `voiceMetrics`, and (DSA only) `hiddenTests[]`.
- `config` — `role`/`experienceLevel`/`companyType`/`interviewType`/`difficulty`/`totalQuestions` plus **mode-specific sub-objects**: `config.dsa` (topic/difficulty/language/questionCount/allowHints/focusAreas) and `config.projectMode` (immutable snapshot of the analyzed repo at interview-creation time — deliberately distinct from `liveState.projectContext`, which is the *live* detection of the candidate describing a project mid-answer).
- `blueprint` — the plan generated at creation (`totalPlanned`, breadth/balanced/depth `mode`, `plannedTopics`, `typeMix`). A guideline, not a script.
- `liveState` — the adaptive engine's mutable working memory: `currentDifficulty`, `coveredTopics`, weak/strong topic sets, `rollingAvgScore`, streak counters, `topicDepthBudget` (a `Map`), and `projectContext` (deep-dive tracking).
- `evaluation` — DSA post-hoc code evaluation result (status/scores/complexity/strengths/weaknesses/recommendations).
- `lastExecution` — snapshot of the most recent Judge0 run (only ever holds one; `/run` and `/submit` both overwrite it).
- `strategyLog[]` — capped 30-entry audit trail of engine decisions.
- `creationSource` enum (`guided | quick_ai | template | preset | recent | retry | coach`) + `sourceMetadata` (Mixed) — makes interviews reproducible ("Recreate" button) and analyzable by source.
- `retryOf` — self-reference for "Retry this question" (spawns a short new interview pointing back at the parent).
- `results` + `calculateResults()` instance method — aggregates per-question scores into a letter grade (A+ down to F).

### `Question` — static seed-question bank
Superseded by the adaptive LLM-generation pipeline for real interviews; still backs the simple `GET /api/questions` listing endpoint. Not the primary question source.

### `QuestionHistory`
Per-user asked-question log with a **hash-based** `embedding` field (see `utils/embedding.js` — this is NOT a real vector-embedding API call) used for anti-repetition similarity checks, thresholded by `SIMILARITY_THRESHOLD` env var.

### `WeakTopic`
Per-user/topic/role rolling average score. Unique index on `(userId, topic, role)`. Read by the Coach and Analytics features.

### `Project` — the "Workspace" entity
Unique per `(userId, repoOwner, repoName)`. References the **latest** `RepositoryAnalysis` by id.

### `RepositoryAnalysis`
LLM-generated repo summary, kept in its **own collection** (not embedded in `Project`) so re-analysis doesn't clobber history. Lifecycle: `processing → ready | failed`. Provenance fields: `filesRead`, `bytesRead`, `model`.

### `WorkspaceChat` / `WorkspaceMessage`
One chat thread per `Project`; messages are turn-level with a reserved-but-unused `citations[]` field and a free-form `usage` (token-count) bag.

**Relationships:** `User 1—N Interview`, `User 1—N Project`, `Project 1—N RepositoryAnalysis` (+ latest pointer), `Project 1—N WorkspaceChat 1—N WorkspaceMessage`, `Interview.config.projectMode.projectId → Project`, `Interview.retryOf.interviewId → Interview` (self-ref).

---

## 5. API Routes

All mounted under `/api/` in `backend/src/app.js`. Auth pattern: `router.use(protect)` per-router; only `/api/health` and the GitHub OAuth `/callback` bypass it.

| Base path | Router file | Notes |
|---|---|---|
| `/api/health` | inline in `app.js` | liveness check, no auth |
| `/api/auth` | `auth.routes.js` | `POST /signup`, `/login` (stricter 10/15min limiter), `POST /google`, `GET /me` (protected) |
| `/api/users` | `user.routes.js` | profile CRUD, resume upload (multer), password change, leaderboard |
| `/api/interviews` | `interview.routes.js` | **the biggest router** — see below |
| `/api/analytics` | `analytics.routes.js` | `/dashboard`, `/detailed` |
| `/api/admin` | `admin.routes.js` | `adminOnly` — stats, user list, toggle active status |
| `/api/questions` | `question.routes.js` | filtered listing of the static `Question` bank |
| `/api/tts` | `tts.routes.js` | server-side TTS synth (ElevenLabs) |
| `/api/projects` | `project.routes.js` | create from URL/GitHub, list, get, reanalyze, delete |
| `/api/integrations` | `integrations.routes.js` | GitHub OAuth: authorize/callback(unprotected)/status/disconnect/listRepos |
| `/api/recommendations` | `recommendations.routes.js` | list |
| `/api/coach` | `coach.routes.js` | get/refresh roadmap |
| `/api/presets` | `presets.routes.js` | CRUD saved interview presets |
| `/api/workspace` | `workspaceChat.routes.js` + `workspaceContext.routes.js` | **both mounted at the same `/api/workspace` prefix** — chats/messages CRUD + `GET /:projectId/context` |

**`/api/interviews` detail** (`interview.routes.js`):
```
GET  /personalities                          static personality registry
GET  /rounds                                 static round-type registry
POST /                                       create interview
POST /parse                                  NL prompt → interview draft (blueprint)
GET  /history                                list past interviews
GET  /:id                                    get one interview
POST /:interviewId/answer/:questionIndex     submit an answer → engine evaluates + decides next
POST /:interviewId/next-question             adaptive next-question (explicit trigger)
POST /:interviewId/nudge                     silence/thinking nudge handling
POST /:interviewId/hint                      DSA progressive hint (strategy-gated)
POST /:interviewId/run                       Judge0 run against sample/visible stdin
POST /:interviewId/submit                    Judge0 run against hidden tests
POST /:interviewId/evaluate                  retry the LLM code-evaluation step
POST /:interviewId/resume                    resume an in-progress session + recap
POST /:interviewId/follow-up/:questionIndex  legacy/manual follow-up generation
POST /:interviewId/complete                  finalize + calculateResults()
POST /:id/retry-question                     spawn a new short interview from one past question
PATCH /:id/abandon                           mark abandoned
```

---

## 6. AI Architecture

**Single entry point:** `backend/src/services/ai.service.js` builds prompts and calls `aiProviderManager.generate(prompt, opts)`. **Never call a provider SDK directly from anywhere else** — always go through `aiProviderManager`.

**`services/aiProviderManager.js`** (singleton, exported as an instance):
- Provider order: `[primary (AI_PROVIDER env, default 'gemini'), 'groq', 'gemini', 'openrouter']`, deduplicated, filtered to whichever have API keys configured.
- On any error matching `429|quota|rate|limit|exceeded|model.*not.*found|404`, falls through to the next provider transparently. Non-recoverable errors from one provider still try the next (logged as a warning, not fatal).
- **Gemini**: tries `gemini-1.5-flash` → `gemini-1.5-flash-8b` → `gemini-2.0-flash-lite` in order (or a caller-specified `opts.model`).
- **Groq**: tries `openai/gpt-oss-120b` → `qwen/qwen3-32b` → `llama-3.1-8b-instant`. (Comment notes Llama 3.3 70B was deprecated/decommissioned 2026-08-16 — model lists here may need periodic updating as providers retire models.)
- **OpenRouter**: tries a hardcoded list of `:free`-suffixed models (`gpt-oss-20b:free`, `llama-3.3-70b-instruct:free`, `qwen3-next-80b-a3b-instruct:free`, `glm-4.5-air:free`) via raw `fetch` — no SDK dependency.
- `groq-sdk` is an **optional** dependency (`try { require('groq-sdk') } catch { Groq = null }`) — the manager degrades gracefully if it's not installed.

**Where prompts are built:**
- `promptBuilder.service.js` — shared prompt-construction helpers (workspace chat + others)
- `interviewStrategies/*.buildPromptInsert(context)` — mode-specific prompt blocks appended to the stock question-generation prompt (see §7)
- `codeEvaluationPrompt.service.js` — DSA code-evaluation prompt
- `interviewParser.service.js` — NL "describe your interview" → structured config
- `coach.service.js` — Coach roadmap generation prompt

**Adding/modifying an AI call safely:**
1. Never bypass `aiProviderManager` — add new call sites through `ai.service.js` (or a new sibling service that itself calls `aiProviderManager.generate`).
2. Keep prompts returning **parseable JSON** where the caller expects structured output (question generation, evaluation) — the existing prompts are strict about "output ONLY JSON" / "output ONLY the hint text" instructions; follow that pattern for new prompts to avoid parsing failures across 3 different model families.
3. Respect the model-fallback lists above; if a model is deprecated, update the list rather than special-casing around it.
4. The **interview engine, blueprint service, and adaptive engine are explicitly protected** per the README: *"Please don't touch the interview engine, blueprint service, or adaptive engine without opening an issue first."* Treat `interviewEngine.js`, `adaptiveEngine.js`, and `blueprint.service.js` as stable APIs — extend via the strategy pattern (§7) rather than editing their internals when possible.

---

## 7. Interview Architecture — Modes & Strategy Pattern

The engine is **mode-agnostic by design**. `backend/src/services/interviewStrategies/index.js` resolves `interview.mode` → a strategy module via `getStrategy(mode)`, falling through to `default.strategy.js` (a no-op) for any mode without a real strategy. The engine (`interviewEngine.js`) consults the strategy at exactly three points: seeding the first question's decision, augmenting the AI generation context every turn, and (DSA only, currently) hint generation.

```js
// backend/src/services/interviewStrategies/index.js
const STRATEGIES = {
  dsa: dsaStrategy,
  // behavioral, aptitude, system_design plug in here when built
};
```

**Frontend gating:** `frontend/src/data/interviewTypes.js` is the single source of truth for which modes are clickable on the Interview Hub. Each entry has `enabled: true/false` — flipping a mode on is a one-line change **there**, but it does nothing useful until a matching backend strategy exists.

### Mode-by-mode status

| Mode | Backend strategy | Frontend card | Status |
|---|---|---|---|
| `general` | `default.strategy.js` (no-op — pure adaptive engine behavior) | enabled | **Fully implemented** |
| `project` | `default.strategy.js` + `config.projectMode` snapshot + `projectDeepDive.js` live detection | enabled (via Workspace → "Interview about this project") | **Fully implemented** |
| `resume` | `default.strategy.js` (uses `config.useResume`/resume text as grounding, no dedicated strategy) | enabled | **Implemented** (rides the default strategy — resume grounding happens via config/context, not a mode-specific strategy) |
| `custom` | `default.strategy.js` + `interviewParser.service.js` (NL prompt → blueprint) | enabled | **Implemented** |
| `dsa` | `dsaInterview.strategy.js` | enabled | **Implemented, with one known gap** — see §8 |
| `aptitude` | **none** — falls through to `default.strategy.js` | `enabled: false`, `actionLabel: 'Coming Soon'` | **Not implemented.** Only a reserved `mode` enum value and a "Coming Soon" UI card exist. |
| `behavioral` | **none** — falls through to `default.strategy.js` | `enabled: false`, `actionLabel: 'Coming Soon'` | **Not implemented** as a distinct mode. Note: `questionType: 'behavioral'` already exists as a value on general/mixed interviews (STAR-style questions can already occur within a `general` interview's type mix) — what's missing is a **dedicated mode** with its own strategy (e.g. STAR-structure enforcement, a behavioral-specific evaluation rubric). |
| `system_design` | **none** — falls through to `default.strategy.js` | `enabled: false`, `actionLabel: 'Coming Soon'` | **Not implemented.** Same note as behavioral — `questionType: 'system_design'` already exists as a value, but there's no dedicated mode/strategy. |

**To ship a new mode** (e.g. `behavioral`), the established pattern (proven by DSA) is:
1. Add a `<mode>.strategy.js` in `backend/src/services/interviewStrategies/` implementing `seedDecision`, `augmentGenContext`, `buildPromptInsert`, `hintAvailable`, `seedHiddenTests` (copy `default.strategy.js` as the skeleton; only override what the mode actually needs — DSA's strategy shows the full pattern, `default.strategy.js` shows the minimal no-op contract).
2. Register it in `interviewStrategies/index.js`'s `STRATEGIES` map.
3. Flip `enabled: true` and set a real `actionLabel`/handler in `frontend/src/data/interviewTypes.js`.
4. If the mode needs its own config shape (like `config.dsa`), add a sub-object to `Interview.model.js`'s `config` and validate it in `interviewBlueprint.js` (constants belong in a new `backend/src/constants/<mode>.js` file, following `constants/dsa.js`'s pattern — single source of truth for topic/option lists).
5. If the mode needs a config UI step, follow `InterviewSetupPage.jsx`'s existing DSA branch (`isDsa = config.mode === 'dsa'` gates a dedicated `DSAConfigurationCard`) as the template.

---

## 8. DSA Engine — Detailed

**Topics:** 30 canonical topics in `backend/src/constants/dsa.js` (`DSA_TOPICS`) — Arrays, Strings, Linked List, Stack, Queue, Hashing, Trees, BSTs, Heap, Trie, Graphs, DP, Greedy, Backtracking, Recursion, Binary Search, Sliding Window, Two Pointers, Bit Manipulation, Math, Sorting, Searching, Intervals, Prefix Sum, Monotonic Stack/Queue, Union Find, Segment Tree, Fenwick Tree, Advanced Graphs.

**Difficulty:** `easy | medium | hard | mixed`. `mixed` is a **blueprint-level intent** — `dsaInterview.strategy.js`'s `resolveDifficulty()` climbs an `[easy, medium, hard]` ladder across the question set (thirds-based bucketing, with guards for tiny question counts).

**Languages:** 9 supported, defined once in `constants/dsa.js` (`DSA_LANGUAGES`) and mapped to Judge0 numeric IDs in `constants/judge0Languages.js`: cpp(54), java(62), python(71), javascript(63), typescript(74), go(60), rust(73), csharp(51), kotlin(78). **Never hardcode a Judge0 language ID anywhere else** — always go through `getLanguageId()`.

**Configuration:** `Interview.config.dsa = { topic, difficulty, questionCount, language, allowHints, focusAreas[] }`, set at creation via `InterviewSetupPage.jsx`'s `DSAConfigurationCard` (gated by `config.mode === 'dsa'`).

**Strategy** (`interviewStrategies/dsaInterview.strategy.js`): DSA questions are **discussion-based, not code-editor-based, at the question-generation stage** — the LLM prompt explicitly says "there is NO code editor [for this question]... ask them to explain the algorithm... never ask them to paste working code." The actual coding happens separately in the Coding Workspace UI (below); the *interview conversation* itself is verbal/text reasoning about approach, complexity, and edge cases, with progressive hints (`buildHintPrompt` — 3 escalating specificity levels: gentle nudge → named paradigm → concrete data structure).

**Coding Workspace (frontend):** `frontend/src/components/interview/coding/` — `CodingWorkspace.jsx` (container), `SplitWorkspace.jsx` (editor/output split pane), `CodeEditor.jsx` (Monaco wrapper), `EditorToolbar.jsx`, `LanguageSelector.jsx`, `OutputPanel.jsx`, `TestCasePanel.jsx`, `ExecutionStatus.jsx`, `ResetCodeDialog.jsx`, `storage.js` (local persistence of in-progress code so a refresh doesn't lose work).

**Judge0 integration** (`backend/src/services/judge0.service.js`):
- Provider-agnostic HTTP wrapper, zero framework dependencies. Reads `JUDGE0_URL` (required) and `JUDGE0_API_KEY` (optional) from `process.env` **at call time**, not import time.
- **Async-only** — submits with `wait=false` then polls every 500ms up to a 10s budget (`POLL_INTERVAL_MS`/`POLL_MAX_MS`). Deliberately avoids Judge0's synchronous `wait=true` mode because some deployments disable it and RapidAPI rate-limits it.
- Guardrails sent per submission: 3s CPU limit, 5s wall limit, 128MB memory, 64MB stack, 100KB max source, 20KB max stdin.
- Normalizes Judge0's numeric `status.id` (1–14) into a small set of string statuses (`queued|running|success|wrong_answer|timeout|compilation_error|runtime_error|internal_error|network_error|config_error|unsupported_language|empty_source|source_too_large`) — **the frontend never sees raw Judge0 fields.**
- `executeOnce()` — single run. `executeSuite()` — sequential run against multiple test cases (used by both `/run` and `/submit`); short-circuits remaining tests on a compilation error.

**`/run` vs `/submit`:**
- `POST /interviews/:id/run` — executes against **visible/sample** stdin the candidate is working with in the editor. Result stored on `Interview.lastExecution` (`kind: 'run'`).
- `POST /interviews/:id/submit` — executes against **hidden tests** (`question.hiddenTests[]`). Result stored on `Interview.lastExecution` (`kind: 'submit'`, plus `passed`/`total` counts).

**⚠️ KNOWN GAP — hidden tests are not real correctness checks.** `dsaInterview.strategy.js`'s `seedHiddenTests()` (the function that attaches hidden tests to a newly-generated DSA question) returns **3 static entries with empty `expectedOutput` strings** — a hardcoded "echo my stdin" mock suite. The code comment is explicit: *"we can't derive real tests from the AI-generated problem text... Commit 5+ can replace this with AI-generated tests derived from the problem statement without changing the storage shape or /submit flow — only this function changes."* **Practical implication: `/submit` today cannot actually verify a candidate's solution is correct** — it only confirms the program ran and echoed input without crashing. Fixing this means changing `seedHiddenTests()` (and likely having the question-generation prompt also emit test cases) — the storage shape (`hiddenTests: [{stdin, expectedOutput, label}]`) and the `/submit` route don't need to change.

**Evaluation:** `codeEvaluation.service.js` + `codeEvaluationPrompt.service.js` send the final source + last execution result to the LLM for a structured post-hoc review — scores for correctness/algorithm/timeComplexity/spaceComplexity/codeQuality/communication/edgeCases, plus complexity analysis (`estimated` vs `confirmed`), strengths/weaknesses, and topic/problem/concept recommendations. Stored on `Interview.evaluation`. Retriable via `POST /interviews/:id/evaluate` without re-running Judge0 (source + execution result are preserved).

---

## 9. Existing Features (verified in code, not assumed from docs)

- Voice-driven interviews (browser Speech Recognition/Synthesis) with filler-word detection, WPM calculation, pace classification (`useVoice.js`)
- Adaptive question engine: follow-ups, weak-topic revisits, topic pivots, memorized-answer probing, project deep-dive drilling (architecture → tradeoffs → scale → failures axes)
- DSA coding interviews with Monaco editor + Judge0 execution + LLM code evaluation (correctness caveat above)
- Repository-aware workspace chat grounded in GitHub repo analysis, with markdown rendering and regenerate
- NL "describe your interview" → structured interview blueprint (`POST /interviews/parse`)
- Saved presets + recent-configs ring buffer for reusing past interview setups
- Analytics dashboard (skill radar, topic breakdown, per-question replay)
- AI Coach roadmap (24h cache, manual refresh)
- Achievements/badges system with self-healing legacy data shape
- Global command palette (⌘K / Ctrl+K)
- "Retry this question" — spawns a short lineage-linked interview from one past question
- Interview resume — recap + continue an in-progress session
- Admin panel (user stats, toggle active status) gated by `role: 'admin'`

---

## 10. Development Conventions

- **Naming:** files are `camelCase.service.js` / `PascalCase.model.js` / `camelCase.controller.js` / `camelCase.routes.js` in the backend; React components are `PascalCase.jsx`, hooks are `useCamelCase.js`.
- **Backend layering is strict:** routes → controllers (thin, HTTP-shape only) → services (all business logic) → models. Controllers should not contain business logic; if you're tempted to add an `if` that isn't about request/response shape, it belongs in a service.
- **Constants live in `backend/src/constants/`** as the single source of truth (see `dsa.js`, `judge0Languages.js`) — never duplicate an enum/option list inline elsewhere; import it.
- **The strategy pattern is the extension point for interview modes** (§7) — new mode-specific behavior goes in a new strategy file, not as `if (mode === 'x')` branches sprinkled through `interviewEngine.js`/`adaptiveEngine.js`.
- **Schemas favor `Mixed` + defensive normalization over migrations** for fields expected to evolve (`sourceMetadata`, `badges`, `coachRoadmap.items`, `savedPresets.payload`) — see `User.model.js`'s `pre('save')` badge-normalization hook as the template for "self-healing" data shape changes.
- **Mongoose sub-documents over new collections** when data is always read alongside its parent and small (badges, presets, recentConfigs); **separate collections** when data can grow unbounded or needs independent lifecycle (`RepositoryAnalysis` kept separate from `Project` specifically so re-analysis doesn't clobber history).
- **AI service functions return parseable JSON strings** that callers `JSON.parse()` — prompts are written with explicit "output ONLY JSON, no markdown fences" instructions. Keep this contract when adding new AI-backed features.
- **Optional dependencies are used for genuinely optional features** (`groq-sdk`, `@react-three/fiber`/`three`) via `try { require(...) } catch { ... = null }` — the app must degrade gracefully, not crash, when these are absent.
- **Frontend routing:** every page is lazy-loaded in `App.jsx`; protected pages wrap in `<ProtectedRoute>`, admin-only pages add `adminOnly`.
- **Error handling (backend):** centralized `middleware/errorHandler.js` + `notFound.js` at the end of the middleware chain in `app.js`. Services generally return **normalized result objects** rather than throwing for expected failure modes (see `judge0.service.js`'s `errorResult()` pattern) — throwing is reserved for genuinely unexpected/programmer errors.
- **CORS is a hardcoded allowlist** in `app.js` (localhost variants + any `*.vercel.app`), not purely env-driven — deploying to a non-Vercel, non-localhost host requires a source edit, not just an env var.

---

## 11. Rules for Claude

1. **Inspect existing code before modifying it.** This file is a map, not a replacement for reading the actual file you're about to touch — models and services here evolve; verify current shape first.
2. **Do not rewrite working architecture unnecessarily.** The interview engine, adaptive engine, and blueprint service are explicitly protected by the project's own README ("please don't touch... without opening an issue first"). Extend via the strategy pattern (§7) rather than editing their internals.
3. **Reuse existing components/services/utilities.** Check `constants/`, `services/`, `data/` (frontend), and `hooks/` for something that already does what you need before writing new code — this codebase has a strong "single source of truth" convention (see `constants/dsa.js`).
4. **Maintain backward compatibility.** Many schema fields exist specifically to keep old documents working unchanged (`mode` defaults to `'general'`, `adaptive` defaults to `false`, badge self-healing). Don't remove a default or tighten a required field without checking what legacy data would break.
5. **Do not introduce a new library when an existing dependency already solves the problem.** E.g. don't add Redux/Zustand (Context is the established pattern here), don't add a new HTTP client (axios is already wired in `services/api.js`), don't add a new AI SDK (extend `aiProviderManager.js`).
6. **Do not modify unrelated files.** Keep diffs scoped to the feature/fix at hand.
7. **Do not remove existing functionality without explicit instruction.** If something looks unused or half-finished (e.g. `WorkspaceMessage.citations`), assume it's an intentional placeholder for future work unless told otherwise.
8. **Follow the existing project patterns** documented in §10 — layering, naming, constants-as-single-source-of-truth, Mixed+normalization over migrations.
9. **After changes, verify affected code and explain what was changed.** Since there's no test suite, manual verification (tracing the actual call path, checking the affected route/component) is the only safety net — be thorough.
10. **Never hardcode secrets or write real env values into this file or commit them.** When you discover a new required env var, document its *name and purpose* in §12, never its value.

---

## 12. Environment / Configuration

**Documented in `backend/.env.example`:** `PORT`, `NODE_ENV`, `MONGODB_URI` (MongoDB connection string), `JWT_SECRET`, `JWT_EXPIRES_IN`, `AI_PROVIDER` (`gemini|groq|openrouter` — sets fallback order priority), `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `SIMILARITY_THRESHOLD` (anti-repetition dedup threshold, default 0.78), `FRONTEND_URL` (CORS), `MAX_FILE_SIZE`, `UPLOAD_DIR`, `TTS_PROVIDER` (`browser|elevenlabs`), `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `GOOGLE_CLIENT_ID`.

**Read by code / documented in README, but MISSING from `backend/.env.example`** (fix this if you touch env setup — see §14):
- `JUDGE0_URL` — base URL of a Judge0 CE instance; required for DSA code execution (`run`/`submit`) to work at all.
- `JUDGE0_API_KEY` — optional; sent as both `X-RapidAPI-Key` and `X-Auth-Token` headers.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth App credentials, for linking a GitHub account (private repo import).
- `GITHUB_OAUTH_REDIRECT_URI` — e.g. `http://localhost:5000/api/integrations/github/callback`.
- `GITHUB_TOKEN_ENCRYPTION_KEY` — 64-hex-char AES-256-GCM key for encrypting stored GitHub tokens.

**Frontend `.env.example`** documents only `VITE_API_URL`; README additionally documents `VITE_GOOGLE_CLIENT_ID` (also missing from the example file).

---

## 13. Development Workflow / Commands

From the **repo root**:
```bash
npm run install:all      # installs both backend/ and frontend/ deps
npm run dev:backend      # cd backend && npm run dev   (nodemon, needs backend/.env)
npm run dev:frontend     # cd frontend && npm run dev  (vite, needs frontend/.env)
npm run build:frontend   # cd frontend && npm run build
```

**Backend only** (from `backend/`): `npm start` (plain node), `npm run dev` (nodemon), `npm test` (⚠️ declared but non-functional — no jest devDependency, no test files).

**Frontend only** (from `frontend/`): `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` (ESLint, `--max-warnings 0` — CI-strict).

**Running DSA features locally requires a Judge0 instance** — either self-hosted (Docker: `judge0/judge0` images) or a RapidAPI-hosted one, with `JUDGE0_URL`/`JUDGE0_API_KEY` set (not in the example file yet — see §12).

**Deploy targets:** both `backend/vercel.json` and `backend/render.yaml` exist — this app has been deployed to (or configured for) both Vercel and Render.

---

## 14. Project Roadmap — Actual State vs. README

The `README.md` roadmap table (lines ~353–375) is **stale** — it lists Sprints 5–7 as "🚀 Planned," but git history and this audit confirm they have substantially shipped. Use the table below, not the README's, as the source of truth.

| Sprint | Focus | Status | What's implemented | What remains |
|---|---|---|---|---|
| **1** | Auth, Dashboard, Basic Interview Flow | ✅ **COMPLETED** | JWT + Google OAuth auth, Dashboard, `/interviews` entry flow, general adaptive interview loop | — |
| **2** | Projects, GitHub Integration, Repo Analysis, Workspace | ✅ **COMPLETED** | GitHub OAuth linking, public-URL + private-repo analysis, `Project`/`RepositoryAnalysis` models, Workspace shell, project-mode interviews with deep-dive detection | — |
| **3** | Skill Graph, Replay, Recommendations, Continue Learning, Streaks, Profile | ✅ **COMPLETED** | `WeakTopic` tracking, per-question retry (`retryOf` lineage), `recommendations.service.js`, streak tracking on `User`, Profile page | — |
| **4** | AI Coach, Achievements, Global Search | ✅ **COMPLETED** | `coach.service.js` + 24h-cached roadmap, achievements registry + self-healing badges, CommandPalette (⌘K) | — |
| **5** | Interview Blueprint, Hub, Multiple Modes, Guided/Quick Setup, NL Parser, Review, Templates, Presets, Recent Configs | ✅ **COMPLETED** (for the modes it targets) | `blueprint.service.js`, `InterviewHubPage`, `interviewParser.service.js` (NL → draft), `savedPresets`/`recentConfigs` on `User`, mode enum widened to reserve all 7 slots | The "multiple interview modes" part only materialized for `dsa` (Sprint 7) — `aptitude`/`behavioral`/`system_design` remain enum-only |
| **6** | Workspace Chat | ✅ **COMPLETED** | `WorkspaceChat`/`WorkspaceMessage` models, full chat CRUD + regenerate, repo-grounded prompting, markdown rendering UI | `citations` field reserved/unused — no "cite file/line" feature yet |
| **7** | DSA + Aptitude + Live Coding | 🟡 **PARTIALLY IMPLEMENTED** | DSA: strategy, Monaco coding workspace, Judge0 run/submit, LLM code evaluation, hints — all wired end-to-end | **Aptitude has no implementation at all** (no strategy, no question bank, no UI beyond the disabled card). **DSA hidden-test correctness is a known mock/stopgap** (§8) — `/submit` doesn't truly validate solutions yet. |
| **8** | Behavioral + System Design + Core CS | ⭕ **PLANNED** | `mode` enum reserves the slots; `questionType` enum already includes `behavioral`/`system_design` as values usable within general/mixed interviews | No dedicated strategy module, no mode-specific UI enablement, no mode-specific evaluation rubric for either |
| **9** | Full Mock Interview / Recruiter-style Simulation | ⭕ **PLANNED** | — | Everything |
| **10** | Advanced Repository Intelligence | ⭕ **PLANNED** | Base repo analysis (Sprint 2) exists as a foundation | Deeper intelligence features (e.g. workspace health, README generation, architecture diagrams — per README's Sprint 10+ list) not started |
| **11+** | AI Career Suite / advanced career features | ⭕ **PLANNED** | — | Everything (JD Analyzer, Resume Builder, Security Audit, Public Sharing, mobile nav — per README) |

---

## 15. Current Development State

**Version:** `1.0.0` (per both root and sub-package `package.json`; also hardcoded in the `/api/health` response — bump this if you do a real version cut).

**Git branch at last audit:** `feature/interview-analytics` (recent commits: "DSA Interview Platform", "repository-aware workspace chat", "SPRINT 5 - INTERVIEW BLUEPRINT"). This suggests active work is currently oriented around **finishing Sprint 7 (DSA correctness) and building out interview analytics** — check `git log` and `git status` for the true current state, since this file is a point-in-time snapshot.

**What's solid and shouldn't need rework:** the adaptive engine, the strategy pattern, auth, project/workspace analysis, workspace chat, analytics/coach/achievements. Build on these, don't rebuild them.

**Highest-leverage next tasks, roughly in order of impact vs. effort:**
1. **Fix DSA hidden-test correctness** (§8) — the most user-visible functional gap in an already-shipped feature. Requires changing `seedHiddenTests()` in `dsaInterview.strategy.js` (and likely extending the question-generation prompt to also emit real test cases) without touching the `/submit` route or storage shape.
2. **Document the missing env vars** (§12) in `backend/.env.example` — `JUDGE0_URL`, `JUDGE0_API_KEY`, and the four GitHub OAuth vars — low effort, unblocks anyone setting up the DSA feature or GitHub integration from scratch.
3. **Ship one new interview mode** to close a Sprint 8 gap — of `aptitude`/`behavioral`/`system_design`, **behavioral is the most tractable first target**: it can reuse the existing conversational adaptive engine almost as-is (no new UI paradigm like Monaco/Judge0 needed, unlike system_design's likely need for diagramming or aptitude's need for a structured question bank + different scoring). Follow the strategy-pattern recipe in §7.
4. Update `README.md`'s roadmap table to match §14 of this file — it currently undersells what's shipped.
5. Consider adding a minimal backend test suite (`jest` is already declared as a script) — there is currently zero automated test coverage, which makes "verify affected code" (Rule 9, §11) purely manual.

**Files to inspect before continuing work on...**
- **the adaptive engine / question flow:** `backend/src/services/interviewEngine.js`, `adaptiveEngine.js`, `ai.service.js`, `blueprint.service.js`
- **a new interview mode:** `backend/src/services/interviewStrategies/index.js`, `dsaInterview.strategy.js` (as the fullest example), `default.strategy.js` (as the minimal contract), `frontend/src/data/interviewTypes.js`, `backend/src/models/Interview.model.js` (`mode`/`config` fields)
- **DSA/Judge0:** `backend/src/services/judge0.service.js`, `interviewStrategies/dsaInterview.strategy.js`, `constants/dsa.js`, `constants/judge0Languages.js`, `frontend/src/components/interview/coding/*`
- **workspace chat:** `backend/src/services/workspaceAI.service.js`, `promptBuilder.service.js`, `frontend/src/pages/WorkspaceChatPage.jsx`
- **AI provider behavior:** `backend/src/services/aiProviderManager.js` (model lists may need periodic updates as providers deprecate models)
