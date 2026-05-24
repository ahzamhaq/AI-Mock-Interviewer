# 🎙️ InterviewAI — Voice-Based AI Mock Interviewer

A **production-ready, full-stack AI mock interview platform** that simulates real technical and HR interviews with voice interaction, AI-powered feedback, and detailed analytics.

> Built with React, Node.js, MongoDB, Gemini/OpenAI API, and Web Speech APIs. Portfolio-grade quality.

---

## ✨ Features

### 🎤 Voice Interview System
- AI speaks questions using **Web SpeechSynthesis API**
- User answers by **voice (SpeechRecognition)** or typed text
- Live real-time transcript while speaking
- Automatic voice metrics collection

### 🤖 Advanced AI Feedback Engine
- **Technical correctness** scoring
- **Communication clarity** analysis
- **Confidence level** estimation
- **Completeness** and **grammar** scoring
- Personalized **model answers**
- **Follow-up questions** generation

### 📊 Voice Analytics
- **Filler word detection** (umm, uh, like, basically...)
- **Speaking speed** measurement (WPM)
- **Pace analysis** (too fast / ideal / too slow)
- Confidence percentage

### 🎯 Customizable Sessions
- Role selection: Frontend/Backend/Full Stack/SDE/Data Analyst/HR
- Experience level: Fresher / 1–2 Years / 3+ Years
- Company type: FAANG / Product-Based / Startup / Service-Based
- Target company: Google, Amazon, Microsoft, etc.
- Interview type: Technical / HR / Behavioral / System Design / Mixed
- Difficulty: Easy / Medium / Hard
- 3–15 questions per session
- Job description + Resume-based questions

### 📈 Analytics Dashboard
- Score progression charts
- Skill radar (Technical, Communication, Confidence, Grammar, Completeness)
- Question-type performance breakdown
- Filler word frequency analysis
- WPM trend charts
- Weekly practice consistency

### 🏆 Gamification
- Daily practice streaks
- Points system
- Leaderboard with medals (🥇🥈🥉)
- Best score tracking

### 🔐 Authentication
- JWT-based signup/login
- Protected routes
- Admin panel with user management

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Charts | Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| AI | Google Gemini 1.5 Flash / OpenAI GPT-4o-mini |
| Voice Input | Web SpeechRecognition API |
| Voice Output | Web SpeechSynthesis API |
| Auth | JWT |
| File Upload | Multer |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Google Gemini API key (free) OR OpenAI API key

---

### 1. Clone & Install

```bash
# Clone the repo
git clone https://github.com/yourusername/ai-mock-interviewer.git
cd ai-mock-interviewer

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### 2. Configure Environment Variables

**Backend** — Copy `.env.example` to `.env`:
```bash
cd backend
cp .env.example .env
```

Fill in:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-mock-interviewer
JWT_SECRET=your_super_secret_key_min_32_characters_here
JWT_EXPIRES_IN=7d

# Choose AI provider
AI_PROVIDER=gemini

# Gemini (recommended — free tier available)
GEMINI_API_KEY=your_gemini_api_key_here

# OR OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-openai-key

FRONTEND_URL=http://localhost:5173
```

**Frontend** — Copy `.env.example` to `.env`:
```bash
cd frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000/api
```

---

### 3. Get Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy to `GEMINI_API_KEY` in backend `.env`

---

### 4. Run Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open: [http://localhost:5173](http://localhost:5173)

---

## 📦 Deployment

