import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, CheckCircle, XCircle, ChevronDown, ChevronUp,
  RefreshCw, Home, Zap, MessageSquare, Volume2, TrendingUp,
} from 'lucide-react';
import { interviewAPI } from '../services/api';
import Navbar from '../components/layout/Navbar';
import ResultsHeader from '../components/results/ResultsHeader';
import VerdictStrip from '../components/results/VerdictStrip';
import InterviewOriginCard from '../components/interview/InterviewOriginCard';
import toast from 'react-hot-toast';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const GRADE_COLORS = {
  'A+': 'text-emerald-400', A: 'text-green-400',
  'B+': 'text-blue-400', B: 'text-cyan-400',
  'C+': 'text-yellow-400', C: 'text-amber-400',
  D: 'text-orange-400', F: 'text-red-400',
};

const CircularScore = ({ score, max = 10, label, size = 120 }) => {
  const pct = (score / max) * 100;
  const radius = (size / 2) - 8;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-display">{score}</span>
          <span className="text-xs text-white/40">/{max}</span>
        </div>
      </div>
      <span className="text-xs text-white/50 text-center">{label}</span>
    </div>
  );
};

const QuestionReview = ({ question, index, onRetry, retrying, retryingIndex }) => {
  const [expanded, setExpanded] = useState(false);
  const fb = question.aiFeedback;
  const canRetry = !question.skipped && !!question.userAnswer;
  const isThisRetryLoading = retrying && retryingIndex === index;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/3 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
          ${question.skipped ? 'bg-white/10 text-white/40' :
            fb?.score >= 7 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {question.skipped ? 'S' : `${fb?.score || 0}`}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{question.questionText}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {question.skipped ? 'Skipped' : `Score: ${fb?.score || 0}/10`}
            {question.voiceMetrics?.wordsPerMinute > 0 && ` • ${question.voiceMetrics.wordsPerMinute} WPM`}
            {question.voiceMetrics?.fillerWordCount > 0 && ` • ${question.voiceMetrics.fillerWordCount} filler words`}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {expanded && !question.skipped && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-white/5"
        >
          <div className="p-5 space-y-4">
            {question.userAnswer && (
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 flex items-center gap-1"><MessageSquare size={12} /> YOUR ANSWER</p>
                <p className="text-sm text-white/60 bg-white/3 rounded-xl p-3 whitespace-pre-line">{question.userAnswer}</p>
              </div>
            )}
            {/* Raw voice-to-text transcript, shown only when it materially
                differs from the cleaned userAnswer. Helps users see filler
                words and pacing that the polished answer hides. */}
            {question.transcript
              && question.transcript.trim()
              && question.transcript.trim() !== (question.userAnswer || '').trim() && (
              <div>
                <p className="text-xs font-medium text-white/40 mb-2">RAW TRANSCRIPT</p>
                <p className="font-mono text-xs text-white/40 bg-white/3 rounded-xl p-3 whitespace-pre-line">
                  {question.transcript}
                </p>
              </div>
            )}
            {fb?.summary && <p className="text-sm text-white/70 italic">"{fb.summary}"</p>}

            {(fb?.strengths?.length > 0 || fb?.weaknesses?.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {fb.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-2">STRENGTHS</p>
                    {fb.strengths.slice(0, 2).map((s, i) => (
                      <p key={i} className="text-xs text-white/50 flex gap-1"><span className="text-green-400">+</span> {s}</p>
                    ))}
                  </div>
                )}
                {fb.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-medium mb-2">IMPROVE</p>
                    {fb.weaknesses.slice(0, 2).map((w, i) => (
                      <p key={i} className="text-xs text-white/50 flex gap-1"><span className="text-red-400">-</span> {w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {fb?.betterAnswer && (
              <div>
                <p className="text-xs font-medium text-primary-400 mb-2">MODEL ANSWER</p>
                <p className="text-xs text-white/50 bg-primary-500/5 rounded-xl p-3 line-clamp-4">{fb.betterAnswer}</p>
              </div>
            )}

            {/* Voice metrics */}
            {question.voiceMetrics?.wordsPerMinute > 0 && (
              <div className="flex gap-4 text-xs">
                <span className="text-white/40">
                  Speed: <span className={
                    question.voiceMetrics.speakingPace === 'ideal' ? 'text-green-400' :
                    question.voiceMetrics.speakingPace === 'too_fast' ? 'text-red-400' : 'text-yellow-400'
                  }>{question.voiceMetrics.wordsPerMinute} WPM ({question.voiceMetrics.speakingPace?.replace('_', ' ')})</span>
                </span>
                {question.voiceMetrics.fillerWordCount > 0 && (
                  <span className="text-white/40">
                    Fillers: <span className="text-yellow-400">{question.voiceMetrics.fillerWordCount} ({question.voiceMetrics.fillerWords?.join(', ')})</span>
                  </span>
                )}
              </div>
            )}

            {/* Per-question retry — creates a new short interview seeded from
                this question's topic. Only offered for real attempts; a
                skipped or empty question isn't a fair retry target. */}
            {canRetry && onRetry && (
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => onRetry(index)}
                  disabled={retrying}
                  className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  {isThisRetryLoading ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" /> Starting…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={11} /> Retry this question
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryingIndex, setRetryingIndex] = useState(null);

  useEffect(() => {
    interviewAPI.getById(id)
      .then(res => setInterview(res.interview))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Weakest ANSWERED question — the one the Verdict strip's "Retry" button
  // targets. Skipped and unanswered questions are excluded so the retry
  // lands on a real attempt the user can learn from.
  const weakestAnsweredIndex = React.useMemo(() => {
    if (!interview) return null;
    let best = null;
    let bestScore = Infinity;
    interview.questions.forEach((q, i) => {
      if (q.skipped) return;
      if (!q.userAnswer) return;
      const s = q.aiFeedback?.score ?? Infinity;
      if (s < bestScore) { bestScore = s; best = i; }
    });
    return best;
  }, [interview]);

  const retryQuestionAt = async (questionIndex) => {
    if (retrying || questionIndex == null) return;
    setRetrying(true);
    setRetryingIndex(questionIndex);
    try {
      const res = await interviewAPI.retryQuestion(id, questionIndex);
      navigate(`/interview/${res.interview.id}`, {
        state: { greeting: res.greeting || '' },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to start retry');
      setRetrying(false);
      setRetryingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div className="w-12 h-12 rounded-full border-4 border-primary-600/30 border-t-primary-500"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!interview) return null;
  const { results, questions } = interview;

  const answeredCount = questions.filter(q => !q.skipped && q.userAnswer).length;
  const getResultEmoji = () => {
    if (answeredCount === 0) return '😶';
    if (results.overallScore >= 9) return '🏆';
    if (results.overallScore >= 8) return '🌟';
    if (results.overallScore >= 7) return '🎯';
    if (results.overallScore >= 6) return '👍';
    if (results.overallScore >= 4) return '💪';
    if (results.overallScore >= 2) return '📚';
    return '😅';
  };

  const radarData = [
    { subject: 'Technical', A: results.technicalScore * 10 },
    { subject: 'Communication', A: results.communicationScore * 10 },
    { subject: 'Confidence', A: results.confidenceScore },
    { subject: 'Completeness', A: results.completenessScore * 10 },
    { subject: 'Grammar', A: results.grammarScore * 10 },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* ── Tier 1 · Hero ─────────────────────────────────────────────
            Extracted to ResultsHeader in Sprint 3 (Commit 7). Visual
            unchanged; adds the "Retried from …" chip when applicable. */}
        <ResultsHeader
          interview={interview}
          emoji={getResultEmoji()}
          gradeColorClass={GRADE_COLORS[results.grade] || 'text-white'}
        />

        {/* Sprint 5 Commit 6 — origin trace. Skipped for the default
            'guided' source to keep the classic wizard results view
            visually unchanged for existing users. */}
        {interview.creationSource && interview.creationSource !== 'guided' && (
          <div className="mb-6 flex justify-center">
            <InterviewOriginCard
              dense
              creationSource={interview.creationSource}
              sourceMetadata={interview.sourceMetadata || {}}
            />
          </div>
        )}

        {/* ── Tier 1 · Verdict strip ────────────────────────────────────
            The fast-scan answer to "did I do well? what should I do next?"
            Everything below the fold remains for users who want detail. */}
        <VerdictStrip
          strengths={results.strengths}
          weaknesses={results.weaknesses}
          weakestIndex={weakestAnsweredIndex}
          onRetryWeakest={() => retryQuestionAt(weakestAnsweredIndex)}
          onPracticeAgain={() => navigate('/interviews/new')}
          busy={retrying}
        />

        {/* Score breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div className="glass rounded-2xl p-6"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="font-semibold mb-6 flex items-center gap-2">
              <BarChart3 size={18} className="text-primary-400" /> Score Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <CircularScore score={results.technicalScore} label="Technical" size={80} />
              <CircularScore score={results.communicationScore} label="Communication" size={80} />
              <CircularScore score={results.completenessScore} label="Completeness" size={80} />
              <CircularScore score={results.grammarScore} label="Grammar" size={80} />
              <CircularScore score={Math.round(results.confidenceScore / 10)} label="Confidence" size={80} />
              <CircularScore score={results.overallScore} label="Overall" size={80} />
            </div>
          </motion.div>

          <motion.div className="glass rounded-2xl p-6"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="font-semibold mb-4">Skill Radar</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                <Radar name="Score" dataKey="A" stroke="#4361ff" fill="#4361ff" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Voice metrics */}
        {(results.averageWPM > 0 || results.totalFillerWords > 0) && (
          <motion.div className="glass rounded-2xl p-6 mb-8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Volume2 size={18} className="text-accent-400" /> Voice Analysis
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.averageWPM > 0 && (
                <div className="bg-white/3 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold">{results.averageWPM}</p>
                  <p className="text-xs text-white/40 mt-1">Words/min</p>
                  <p className={`text-xs mt-1 ${results.averageWPM >= 100 && results.averageWPM <= 180 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {results.averageWPM < 100 ? 'Too slow' : results.averageWPM > 180 ? 'Too fast' : 'Ideal pace'}
                  </p>
                </div>
              )}
              <div className="bg-white/3 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${results.totalFillerWords === 0 ? 'text-green-400' : results.totalFillerWords < 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {results.totalFillerWords}
                </p>
                <p className="text-xs text-white/40 mt-1">Filler Words</p>
                <p className="text-xs text-white/30 mt-1">{results.totalFillerWords === 0 ? 'Perfect!' : 'Reduce these'}</p>
              </div>
              <div className="bg-white/3 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{results.confidenceScore}%</p>
                <p className="text-xs text-white/40 mt-1">Confidence</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Strengths & Weaknesses */}
        {(results.strengths?.length > 0 || results.weaknesses?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {results.strengths?.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h4 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle size={16} /> Overall Strengths
                </h4>
                <ul className="space-y-2">
                  {results.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-white/60 flex gap-2">
                      <span className="text-green-400 flex-shrink-0">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {results.weaknesses?.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h4 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                  <XCircle size={16} /> Areas to Improve
                </h4>
                <ul className="space-y-2">
                  {results.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-white/60 flex gap-2">
                      <span className="text-red-400 flex-shrink-0">→</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Per-question review */}
        <div className="mb-8">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-primary-400" /> Question-by-Question Review
          </h3>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionReview
                key={i}
                question={q}
                index={i}
                onRetry={retryQuestionAt}
                retrying={retrying}
                retryingIndex={retryingIndex}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/interviews/new" className="flex-1">
            <motion.button className="btn-primary w-full flex items-center justify-center gap-2 py-4"
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <RefreshCw size={18} /> Practice Again
            </motion.button>
          </Link>
          <Link to="/analytics" className="flex-1">
            <motion.button className="btn-secondary w-full flex items-center justify-center gap-2 py-4"
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <TrendingUp size={18} /> View Analytics
            </motion.button>
          </Link>
          <Link to="/dashboard">
            <motion.button className="btn-secondary flex items-center gap-2 py-4 px-6"
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Home size={18} />
            </motion.button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
