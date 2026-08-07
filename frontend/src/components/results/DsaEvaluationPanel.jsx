import React, { useState, useCallback } from 'react';
import {
  Award, ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  Cpu, Database, MessageCircle, Loader2, RefreshCw, Download, Lightbulb,
  BookOpen, Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { interviewAPI } from '../../services/api';

/**
 * DsaEvaluationPanel — renders the structured Code Evaluation produced
 * by the backend Code Evaluation Engine (Sprint 7 Commit 5).
 *
 * The panel is fed the raw `interview.evaluation` object. It renders
 * three states based on `evaluation.status`:
 *   • 'ready'   — full breakdown (score cards, complexity, comm,
 *                  strengths/weaknesses, recommendations, summary)
 *   • 'pending' — skeleton with "Evaluating…" spinner
 *   • 'failed'  — error message + Retry button
 *
 * All sections after the score grid are collapsible (spec).
 *
 * Props:
 *   evaluation    — { status, overallScore, scores, complexity, … }
 *   execution     — interview.lastExecution (for the Execution Summary card)
 *   interviewId   — string; used for retry + export filename
 *   onEvaluationChange — (nextEvaluation) => void; parent updates
 *                          local interview state after retry
 *   title         — string; used in the export filename
 */
const DsaEvaluationPanel = ({
  evaluation,
  execution,
  interviewId,
  onEvaluationChange,
  title = 'evaluation',
}) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await interviewAPI.retryEvaluation(interviewId);
      const next = res?.evaluation;
      if (next) {
        onEvaluationChange?.(next);
        if (next.status === 'ready') toast.success('Evaluation ready.');
        else if (next.status === 'failed') toast.error(next.error || 'Evaluation failed.');
      }
    } catch (err) {
      toast.error(err?.message || 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  }, [interviewId, retrying, onEvaluationChange]);

  const handleExportJson = () => {
    const safe = (title || 'evaluation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'evaluation';
    downloadFile(`${safe}-evaluation.json`, JSON.stringify(evaluation, null, 2), 'application/json');
  };

  const handleExportMarkdown = () => {
    const safe = (title || 'evaluation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'evaluation';
    downloadFile(`${safe}-evaluation.md`, toMarkdown(evaluation), 'text/markdown');
  };

  if (!evaluation || !evaluation.status) return null;

  // ── Pending / skeleton ───────────────────────────────────────────
  if (evaluation.status === 'pending') {
    return (
      <SectionShell title="Code Evaluation">
        <SkeletonBody label="Evaluating your solution…" />
      </SectionShell>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────
  if (evaluation.status === 'failed') {
    return (
      <SectionShell title="Code Evaluation">
        <div
          className="flex items-start gap-3 p-4"
          style={{
            background: 'rgba(248,81,73,0.06)',
            border: '1px solid rgba(248,81,73,0.25)',
            borderRadius: 8,
          }}
        >
          <AlertTriangle size={16} style={{ color: '#F85149', marginTop: 2, flexShrink: 0 }} aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>
              Evaluation failed
            </div>
            <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              {evaluation.error || 'The evaluation service was unavailable.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
            aria-label="Retry evaluation"
          >
            {retrying
              ? <><Loader2 size={11} className="animate-spin" /> Retrying…</>
              : <><RefreshCw size={11} /> Retry Evaluation</>}
          </button>
        </div>
      </SectionShell>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────
  const { overallScore, scores = {}, complexity = {}, communicationFeedback,
          strengths = [], weaknesses = [], recommendations = {}, summary } = evaluation;
  const scoreColor = colorForScore(overallScore);

  return (
    <SectionShell
      title="Code Evaluation"
      actions={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
            title="Download as Markdown"
            aria-label="Download evaluation as Markdown"
          >
            <Download size={11} /> MD
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
            title="Download as JSON"
            aria-label="Download evaluation as JSON"
          >
            <Download size={11} /> JSON
          </button>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
            title="Regenerate the evaluation"
            aria-label="Regenerate evaluation"
          >
            {retrying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Retry
          </button>
        </div>
      }
    >
      {/* Overall score hero */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 72, height: 72, borderRadius: 12,
            background: `${scoreColor}18`, border: `1px solid ${scoreColor}55`,
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: scoreColor }}>{overallScore ?? '—'}</span>
            <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>/100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>
            Overall score
          </div>
          <p className="text-xs mt-1" style={{ color: '#F0F6FC', lineHeight: 1.55 }}>
            {summary || 'No summary provided.'}
          </p>
        </div>
      </div>

      {/* Score grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
        <ScoreCard icon={CheckCircle}    label="Correctness"      score={scores.correctness} />
        <ScoreCard icon={Target}         label="Algorithm"        score={scores.algorithm} />
        <ScoreCard icon={Cpu}            label="Time Complexity"  score={scores.timeComplexity} />
        <ScoreCard icon={Database}       label="Space Complexity" score={scores.spaceComplexity} />
        <ScoreCard icon={BookOpen}       label="Code Quality"     score={scores.codeQuality} />
        <ScoreCard icon={MessageCircle}  label="Communication"    score={scores.communication} />
        <ScoreCard icon={AlertTriangle}  label="Edge Cases"       score={scores.edgeCases} />
      </div>

      {/* Complexity + Execution summary side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <ComplexityPanel complexity={complexity} />
        <ExecutionSummary execution={execution} />
      </div>

      {/* Communication feedback */}
      {communicationFeedback && (
        <div
          className="p-3 mb-4"
          style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8 }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageCircle size={12} style={{ color: '#58A6FF' }} aria-hidden />
            <div className="text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>
              Communication Feedback
            </div>
          </div>
          <p className="text-xs" style={{ color: '#F0F6FC', lineHeight: 1.55 }}>
            {communicationFeedback}
          </p>
        </div>
      )}

      {/* Strengths / weaknesses / recommendations — all collapsible */}
      <Collapsible title="Strengths" defaultOpen icon={CheckCircle} tone="success" count={strengths.length}>
        <BulletList items={strengths} tone="success" emptyText="No strengths noted." />
      </Collapsible>
      <Collapsible title="Weaknesses" defaultOpen icon={AlertTriangle} tone="warning" count={weaknesses.length}>
        <BulletList items={weaknesses} tone="warning" emptyText="No weaknesses noted." />
      </Collapsible>
      <Collapsible title="Recommendations" defaultOpen icon={Lightbulb} tone="accent"
        count={
          (recommendations.topics?.length || 0)
          + (recommendations.problems?.length || 0)
          + (recommendations.concepts?.length || 0)
        }
      >
        <RecommendationList recs={recommendations} />
      </Collapsible>
    </SectionShell>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionShell = ({ title, actions, children }) => (
  <section
    className="glass rounded-2xl p-5 mb-6"
    aria-label={title}
  >
    <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Award size={14} style={{ color: '#58A6FF' }} aria-hidden />
        <h2 className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>{title}</h2>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const SkeletonBody = ({ label }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 rounded-xl" style={{ background: '#161B22', border: '1px solid #30363D' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded" style={{ background: '#161B22', width: '30%' }} />
        <div className="h-2 rounded" style={{ background: '#161B22', width: '90%' }} />
        <div className="h-2 rounded" style={{ background: '#161B22', width: '75%' }} />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-16 rounded" style={{ background: '#161B22', border: '1px solid #21262D' }} />
      ))}
    </div>
    <div className="flex items-center gap-2 mt-2" role="status" aria-live="polite">
      <Loader2 size={12} className="animate-spin" style={{ color: '#58A6FF' }} aria-hidden />
      <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>{label}</span>
    </div>
  </div>
);

const ScoreCard = ({ icon: Icon, label, score }) => {
  const color = colorForScore(score);
  const display = score == null ? '—' : score;
  return (
    <div
      className="flex flex-col p-2.5"
      style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}
      role="group"
      aria-label={`${label} score: ${display} out of 100`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color }} aria-hidden />
        <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color }}>{display}</span>
        <span className="font-mono text-2xs" style={{ color: '#484F58' }}>/100</span>
      </div>
      {score != null && (
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: '#161B22' }}>
          <div style={{ width: `${score}%`, height: '100%', background: color }} />
        </div>
      )}
    </div>
  );
};

