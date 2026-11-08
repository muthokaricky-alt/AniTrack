// Dates on list entries are plain "2026-11-08" strings (no time, no time zone).

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isoDate = (d) => d.toISOString().slice(0, 10);

function real(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// undefined stays undefined (nothing was sent), null or '' means clear it, a real date from 1950 up to
// tomorrow (a day of slack for time zones) is returned as is, and anything else is NaN.
export function dateField(value, now = new Date()) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const m = typeof value === 'string' ? ISO.exec(value) : null;
  if (!m) return NaN;
  if (!real(Number(m[1]), Number(m[2]), Number(m[3])) || Number(m[1]) < 1950) return NaN;
  return value > isoDate(new Date(now.getTime() + 86400000)) ? NaN : value; // ISO dates compare correctly as text
}

// "Today" for filling in a start or finish date. The browser knows the person's own day, so use it
// when it is within a day of the server's; otherwise fall back to the server's date.
export function todayFrom(clientToday, now = new Date()) {
  const server = isoDate(now);
  const t = dateField(clientToday, now);
  if (typeof t !== 'string') return server;
  const days = Math.abs(Date.parse(`${t}T00:00:00Z`) - Date.parse(`${server}T00:00:00Z`)) / 86400000;
  return days <= 1 ? t : server;
}

// AniList stores dates as { year, month, day } with any part possibly missing
export function fuzzyToIso(d) {
  if (!d || !Number.isInteger(d.year) || !Number.isInteger(d.month) || !Number.isInteger(d.day)) return null;
  if (!real(d.year, d.month, d.day) || d.year < 1950) return null;
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}