### Frontend → Vercel
1. Push to GitHub
2. Connect repo on [vercel.com](https://vercel.com)
3. Set Root Directory: `frontend`
4. Add env variable: `VITE_API_URL=https://your-backend.onrender.com/api`
5. Deploy

### Backend → Render
1. Connect repo on [render.com](https://render.com)
2. Set Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add all env variables from `.env`
6. Deploy

---

## 🗂️ Project Structure

```
ai-mock-interviewer/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Auth, Interview, User, Analytics, Admin
│   │   ├── models/          # User, Interview, Question (Mongoose)
│   │   ├── routes/          # Express routers
│   │   ├── middleware/       # Auth, error handler, upload, rate limiter
│   │   ├── services/        # AI service (Gemini/OpenAI)
│   │   ├── utils/           # Database connection
│   │   ├── app.js           # Express app setup
│   │   └── server.js        # Entry point
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/      # Navbar
    │   │   └── common/      # LoadingScreen
    │   ├── context/         # AuthContext
    │   ├── hooks/           # useVoice (SpeechSynthesis + SpeechRecognition)
    │   ├── pages/           # All pages
    │   ├── services/        # API client (axios)
    │   ├── styles/          # Global CSS (Tailwind)
    │   └── App.jsx
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/interviews` | Create interview + generate AI questions |
| POST | `/api/interviews/:id/answer/:idx` | Submit answer + get AI feedback |
| POST | `/api/interviews/:id/complete` | Finalize interview |
| GET | `/api/interviews/history` | Interview history |
| GET | `/api/analytics/dashboard` | Dashboard stats |
| GET | `/api/analytics/detailed` | Detailed analytics |
| GET | `/api/users/leaderboard` | Top performers |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/resume` | Upload resume |

---

## 🎨 UI Highlights

- **Dark glassmorphism** design system
- **Framer Motion** page transitions and micro-animations
- **Real-time voice wave** animation during recording
- **Circular score rings** with animated fill
- **Responsive** on mobile, tablet, desktop
- **Premium gradients** and glow effects
- Inter + Sora typography

---

## 📱 Browser Support

Voice features require:
- Chrome 33+ (best support)
- Edge 79+
- Safari 14.1+ (iOS/macOS)
- Firefox has limited SpeechRecognition support (use text fallback)

---

## 🏗️ Built By

Made as a **portfolio-grade placement project** demonstrating:
- Full-stack React + Node.js architecture
- Real-time AI API integration (Gemini/OpenAI)
- Web Speech APIs
- MongoDB data modeling
- JWT authentication
- Production deployment patterns

---

## 📄 License

MIT — Free to use for portfolio/learning purposes.

---

## 🚀 Recent Architecture Upgrades

Incremental upgrades layered onto the existing Express + MongoDB stack. All changes are
backward-compatible — existing interviews, users, and analytics keep working unchanged.

### Phase 1 — Interview engine
- **Multi-provider AI fallback** (`backend/src/services/aiProviderManager.js`):
  primary Gemini → Groq (optional) → OpenRouter (optional). 429/quota/model-not-found
  errors transparently retry the next provider.
- **Adaptive memory + personalized greetings**: every `POST /api/interviews`
  fetches recent interviews and `WeakTopic` records, injects them into the question
  prompt, and returns a `greeting` string the frontend speaks first.
- **Anti-repetition engine** (`backend/src/utils/embedding.js` + `memory.service.js`):
  hash-based 64-dim embedding + cosine similarity against the last 100 questions per
  user. Duplicates are replaced with weak-topic-focused alternatives.
- **Dynamic follow-up questions**: `POST /api/interviews/:id/follow-up/:questionIndex`
  generates a contextual follow-up based on the user's actual answer and appends it
  to the interview.
- **Weak-topic tracking** (new `WeakTopic` model): per-user/per-role topic averages
  updated on interview completion. Read back into future question generation.

### Phase 2 — Voice
- **Server-side ElevenLabs TTS** (`backend/src/services/tts.service.js` + `POST /api/tts`):
  returns an MP3 buffer when `TTS_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY` is set;
  otherwise responds with `{ useBrowser: true }` so the client falls back to the
  Web SpeechSynthesis API automatically.
- **Frontend TTS client** (`frontend/src/services/tts.js`): single `speak()` entry
  point that prefers server audio and falls back to the browser without code changes.
- **Microphone amplitude analyzer** (`frontend/src/hooks/useAmplitudeAnalyzer.js`):
  exposes a `[0, 1]` amplitude value driven by `AnalyserNode`, used for avatar
  lip-sync and visualization.

### Phase 3 — 3D avatar
- **Procedural Three.js avatar** (`frontend/src/components/avatar/TalkingAvatar.jsx`
  + `AvatarScene.jsx`): no GLTF dependencies — head, eyes, pupils, brows, mouth,
  neck, body, and a pulsing ring all built from primitive geometry. Mouth scales
  with `amplitude`, blinking every 3-5 s, eye look-around, emotion-driven brows.
- **State sync**: avatar's `isSpeaking` follows the unified TTS state (server audio
  OR browser SpeechSynthesis); `isListening` follows `SpeechRecognition.listening`;
  `amplitude` switches between AI-synthesized motion (when AI speaks) and live mic
  amplitude (when user speaks).
- Lazy-loaded via `Suspense`, so the page still renders if `three` /
  `@react-three/fiber` aren't installed.

### Phase 4 — Analytics
- `GET /api/analytics/detailed` now also returns `topicHeatmap` (lowest-scoring
  topics in the window), `weakTopics` (persistent `WeakTopic` records), and
  `radar` (5-axis skill breakdown).

### New environment variables
```env
GROQ_API_KEY=             # optional secondary AI provider
OPENROUTER_API_KEY=       # optional tertiary AI provider
SIMILARITY_THRESHOLD=0.78 # anti-repetition strictness
TTS_PROVIDER=browser      # or "elevenlabs"
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

### New endpoints
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/interviews/:id/follow-up/:questionIndex` | Dynamic follow-up generation |
| `POST` | `/api/tts` | Server-side TTS (audio/mpeg or `{useBrowser:true}`) |

### Optional dependencies (installed only if you opt-in)
- Backend: `groq-sdk`
- Frontend: `three`, `@react-three/fiber`

Avatar + Groq are wrapped in safe imports — the app runs without them.