const ComplexityPanel = ({ complexity = {} }) => {
  const { time = '', space = '', confidence = 'estimated' } = complexity;
  const isConfirmed = confidence === 'confirmed';
  return (
    <div
      className="p-3"
      style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8 }}
      aria-label="Complexity analysis"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>
          Complexity
        </div>
        <span
          className="text-2xs px-1.5 py-0.5 font-mono uppercase"
          style={{
            background: isConfirmed ? 'rgba(63,185,80,0.1)' : 'rgba(210,153,34,0.1)',
            color: isConfirmed ? '#3FB950' : '#D29922',
            border: `1px solid ${isConfirmed ? 'rgba(63,185,80,0.3)' : 'rgba(210,153,34,0.3)'}`,
            borderRadius: 3,
          }}
        >
          {isConfirmed ? 'Confirmed' : 'Estimated'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Cpu size={10} style={{ color: '#58A6FF' }} aria-hidden />
            <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>Time</span>
          </div>
          <div className="text-xs" style={{ color: '#F0F6FC', lineHeight: 1.4 }}>
            {time || '—'}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Database size={10} style={{ color: '#58A6FF' }} aria-hidden />
            <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>Space</span>
          </div>
          <div className="text-xs" style={{ color: '#F0F6FC', lineHeight: 1.4 }}>
            {space || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

const ExecutionSummary = ({ execution }) => {
  if (!execution || !execution.status) {
    return (
      <div
        className="p-3"
        style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8 }}
        aria-label="Execution summary"
      >
        <div className="text-2xs uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>
          Last Execution
        </div>
        <p className="text-xs" style={{ color: '#6B7280' }}>
          The candidate did not execute their code.
        </p>
      </div>
    );
  }

  const isSubmit = execution.kind === 'submit';
  const passRatio = isSubmit && execution.total ? `${execution.passed ?? 0} / ${execution.total}` : '—';
  return (
    <div
      className="p-3"
      style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8 }}
      aria-label="Execution summary"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xs uppercase tracking-wide" style={{ color: '#6B7280' }}>
          Last Execution
        </div>
        <span className="font-mono text-2xs uppercase" style={{ color: '#9CA3AF' }}>
          {execution.kind || 'run'}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style={{ color: '#F0F6FC' }}>
        <dt className="font-mono text-2xs" style={{ color: '#6B7280' }}>Status</dt>
        <dd>{execution.status}</dd>
        <dt className="font-mono text-2xs" style={{ color: '#6B7280' }}>Time</dt>
        <dd>{execution.executionTime != null ? `${Number(execution.executionTime).toFixed(3)} s` : '—'}</dd>
        <dt className="font-mono text-2xs" style={{ color: '#6B7280' }}>Memory</dt>
        <dd>{execution.memory != null ? `${Number(execution.memory).toLocaleString()} KB` : '—'}</dd>
        {isSubmit && (
          <>
            <dt className="font-mono text-2xs" style={{ color: '#6B7280' }}>Hidden tests</dt>
            <dd>{passRatio}</dd>
          </>
        )}
      </dl>
    </div>
  );
};

