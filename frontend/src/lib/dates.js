// A date coming from the server. It may be ISO text ("2026-10-15T12:00:00.000Z", what Postgres gives us now) or the older
// SQLite style ("2026-10-15 12:00:00", which was always UTC). Returns a Date, or null if it can't be read.
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const d = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/.test(text) ? new Date(`${text.replace(' ', 'T')}Z`) : new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}
