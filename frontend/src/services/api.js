import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

// Handle responses and errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(new Error(message));
  }
);

// Auth
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  googleAuth: (credential) => api.post('/auth/google', { credential }),
  getMe: () => api.get('/auth/me'),
};

// User
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  uploadResume: (formData) => api.post('/users/resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data) => api.put('/users/password', data),
  getLeaderboard: () => api.get('/users/leaderboard'),
};

// Interviews
export const interviewAPI = {
  create: (config) => api.post('/interviews', config),
  submitAnswer: (interviewId, questionIndex, data) =>
    api.post(`/interviews/${interviewId}/answer/${questionIndex}`, data),
  nextQuestion: (interviewId) =>
    api.post(`/interviews/${interviewId}/next-question`),
  generateFollowUp: (interviewId, questionIndex) =>
    api.post(`/interviews/${interviewId}/follow-up/${questionIndex}`),
  complete: (interviewId) => api.post(`/interviews/${interviewId}/complete`),
  getById: (id) => api.get(`/interviews/${id}`),
  getHistory: (params) => api.get('/interviews/history', { params }),
  abandon: (id) => api.patch(`/interviews/${id}/abandon`),
  getPersonalities: () => api.get('/interviews/personalities'),
  getRounds: () => api.get('/interviews/rounds'),
  nudge: (interviewId, data) => api.post(`/interviews/${interviewId}/nudge`, data),
  resume: (interviewId) => api.post(`/interviews/${interviewId}/resume`),
};

// TTS (server-side ElevenLabs; falls back to browser SpeechSynthesis automatically)
export const ttsAPI = {
  synthesize: (text, voice) => api.post('/tts', { text, voice }),
};

// Analytics
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getDetailed: (days) => api.get('/analytics/detailed', { params: { days } }),
};

// Admin
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
};

// Projects (Sprint 2 — Workspace / Repository Analysis)
// createFromUrl and createFromGithub return { project, analysis } where
// analysis.status starts as 'processing'. Callers should navigate to the
// analyzing page and poll getById until status flips to 'ready' or 'failed'.
export const projectsAPI = {
  list: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  createFromUrl: (url) => api.post('/projects/from-url', { url }),
  createFromGithub: (owner, repo) => api.post('/projects/from-github', { owner, repo }),
  reanalyze: (id) => api.post(`/projects/${id}/reanalyze`),
  remove: (id) => api.delete(`/projects/${id}`),
};

// Integrations (Sprint 2 — GitHub as an OPTIONAL linked account, never login)
// The `authorize` call returns { url }; the caller navigates window.location
// there. GitHub redirects back to the backend, which finalizes and redirects
// to /profile?github=connected|error.
export const integrationsAPI = {
  githubStatus: () => api.get('/integrations/github/status'),
  githubAuthorize: () => api.get('/integrations/github/authorize'),
  githubDisconnect: () => api.delete('/integrations/github'),
  githubListRepos: (params) => api.get('/integrations/github/repos', { params }),
};

export default api;
