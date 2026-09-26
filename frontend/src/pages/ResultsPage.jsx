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
// Sprint 7 Commit 5 — DSA-only Code Evaluation panel. Rendered
// conditionally so the classic Results view is unchanged for every
// other interview mode.
import DsaEvaluationPanel from '../components/results/DsaEvaluationPanel';
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
  const color = score >= 8 ? '#3FB950' : score >= 6 ? '#D29922' : '#F85149';

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#21262D" strokeWidth="8" />
          <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: '#F0F6FC' }}>{score}</span>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>/{max}</span>
        </div>
      </div>
      <span className="text-xs text-center" style={{ color: '#9CA3AF' }}>{label}</span>
    </div>
  );
};

const QuestionReview = ({ question, index, onRetry, retrying, retryingIndex }) => {
  const [expanded, setExpanded] = useState(false);
  const fb = question.aiFeedback;
  const canRetry = !question.skipped && !!question.userAnswer;
  const isThisRetryLoading = retrying && retryingIndex === index;

  return (
    <div className="surface overflow-hidden">
      <button
        className="w-full p-5 flex items-center gap-4 text-left transition-colors"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#161B22')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 font-bold text-sm"
          style={question.skipped
            ? { background: '#21262D', color: '#9CA3AF' }
            : fb?.score >= 7
              ? { background: 'rgba(63,185,80,0.15)', color: '#3FB950' }
              : { background: 'rgba(248,81,73,0.15)', color: '#F85149' }}
        >
          {question.skipped ? 'S' : `${fb?.score || 0}`}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: '#F0F6FC' }}>{question.questionText}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {question.skipped ? 'Skipped' : `Score: ${fb?.score || 0}/10`}
            {question.voiceMetrics?.wordsPerMinute > 0 && ` • ${question.voiceMetrics.wordsPerMinute} WPM`}
            {question.voiceMetrics?.fillerWordCount > 0 && ` • ${question.voiceMetrics.fillerWordCount} filler words`}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={16} style={{ color: '#9CA3AF' }} />}
      </button>

      {expanded && !question.skipped && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ borderTop: '1px solid #21262D' }}
        >
          <div className="p-5 space-y-4">
            {question.userAnswer && (
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: '#9CA3AF' }}><MessageSquare size={12} /> YOUR ANSWER</p>
                <p className="text-sm rounded-md p-3 whitespace-pre-line" style={{ color: '#9CA3AF', background: '#161B22' }}>{question.userAnswer}</p>
              </div>
            )}
            {/* Raw voice-to-text transcript, shown only when it materially
                differs from the cleaned userAnswer. Helps users see filler
                words and pacing that the polished answer hides. */}
            {question.transcript
              && question.transcript.trim()
              && question.transcript.trim() !== (question.userAnswer || '').trim() && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>RAW TRANSCRIPT</p>
                <p className="font-mono text-xs rounded-md p-3 whitespace-pre-line" style={{ color: '#9CA3AF', background: '#161B22' }}>
                  {question.transcript}
                </p>
              </div>
            )}
            {fb?.summary && <p className="text-sm italic" style={{ color: '#F0F6FC' }}>"{fb.summary}"</p>}

            {(fb?.strengths?.length > 0 || fb?.weaknesses?.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {fb.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: '#3FB950' }}>STRENGTHS</p>
                    {fb.strengths.slice(0, 2).map((s, i) => (
                      <p key={i} className="text-xs flex gap-1" style={{ color: '#9CA3AF' }}><span style={{ color: '#3FB950' }}>+</span> {s}</p>
                    ))}
                  </div>
                )}
                {fb.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: '#F85149' }}>IMPROVE</p>
                    {fb.weaknesses.slice(0, 2).map((w, i) => (
                      <p key={i} className="text-xs flex gap-1" style={{ color: '#9CA3AF' }}><span style={{ color: '#F85149' }}>-</span> {w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {fb?.betterAnswer && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: '#58A6FF' }}>MODEL ANSWER</p>
                <p className="text-xs rounded-md p-3 line-clamp-4" style={{ color: '#9CA3AF', background: 'rgba(88,166,255,0.06)' }}>{fb.betterAnswer}</p>
              </div>
            )}

            {/* Voice metrics */}
            {question.voiceMetrics?.wordsPerMinute > 0 && (
              <div className="flex gap-4 text-xs">
                <span style={{ color: '#9CA3AF' }}>
                  Speed: <span style={{
                    color: question.voiceMetrics.speakingPace === 'ideal' ? '#3FB950' :
                      question.voiceMetrics.speakingPace === 'too_fast' ? '#F85149' : '#D29922',
                  }}>{question.voiceMetrics.wordsPerMinute} WPM ({question.voiceMetrics.speakingPace?.replace('_', ' ')})</span>
                </span>
                {question.voiceMetrics.fillerWordCount > 0 && (
                  <span style={{ color: '#9CA3AF' }}>
                    Fillers: <span style={{ color: '#D29922' }}>{question.voiceMetrics.fillerWordCount} ({question.voiceMetrics.fillerWords?.join(', ')})</span>
                  </span>
                )}
              </div>
            )}

            {/* Per-question retry — creates a new short interview seeded from
                this question's topic. Only offered for real attempts; a
                skipped or empty question isn't a fair retry target. */}
            {canRetry && onRetry && (
              <div className="pt-2" style={{ borderTop: '1px solid #21262D' }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <motion.div className="w-12 h-12 rounded-full border-4"
          style={{ borderColor: '#30363D', borderTopColor: '#58A6FF' }}
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
    <div className="min-h-screen" style={{ background: '#0D1117' }}>
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

        {/* ── DSA Code Evaluation (Sprint 7 Commit 5) ──────────────────
            Renders the structured evaluation produced by the backend
            Code Evaluation Engine at completion. Only shown for DSA
            interviews — other modes fall through to the classic
            results layout. */}
        {interview.mode === 'dsa' && interview.evaluation?.status && (
          <div className="mt-4">
            <DsaEvaluationPanel
              evaluation={interview.evaluation}
              execution={interview.lastExecution}
              interviewId={interview._id || interview.id}
              onEvaluationChange={(next) => setInterview((prev) => ({ ...prev, evaluation: next }))}
              title={interview.config?.dsa?.topic || interview.title}
            />
          </div>
        )}

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
          <motion.div className="surface p-6"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="font-semibold mb-6 flex items-center gap-2" style={{ color: '#F0F6FC' }}>
              <BarChart3 size={18} style={{ color: '#58A6FF' }} /> Score Breakdown
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

          <motion.div className="surface p-6"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="font-semibold mb-4" style={{ color: '#F0F6FC' }}>Skill Radar</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#21262D" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                <Radar name="Score" dataKey="A" stroke="#58A6FF" fill="#58A6FF" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Voice metrics */}
        {(results.averageWPM > 0 || results.totalFillerWords > 0) && (
          <motion.div className="surface p-6 mb-8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#F0F6FC' }}>
              <Volume2 size={18} style={{ color: '#58A6FF' }} /> Voice Analysis
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.averageWPM > 0 && (
                <div className="rounded-md p-4 text-center" style={{ background: '#161B22' }}>
                  <p className="text-2xl font-bold" style={{ color: '#F0F6FC' }}>{results.averageWPM}</p>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Words/min</p>
                  <p className="text-xs mt-1" style={{ color: results.averageWPM >= 100 && results.averageWPM <= 180 ? '#3FB950' : '#D29922' }}>
                    {results.averageWPM < 100 ? 'Too slow' : results.averageWPM > 180 ? 'Too fast' : 'Ideal pace'}
                  </p>
                </div>
              )}
              <div className="rounded-md p-4 text-center" style={{ background: '#161B22' }}>
                <p className="text-2xl font-bold" style={{ color: results.totalFillerWords === 0 ? '#3FB950' : results.totalFillerWords < 5 ? '#D29922' : '#F85149' }}>
                  {results.totalFillerWords}
                </p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Filler Words</p>
                <p className="text-xs mt-1" style={{ color: '#8B949E' }}>{results.totalFillerWords === 0 ? 'Perfect!' : 'Reduce these'}</p>
              </div>
              <div className="rounded-md p-4 text-center" style={{ background: '#161B22' }}>
                <p className="text-2xl font-bold" style={{ color: '#F0F6FC' }}>{results.confidenceScore}%</p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Confidence</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Strengths & Weaknesses */}
        {(results.strengths?.length > 0 || results.weaknesses?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {results.strengths?.length > 0 && (
              <div className="surface p-5">
                <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: '#3FB950' }}>
                  <CheckCircle size={16} /> Overall Strengths
                </h4>
                <ul className="space-y-2">
                  {results.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2" style={{ color: '#9CA3AF' }}>
                      <span className="flex-shrink-0" style={{ color: '#3FB950' }}>✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {results.weaknesses?.length > 0 && (
              <div className="surface p-5">
                <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: '#F85149' }}>
                  <XCircle size={16} /> Areas to Improve
                </h4>
                <ul className="space-y-2">
                  {results.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm flex gap-2" style={{ color: '#9CA3AF' }}>
                      <span className="flex-shrink-0" style={{ color: '#F85149' }}>→</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Per-question review */}
        <div className="mb-8">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#F0F6FC' }}>
            <Zap size={18} style={{ color: '#58A6FF' }} /> Question-by-Question Review
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