const Collapsible = ({ title, defaultOpen = false, icon: Icon, tone = 'accent', count, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const toneColor = tone === 'success' ? '#3FB950' : tone === 'warning' ? '#D29922' : '#58A6FF';
  return (
    <div
      className="mb-2"
      style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8 }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-expanded={open}
        aria-controls={`collapse-${title}`}
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon size={12} style={{ color: toneColor }} aria-hidden />}
          <span className="text-xs font-medium" style={{ color: '#F0F6FC' }}>{title}</span>
          {typeof count === 'number' && count > 0 && (
            <span
              className="font-mono text-2xs px-1.5 py-0.5"
              style={{
                background: `${toneColor}18`, color: toneColor,
                border: `1px solid ${toneColor}55`, borderRadius: 3,
              }}
            >
              {count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={12} style={{ color: '#9CA3AF' }} aria-hidden /> : <ChevronDown size={12} style={{ color: '#9CA3AF' }} aria-hidden />}
      </button>
      {open && (
        <div id={`collapse-${title}`} className="px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
};

const BulletList = ({ items, tone = 'accent', emptyText = 'Nothing to show.' }) => {
  if (!items || items.length === 0) {
    return <p className="text-xs" style={{ color: '#6B7280' }}>{emptyText}</p>;
  }
  const toneColor = tone === 'success' ? '#3FB950' : tone === 'warning' ? '#D29922' : '#58A6FF';
  return (
    <ul className="space-y-1.5" role="list">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#F0F6FC', lineHeight: 1.5 }}>
          <span
            className="mt-1.5 flex-shrink-0"
            style={{ width: 4, height: 4, borderRadius: 999, background: toneColor }}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const RecommendationList = ({ recs = {} }) => {
  const { topics = [], problems = [], concepts = [] } = recs;
  const hasAny = topics.length || problems.length || concepts.length;
  if (!hasAny) return <p className="text-xs" style={{ color: '#6B7280' }}>No recommendations.</p>;
  return (
    <div className="space-y-3">
      {topics.length > 0 && (
        <RecGroup label="Topics to practice" items={topics} chip />
      )}
      {problems.length > 0 && (
        <RecGroup label="Suggested problems" items={problems} />
      )}
      {concepts.length > 0 && (
        <RecGroup label="Concepts to revisit" items={concepts} />
      )}
    </div>
  );
};

const RecGroup = ({ label, items, chip = false }) => (
  <div>
    <div className="font-mono text-2xs uppercase tracking-wide mb-1.5" style={{ color: '#6B7280' }}>
      {label}
    </div>
    {chip ? (
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span
            key={i}
            className="px-2 py-0.5 font-mono text-2xs"
            style={{
              background: '#161B22', border: '1px solid #30363D',
              borderRadius: 999, color: '#58A6FF',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    ) : (
      <BulletList items={items} tone="accent" />
    )}
  </div>
);

// ── Helpers ─────────────────────────────────────────────────────────────────

function colorForScore(s) {
  if (s == null) return '#6B7280';
  if (s >= 80) return '#3FB950';
  if (s >= 60) return '#D29922';
  return '#F85149';
}

function downloadFile(name, contents, mime) {
  try {
    const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${name}`);
  } catch {
    toast.error('Download failed.');
  }
}

function toMarkdown(e) {
  const lines = [];
  lines.push(`# Code Evaluation`);
  lines.push('');
  lines.push(`- **Overall score:** ${e.overallScore ?? '—'} / 100`);
  lines.push(`- **Complexity (time):** ${e.complexity?.time || '—'} _(${e.complexity?.confidence || 'estimated'})_`);
  lines.push(`- **Complexity (space):** ${e.complexity?.space || '—'}`);
  lines.push('');
  lines.push(`## Scores`);
  for (const [k, v] of Object.entries(e.scores || {})) {
    lines.push(`- **${k}:** ${v ?? '—'}`);
  }
  lines.push('');
  if (e.summary) {
    lines.push(`## Summary`);
    lines.push(e.summary);
    lines.push('');
  }
  if (e.communicationFeedback) {
    lines.push(`## Communication`);
    lines.push(e.communicationFeedback);
    lines.push('');
  }
  if ((e.strengths || []).length) {
    lines.push(`## Strengths`);
    e.strengths.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }
  if ((e.weaknesses || []).length) {
    lines.push(`## Weaknesses`);
    e.weaknesses.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }
  const r = e.recommendations || {};
  const hasRec = (r.topics?.length || 0) + (r.problems?.length || 0) + (r.concepts?.length || 0) > 0;
  if (hasRec) {
    lines.push(`## Recommendations`);
    if (r.topics?.length)   { lines.push(`### Topics`);   r.topics.forEach((s) => lines.push(`- ${s}`)); }
    if (r.problems?.length) { lines.push(`### Problems`); r.problems.forEach((s) => lines.push(`- ${s}`)); }
    if (r.concepts?.length) { lines.push(`### Concepts`); r.concepts.forEach((s) => lines.push(`- ${s}`)); }
  }
  return lines.join('\n');
}

export default DsaEvaluationPanel;
