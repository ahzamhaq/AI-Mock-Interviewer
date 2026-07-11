import toast from 'react-hot-toast';
import { interviewAPI } from './api';

/**
 * coachActions (frontend) — one implementation of "how to execute a
 * CoachAction" so every surface that renders actions (Continue Learning
 * rail, Coach page, ⌘K palette, notifications) dispatches through the
 * same function.
 *
 * A CoachAction has:
 *   kind    — discriminator
 *   route   — for pure-navigation actions
 *   payload — for actions that POST a new interview
 *   meta    — free-form { topic, interviewId, projectId, questionIndex, ... }
 *
 * Backend also emits `resume`, `retry_weak`, `continue_project` (Sprint 3's
 * Continue Learning shape). We accept those aliases so the rail's existing
 * cards route through this resolver unchanged.
 *
 * Contract:
 *   resolveAction(navigate, action) → Promise<void>
 *   - Never throws. Any failure is toasted and the promise resolves.
 *   - Returns after navigation is triggered (does not wait for the
 *     destination page's data fetches).
 */

/**
 * Legacy-kind mapping. The Sprint 3 recommendations endpoint uses names
 * like `resume` and `retry_weak`; the Sprint 4 CoachAction vocabulary
 * uses `continue_interview` and `practice_now`. The resolver treats them
 * as synonyms so we do not have to churn the recommendations backend.
 */
const KIND_ALIASES = {
  resume: 'continue_interview',
  retry_weak: 'practice_now',
  nav: 'nav',
};

function canonicalKind(kind) {
  return KIND_ALIASES[kind] || kind;
}

async function resolveAction(navigate, action) {
  if (!action) return;
  const kind = canonicalKind(action.kind);

  try {
    switch (kind) {
      // ── Pure navigation ─────────────────────────────────────────────
      case 'nav':
      case 'continue_interview':
      case 'continue_project':
      case 'review_feedback':
      case 'connect_github': {
        if (action.route) navigate(action.route);
        return;
      }

      // ── Create a new interview from a payload ──────────────────────
      case 'practice_now': {
        if (!action.payload) {
          toast.error('This action has no payload.');
          return;
        }
        const res = await interviewAPI.create(action.payload);
        navigate(`/interview/${res.interview.id}`, {
          state: { greeting: res.greeting || '' },
        });
        return;
      }

      // ── Retry a specific question of a specific interview ──────────
      case 'retry_question': {
        const interviewId = action.meta?.interviewId;
        const questionIndex = action.meta?.questionIndex;
        if (!interviewId || questionIndex == null) {
          toast.error('This action is missing a target.');
          return;
        }
        const res = await interviewAPI.retryQuestion(interviewId, questionIndex);
        navigate(`/interview/${res.interview.id}`, {
          state: { greeting: res.greeting || '' },
        });
        return;
      }

      default: {
        // Unknown kind — fall back to route if present, otherwise no-op.
        if (action.route) {
          navigate(action.route);
          return;
        }
        // Silent — an unknown action should never surface a scary error;
        // it just does nothing until the frontend catches up with the
        // backend's vocabulary.
        console.warn('[coachActions] unknown kind:', action.kind);
      }
    }
  } catch (err) {
    toast.error(err?.message || 'Something went wrong');
  }
}

export { resolveAction };
