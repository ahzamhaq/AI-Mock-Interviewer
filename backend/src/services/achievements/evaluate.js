const { ACHIEVEMENTS, getAchievement } = require('./registry');

/**
 * evaluate — given a user and a trigger event, return the badge ids that
 * SHOULD be freshly unlocked. Pure function; does not mutate the user or
 * persist anything. Callers apply the returned ids to `user.badges` and
 * save.
 *
 * Idempotency: if the user already has a badge, it is NOT re-emitted.
 * The hasBadge helper tolerates both String[] (legacy) and
 * {id, unlockedAt}[] (Sprint 4 Commit 8) shapes so this code path is
 * migration-safe.
 *
 * Safety: each achievement's evaluate() runs in isolation with a try/catch
 * so one buggy definition can never block others from unlocking.
 */
function evaluate(user, event) {
  if (!user || !event?.kind) return [];

  const newlyUnlocked = [];
  for (const def of ACHIEVEMENTS) {
    if (user.hasBadge(def.id)) continue;
    try {
      if (def.evaluate(user, event)) {
        newlyUnlocked.push(def.id);
      }
    } catch (err) {
      // A broken predicate must never take down the whole request. Log and
      // move on; the badge simply won't unlock for this event.
      console.error(`[achievements] evaluator for "${def.id}" threw:`, err.message);
    }
  }
  return newlyUnlocked;
}

/**
 * Push newly-unlocked badge ids onto user.badges. Sprint 4 Commit 8:
 * badge entries are now { id, unlockedAt } objects. The User schema's
 * pre-save hook normalizes any surviving legacy string entries so mixed
 * arrays self-heal over time.
 *
 * Returns the array of ids actually pushed. Idempotent — hasBadge()
 * gates each push so duplicate calls with the same ids are safe.
 */
function applyUnlocks(user, ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const applied = [];
  const now = new Date();
  for (const id of ids) {
    if (user.hasBadge(id)) continue;
    user.badges.push({ id, unlockedAt: now });
    applied.push(id);
  }
  return applied;
}

/**
 * Convenience — the shape the frontend needs to toast unlocks: id + title +
 * description + icon. Wraps registry lookups so controllers stay ignorant
 * of the registry's internal shape.
 */
function describeUnlocks(ids) {
  return (ids || [])
    .map((id) => {
      const def = getAchievement(id);
      if (!def) return null;
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        icon: def.icon,
      };
    })
    .filter(Boolean);
}

module.exports = { evaluate, applyUnlocks, describeUnlocks };
