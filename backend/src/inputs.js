// Small helpers that keep user-supplied search text, page numbers and ids within sane limits.
// Pure functions, so they are easy to test.

// Trim and cap free text (search boxes). Stops someone sending a 1 MB "search".
export const cleanQuery = (value, max = 100) => String(value ?? '').trim().slice(0, max);

// A page number from the URL: a whole number from 1 to max, whatever was sent.
export function clampPage(value, max = 50) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : 1;
}

// A catalogue id from the URL: 1 to 9 digits, nothing else ("1e3", "1.0" and "0x10" are refused).
export const isId = (value) => /^\d{1,9}$/.test(String(value));

// Round a time window outward to whole 5-minute steps, so requests that differ by a few seconds share one cached answer
// (otherwise changing "from" by one second would force a fresh round of upstream requests every time).
export function bucketWindow(from, to, step = 300) {
  return [Math.floor(from / step) * step, Math.ceil(to / step) * step];
}

// The technical reason behind an upstream failure. Handy while developing, but not something to show the public.
export function errDetail(err, env = process.env) {
  if (env.NODE_ENV === 'production' || env.RENDER) return undefined;
  return typeof err === 'string' ? err : err?.message;
}

// What visitors see when the catalogue (AniList) can't be reached and no backup could help.
export const CATALOG_DOWN = "The catalogue (AniList) isn't answering right now. Please try again in a few minutes.";

// AniList's Cloudflare and Jikan both prefer requests that say who they are. Set ANILIST_USER_AGENT to change it.
export const USER_AGENT = process.env.ANILIST_USER_AGENT || 'AniTrack/1.0 (+https://anitrack-0pyj.onrender.com)';
