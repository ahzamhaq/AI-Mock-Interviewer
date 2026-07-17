import React from 'react';
import {
  Briefcase, Building2, Gauge, FileText, GitBranch, Timer, Hash, User, Zap, ListChecks,
} from 'lucide-react';

/**
 * InterviewSummaryCard — reusable presentation of an interview's
 * configuration. One shape, many consumers:
 *   • Review page (Sprint 5 Commit 6)
 *   • History detail (future)
 *   • Results page (future)
 *   • Coach recommendations (future)
 *
 * The `config` prop matches the shape saved on Interview.config plus a
 * few frontend-only optional additions (topics for Review, subMode for
 * project interviews). All fields are optional — the card renders only
 * the rows it has data for.
 *
 * Props:
 *   config    — { role, experienceLevel, targetCompany, companyType,
 *                 interviewType, difficulty, totalQuestions, duration,
 *                 pressure, personalityId, useResume, useProject, topics }
 *   dense     — reduces padding + hides section headers for inline use
 */
const InterviewSummaryCard = ({ config = {}, dense = false }) => {
  const rows = buildRows(config);
  if (rows.length === 0) return null;

  return (
    <div
      className={dense ? 'p-3' : 'p-4'}
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 6,
      }}
    >
      {!dense && (
        <div
          className="font-mono text-2xs uppercase tracking-wide mb-3"
          style={{ color: '#6B7280' }}
        >
          Summary
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon size={11} style={{ color: '#58A6FF', marginTop: 3, flexShrink: 0 }} />
            <div className="min-w-0">
              <dt
                className="font-mono text-2xs uppercase tracking-wide"
                style={{ color: '#6B7280' }}
              >
                {label}
              </dt>
              <dd className="text-xs mt-0.5" style={{ color: '#F0F6FC' }}>
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
};

function buildRows(c) {
  const rows = [];
  if (c.role) rows.push({ icon: Briefcase, label: 'Role', value: String(c.role).replace(/_/g, ' ') });
  if (c.targetCompany || c.company) rows.push({ icon: Building2, label: 'Company', value: c.targetCompany || c.company });
  if (c.experienceLevel || c.experience) rows.push({ icon: User, label: 'Experience', value: labelExperience(c.experienceLevel || c.experience) });
  if (c.interviewType) rows.push({ icon: ListChecks, label: 'Interview Type', value: String(c.interviewType).replace(/_/g, ' ') });
  if (c.difficulty) rows.push({ icon: Gauge, label: 'Difficulty', value: c.difficulty });
  if (typeof c.totalQuestions === 'number') rows.push({ icon: Hash, label: 'Questions', value: c.totalQuestions });
  if (typeof c.duration === 'number') rows.push({ icon: Timer, label: 'Duration', value: `${c.duration} min` });
  if (c.pressure) rows.push({ icon: Zap, label: 'Pressure', value: c.pressure });
  if (c.personalityId || c.personality) rows.push({ icon: User, label: 'Personality', value: c.personalityId || c.personality });
  if (c.useResume) rows.push({ icon: FileText, label: 'Resume', value: 'Enabled' });
  if (c.useProject || c.projectMode) rows.push({ icon: GitBranch, label: 'Project', value: 'Enabled' });
  if (Array.isArray(c.topics) && c.topics.length) {
    rows.push({ icon: ListChecks, label: 'Topics', value: c.topics.slice(0, 6).join(', ') });
  }
  return rows;
}

function labelExperience(v) {
  if (v === 'fresher') return 'Fresher';
  if (v === '1-2_years') return '1–2 years';
  if (v === '3+_years') return '3+ years';
  return v;
}

export default InterviewSummaryCard;
