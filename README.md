<div align="center">

# 🎙️ InterviewAI

### AI‑Powered Interview Preparation Platform

Practice real interviews. Get grounded in your own code. Watch yourself improve.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-6-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![AI](https://img.shields.io/badge/AI-Gemini%20%C2%B7%20Groq%20%C2%B7%20OpenRouter-8A2BE2)](#-ai-runtime)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Version-1.0.0-brightgreen)](#-roadmap)
[![PRs](https://img.shields.io/badge/PRs-welcome-orange.svg)](#-contributing)

</div>

---

## 📖 Overview

**InterviewAI** is a full‑stack platform that turns interview prep from a solo grind into a personalized, measurable practice loop. It combines seven capabilities most tools ship separately:

- 🎤 **AI Mock Interviews** — voice or text, adaptive question generation, multiple interviewer personalities
- 📄 **Resume Intelligence** — upload a resume, get questions tailored to *your* experience
- 🐙 **Project Intelligence** — connect a GitHub repo, get interviews grounded in *your* code
- 🧠 **Personalized Feedback** — per‑question critique with strengths, weaknesses, and a model answer
- 🧭 **AI Coach** — a generated roadmap of what to practice next, refreshed on demand
- 📊 **Analytics** — skill radar, weak‑topic tracking, per‑type breakdown, streaks
- 🏆 **Progress Tracking** — retryable questions, achievements, streaks, and interview replay

### The problem it solves

Interview prep is fragmented. LeetCode teaches DSA. Mock services teach behavioral. Career coaches cost money. Nothing ties your **projects**, your **weak spots**, and your **feedback** together into *"what should I practice next?"* — InterviewAI does.

<div align="center">

**Practice → Feedback → Coach recommends → Retry → Watch your radar move.**

</div>

---

## ✨ Features

### 🎤 AI Interviews
- Voice-first interview experience (Web Speech + ElevenLabs TTS fallback)
- Adaptive engine that reads your answer and decides the next question live
- Follow‑up chains, topic pivots, difficulty ramping
- Multiple interviewer personalities (friendly PM, rigorous FAANG engineer, hiring manager, etc.)
- Pressure levels: relaxed / standard / intense
- Company‑specific tuning (FAANG, product‑based, startup, service‑based)
- 6 roles: Frontend / Backend / Full Stack / SDE / Data Analyst / HR
- Silence handling and conversational reactions

### 📄 Resume Intelligence
- PDF / TXT upload with resume parsing
- Personalized questions drawn from *your* resume content
- Optional per‑interview toggle — use it when it helps, skip when it doesn't

### 🐙 Project Intelligence (GitHub)
- Paste any public repo URL, **or** connect GitHub OAuth for private repos
- Heuristic repo analysis (top 40 files / 150 KB, quality over completeness)
- Auto‑detected **tech stack**, **architecture summary**, and **key files**
- Project interviews: *Architecture*, *Debugging*, *Code Review* sub‑modes
- Every project interview is grounded in a snapshot of your repo — reproducible scoring

### 🧠 AI Coach
- Personalized 3–5 focus areas generated from your data
- Each focus area carries actionable next‑steps (Practice, Retry, Review, Continue)
- 24h server‑side cache with manual refresh
- Preview card on the Dashboard for the top focus of the day

### 📊 Analytics & Progress
- **Skill Radar** — Technical, Communication, Confidence, Completeness, Grammar
- **Weak Topic Detection** — tracks per‑topic averages across all sessions
- **Interview History** — filterable, badged (general vs project)
- **Score Trends** — overall + per‑type averages
- **Streaks** — current, longest, last active

### 🏆 Achievements & Retry
- Ten seeded achievements across Getting Started / Consistency / Mastery
- Unlock toasts on interview completion + project creation
- "Retry this question" per past question — creates a new short interview seeded from the same topic
- Retry lineage preserved so results replay as *"Retried from …"*

### 🗂️ Workspace
- Per‑project detail view with Overview, Files, and Interviews tabs
- Tech stack chips, architecture summary, key files list
- Re‑analyze button for updated repos
- Every past interview for the project one click away

### 🔎 Global Command Palette
- ⌘K / Ctrl+K opens a fuzzy‑match palette anywhere in the app
- Searches sessions, projects, help entries, and nav
- Quick‑start actions (Backend interview, System Design, etc.)
- Contextually gated — only shows actions you can actually take

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 · Vite 5 · React Router v6 · Tailwind CSS 3 · Framer Motion · Recharts · Lucide |
| **Backend** | Node.js 18+ · Express 4 · Mongoose 8 |
| **Database** | MongoDB (Atlas or self‑hosted) |
| **AI Runtime** | Gemini · Groq · OpenRouter (multi‑provider fallback) |
| **Voice** | Web SpeechSynthesis · SpeechRecognition · ElevenLabs (optional) |
| **Auth** | JWT · Google OAuth 2.0 · GitHub OAuth (linked account, not login) |
| **Security** | Helmet · bcryptjs · express‑rate‑limit · AES‑256‑GCM (token encryption) |
| **Deploy‑Ready** | Vercel · Render · any Node host |
| **Dev Tools** | ESLint · Nodemon · Jest |

---

## 🏗️ Architecture

```
                     ┌───────────────────────────────┐
                     │        React SPA (Vite)       │
                     │  Dashboard · Interviews ·     │
                     │  Projects · Coach · ⌘K palette│
                     └──────────────┬────────────────┘
                                    │  JWT
                                    ▼
┌─────────────────┐         ┌───────────────────────┐         ┌─────────────────┐
│   GitHub API    │◄────────┤   Express API (Node)  │────────►│  AI Providers   │
│  OAuth + Repos  │         │  Auth · Interviews ·  │         │ Gemini · Groq · │
└─────────────────┘         │  Projects · Coach ·   │         │ OpenRouter      │
                            │  Achievements         │         └─────────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │    MongoDB    │
                            │ Users · Runs ·│
                            │ Projects ·    │
                            │ WeakTopics ·  │
                            │ Analyses      │
                            └───────────────┘
```

### How an interview is generated

1. **Blueprint** — the engine plans a topic mix from the user's role, company, and past weak topics
2. **First question** — the AI service composes it with persona + pressure + round hints
3. **Answer** — user replies via voice or text; voice metrics extracted (WPM, fillers, pace)
4. **Evaluation** — LLM scores relevance, accuracy, depth, communication, and extracts concepts
5. **Next question** — the adaptive engine reads live state (last score, weak/strong topics, pacing) and picks: follow‑up, revisit weak area, pivot topic, or memorized probe
6. **Completion** — overall feedback + closing line + achievement evaluation + WeakTopic update

### How a project analysis works

1. Repo tree fetched via GitHub API (authenticated when possible for higher rate limits)
2. Heuristic file selection — priority filenames (README, manifests, configs) + priority folders (`src/`, `app/`, `lib/`, `routes/`, `hooks/`)
3. Hard budget: **40 files or 150 KB**, whichever hits first
4. Single LLM call returns `{ summary, techStack, importantFiles, architectureSummary }`
5. Persisted to a separate `RepositoryAnalysis` document so re‑analyzing doesn't clobber history

---

## 📸 Screenshots

<details>
<summary><b>Click to view screenshots</b></summary>

### Dashboard
> Action‑oriented home. *"What would you like to do today?"* + Coach preview + Continue Learning rail + recent activity.

`![Dashboard](docs/screenshots/dashboard.png)`

### Live Interview
> Voice‑first, minimal chrome, real‑time transcript, personality‑driven interviewer.

`![Interview](docs/screenshots/interview.png)`

### Workspace
> Per‑project overview with tech stack, architecture summary, and key files.

`![Workspace](docs/screenshots/workspace.png)`

### AI Coach
> Generated focus areas with actionable next steps.

`![Coach](docs/screenshots/coach.png)`

### Analytics
> Skill radar, weak topics, per‑type averages, streaks.

`![Analytics](docs/screenshots/analytics.png)`

### Profile — Achievements
> Ten seeded badges across three categories, unlock timestamps.

`![Profile](docs/screenshots/profile.png)`

</details>

---

## 📁 Project Structure

<details>
<summary><b>Expand tree</b></summary>

```
InterviewAI/
├── backend/
│   ├── src/
│   │   ├── controllers/     # auth, interview, project, coach, integrations, achievements
│   │   ├── models/          # User, Interview, Project, RepositoryAnalysis, WeakTopic, QuestionHistory
│   │   ├── routes/          # /auth /interviews /projects /coach /integrations /recommendations …
│   │   ├── services/
│   │   │   ├── ai.service.js
│   │   │   ├── aiProviderManager.js       # multi-provider fallback
│   │   │   ├── adaptiveEngine.js          # next-question decision engine
│   │   │   ├── blueprint.service.js       # interview plan
│   │   │   ├── conversationStyle.js
│   │   │   ├── coach.service.js           # roadmap generation
│   │   │   ├── coachActions.js
│   │   │   ├── github.service.js          # thin GitHub REST wrapper
│   │   │   ├── repoAnalysis.service.js    # heuristic repo analyzer
│   │   │   ├── crypto.service.js          # AES-256-GCM token encryption
│   │   │   ├── achievements/              # registry + evaluator
│   │   │   ├── personalities.js
│   │   │   ├── pacing.js
│   │   │   ├── responseQuality.js
│   │   │   └── topicGraph.js
│   │   ├── middleware/      # auth, rate limit, error handler
│   │   └── utils/           # db connection
│   ├── package.json
│   └── vercel.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Interviews, Interview, Results, Projects, Workspace, Coach, Profile, …
│   │   ├── components/
│   │   │   ├── common/      # ActionCard, SectionHeader, EmptyState, Panel
│   │   │   ├── dashboard/   # Hero, PrimaryActions, CoachPreview, ContinueLearning, RecentInterviews, RecentProjects, AnalyticsPreview
│   │   │   ├── interview/
│   │   │   ├── projects/    # RepoUrlForm, GitHubRepoPicker, WorkspaceTabs, FilesTab, InterviewsTab, TechStackChips, …
│   │   │   ├── coach/       # FocusAreaCard
│   │   │   ├── profile/     # ProgressTab, AchievementsTab
│   │   │   ├── results/     # ResultsHeader, VerdictStrip
│   │   │   ├── analytics/   # SkillRadar, TopicBreakdown
│   │   │   ├── search/      # CommandPalette
│   │   │   ├── settings/    # GitHubConnectionCard
│   │   │   └── layout/      # Navbar
│   │   ├── context/         # AuthContext, SearchContext
│   │   ├── data/            # achievements registry (client-safe)
│   │   ├── hooks/           # useHotkey, useVoice
│   │   ├── services/        # api, coachActions, badgeUnlocks, tts
│   │   └── styles/          # globals.css
│   ├── package.json
│   └── vercel.json
│
├── package.json
├── setup.sh
└── README.md
```

</details>

---

## 🚀 Installation

### Prerequisites

- Node.js **18+**
- MongoDB (local or Atlas)
- At least one AI provider key: **Gemini** (free tier) or **Groq** or **OpenRouter**

### 1. Clone

```bash
git clone https://github.com/<your-username>/InterviewAI.git
cd InterviewAI
```

### 2. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Environment variables

Create `backend/.env` and `frontend/.env` — see [Environment Variables](#-environment-variables) below.

### 4. Run

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open `http://localhost:5173`, sign up, and you're in.

---

## 🔐 Environment Variables

<details>
<summary><b>Backend — <code>backend/.env</code></b></summary>

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | ❌ | Server port (default `5000`) |
| `NODE_ENV` | ❌ | `development` / `production` |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Signing secret for JWTs |
| `JWT_EXPIRES_IN` | ❌ | Token TTL (default `7d`) |
| `FRONTEND_URL` | ✅ | For CORS + OAuth redirect (`http://localhost:5173` in dev) |
| `AI_PROVIDER` | ❌ | Primary provider — `gemini` / `groq` / `openrouter` |
| `GEMINI_API_KEY` | ⭐ | Google Generative AI key (recommended free tier) |
| `GROQ_API_KEY` | ⭐ | Groq API key |
| `OPENROUTER_API_KEY` | ⭐ | OpenRouter key |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth login (optional) |
| `GITHUB_CLIENT_ID` | 🐙 | GitHub OAuth App client id (for private repos) |
| `GITHUB_CLIENT_SECRET` | 🐙 | GitHub OAuth App secret |
| `GITHUB_OAUTH_REDIRECT_URI` | 🐙 | e.g. `http://localhost:5000/api/integrations/github/callback` |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | 🐙 | 64‑hex‑char key — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ELEVENLABS_API_KEY` | ❌ | Server‑side TTS (falls back to browser if absent) |

**Legend:** ✅ required · ⭐ at least one AI provider required · 🐙 required only for GitHub integration · ❌ optional

</details>

<details>
<summary><b>Frontend — <code>frontend/.env</code></b></summary>

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | ❌ | Backend base URL (default `/api`, use full URL when deployed) |
| `VITE_GOOGLE_CLIENT_ID` | ❌ | Google OAuth client id for the login button |

</details>

---

## 🗺️ Roadmap

### ✅ Shipped — Version 1.0.0

| Sprint | Focus | Highlights |
|---|---|---|
| **Sprint 1** | Foundation & IA | Action‑oriented Dashboard, sidebar‑style nav, `/interviews` entry flow, `/projects` module UI |
| **Sprint 2** | Projects as first‑class | GitHub OAuth, public‑URL analysis, Workspace shell, Project Interview sub‑modes |
| **Sprint 3** | The Improvement Loop | Skill Radar, Weak‑topic breakdown, Recommendations engine, Continue Learning rail, per‑question Retry, merged Feedback + Replay |
| **Sprint 4** | Coach · Achievements · Search | AI Coach roadmap, 10 achievements, unlock toasts, global ⌘K command palette, unified CoachAction vocabulary |

### 🚀 Planned

| Sprint | Focus |
|---|---|
| **Sprint 5** | Interview Platform Refactor |
| **Sprint 6** | Workspace Chat — AI grounded in repo, streaming responses |
| **Sprint 7** | DSA & Aptitude module |
| **Sprint 8** | Behavioral & System Design deep‑dive rounds |
| **Sprint 9** | Mock Recruiter — third interview sub‑mode |
| **Sprint 10+** | JD Analyzer · Workspace Health · README Generator · Resume Builder · Architecture Diagram · Security Audit · Public Sharing · Mobile bottom nav |

Sprint 5+ ships in order of demonstrated user demand, not roadmap ambition.

---

## 🧪 Design Principles

The codebase follows five load‑bearing rules from the design brief:

1. **The Dashboard answers one question** — *"what should I do next?"*
2. **Interviews and Projects are peers**, never nested. Both are first‑class.
3. **One Session model, polymorphic** — `mode: 'general' | 'project'`. Unified analytics forever.
4. **Reserve space, don't ship shells** — nav slots and workspace tabs only appear when their feature ships.
5. **The engine is a hard boundary** — Sprints 2–4 extended the platform without touching adaptive engine, blueprint, or AI runtime.

---

## 🤝 Contributing

Contributions are welcome — the project is young enough that small PRs still move the needle.

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/your-thing`
3. Follow the existing folder / naming conventions (see [Project Structure](#-project-structure))
4. Keep commits focused — one concern per commit
5. Open a PR describing **what** and **why**

**Good first PRs:** new achievement definitions, additional interviewer personalities, topic‑graph entries for new roles, keyboard shortcuts, help entries in the command palette.

**Please don't** touch the interview engine, blueprint service, or adaptive engine without opening an issue first — those are load‑bearing.

---

## 📄 License

Released under the [MIT License](LICENSE). Free for personal and commercial use.

---

## 👤 Author

Built with care by the InterviewAI team.

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?logo=github&logoColor=white&style=for-the-badge)](https://github.com/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white&style=for-the-badge)](https://linkedin.com/)
[![Portfolio](https://img.shields.io/badge/Portfolio-Visit-000000?logo=vercel&logoColor=white&style=for-the-badge)](https://)

<sub>If InterviewAI helped you, consider starring the repo ⭐ — it genuinely helps.</sub>

</div>
