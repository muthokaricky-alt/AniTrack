// Rules for saving progress on a list entry. Pure functions with no database, so they are easy to test.

// The most episodes (or chapters) one update can add to the activity log. Jumping a long series straight to "caught up"
// (say One Piece, 0 to 1158) used to be logged as 1,158 episodes watched this week and wrecked the weekly goal and ring.
// Capped, an update still counts as an active day for the streak, but it can't inflate the weekly total.
export const MAX_LOGGED_STEP = 25;

// How much to log when progress goes from `previous` to `next`. 0 means log nothing (no increase).
export function loggedDelta(previous, next) {
  const step = (Number(next) || 0) - (Number(previous) || 0);
  return step > 0 ? Math.min(step, MAX_LOGGED_STEP) : 0;
}

// The status to save. A status the person chose always wins. Otherwise, reaching the last episode or chapter completes the
// entry (unless it is dropped, or already completed), so finished series stop showing up as "continue watching".
export function autoStatus({ requested, current, done, total }) {
  if (requested !== undefined) return requested;
  if (total > 0 && done >= total && current !== 'completed' && current !== 'dropped') return 'completed';
  return current;
}
