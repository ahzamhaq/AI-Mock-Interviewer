import React from 'react';
import ActionCard from '../common/ActionCard';

/**
 * InterviewTypeCard — thin domain wrapper around ActionCard for the Interviews
 * entry page. Keeps the interview-selection semantics (mode + tagline)
 * separate from the generic primitive so future modes (e.g. Mock Recruiter)
 * can be added by passing a new entry, not by editing card internals.
 *
 * Props: mirror ActionCard, plus:
 *   tagline – short mono line rendered as eyebrow (e.g. "role-based")
 */
const InterviewTypeCard = ({
  icon,
  tagline,
  title,
  description,
  onClick,
  disabled = false,
  badge = null,
}) => (
  <ActionCard
    icon={icon}
    eyebrow={tagline}
    title={title}
    description={description}
    onClick={onClick}
    disabled={disabled}
    badge={badge}
  />
);

export default InterviewTypeCard;
