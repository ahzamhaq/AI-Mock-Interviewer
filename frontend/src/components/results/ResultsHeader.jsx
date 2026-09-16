import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, Clock, Star, ArrowLeft } from 'lucide-react';

/**
 * ResultsHeader — the hero block at the top of ResultsPage. Extracted from
 * the inline JSX in ResultsPage.jsx so the tiered layout (Commit 7) can
 * compose it alongside a new verdict strip without repeating a 60-line
 * chunk of markup.
 *
 * The visual is unchanged from the pre-Sprint-3 hero. What's new here:
 *   • Optional `retryOf` chip that links back to the parent interview.
 *
 * Props:
 *   interview — the raw interview payload from interviewAPI.getById()
 *   emoji     — computed by the parent (kept a function up there so the
 *               "no answers submitted" text logic stays in one place)
 *   gradeColorClass — Tailwind class mapping from GRADE_COLORS
 */
const ResultsHeader = ({ interview, emoji, gradeColorClass }) => {
  const { results, questions, duration, retryOf } = interview;
  const answeredCount = questions.filter((q) => !q.skipped && q.userAnswer).length;

  return (
    <motion.div
      className="surface p-8 mb-4 text-center relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(88,166,255,0.05), transparent)' }} />
      <div className="relative">

        {/* Retry lineage — appears only when this interview was a retry. */}
        {retryOf?.interviewId && (
          <div className="flex justify-center mb-3">
            <Link
              to={`/interview/${retryOf.interviewId}/results`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
              style={{
                background: 'rgba(88,166,255,0.08)',
                border: '1px solid rgba(88,166,255,0.3)',
                color: '#58A6FF',
              }}
            >
              <ArrowLeft size={11} />
              Retried from earlier interview
              {retryOf.topic ? ` · ${retryOf.topic}` : ''}
            </Link>
          </div>
        )}

        <motion.div
          className="text-6xl mb-4"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          {emoji}
        </motion.div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#F0F6FC' }}>
          {answeredCount === 0 ? 'No Answers Submitted' : 'Interview Complete!'}
        </h1>
        <p className="mb-6" style={{ color: '#9CA3AF' }}>{interview.title}</p>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={`text-6xl font-bold ${gradeColorClass}`}>
            {results.grade}
          </span>
          <div className="text-left">
            <p className="text-4xl font-bold" style={{ color: '#F0F6FC' }}>{results.overallScore}/10</p>
            <p className="text-sm" style={{ color: '#6B7280' }}>{results.recommendation || 'Overall Score'}</p>
          </div>
        </div>

        {/* Natural closing line — adaptive interviews only. Sits above the
            analytical feedback so the conversation wraps up like an interview,
            not a report card. */}
        {results.closing && (
          <p
            className="text-sm italic max-w-xl mx-auto mb-4 leading-relaxed"
            style={{ color: '#F0F6FC', borderLeft: '2px solid rgba(88,166,255,0.4)', paddingLeft: 12 }}
          >
            {results.closing}
          </p>
        )}

        {results.overallFeedback && (
          <p className="text-sm max-w-xl mx-auto rounded-md p-4" style={{ color: '#9CA3AF', background: '#161B22' }}>
            {results.overallFeedback}
          </p>
        )}

        <div className="flex items-center justify-center gap-6 mt-6 text-sm" style={{ color: '#6B7280' }}>
          <span className="flex items-center gap-1"><Mic size={14} /> {questions.length} questions</span>
          <span className="flex items-center gap-1"><Clock size={14} /> {Math.floor(duration / 60)}m {duration % 60}s</span>
          <span className="flex items-center gap-1"><Star size={14} /> {results.totalFillerWords} filler words</span>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultsHeader;
