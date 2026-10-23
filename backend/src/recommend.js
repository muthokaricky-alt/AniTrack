// Rules for "recommend to a friend". Pure functions with no database, so they are easy to test.

export const NOTE_MAX = 140; // a short note, like a text message
export const MAX_PER_HOUR = 20; // most recommendations one person can send in an hour
export const MAX_PER_RECIPIENT_PER_DAY = 10; // most they can send to one friend in a day
export const BOX_LIMIT = 50; // how many items the inbox and the sent list show

export const parseKind = (value) => (value === 'anime' || value === 'manga' ? value : null);

// A note is plain text: control characters and line breaks become spaces, runs of spaces collapse, and it is cut to
// `max` characters (counted as whole characters, so an emoji is never sliced in half). Empty or non-text means no note (null).
export function cleanNote(value, max = NOTE_MAX) {
  const text = (typeof value === 'string' ? value : '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, max).join('').trim() || null;
}

// A message when the sender has hit a limit, or null when the recommendation may go ahead
export function limitMessage({ lastHour, toRecipientToday }) {
  if (lastHour >= MAX_PER_HOUR) return `You can send up to ${MAX_PER_HOUR} recommendations an hour. Try again a bit later.`;
  if (toRecipientToday >= MAX_PER_RECIPIENT_PER_DAY) return `You have already sent ${MAX_PER_RECIPIENT_PER_DAY} recommendations to this friend today. Give them a breather!`;
  return null;
}
