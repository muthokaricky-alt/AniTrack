// A date coming from the server. It may be ISO text ("2026-10-15T12:00:00.000Z", what Postgres gives us now) or the older
// SQLite style ("2026-10-15 12:00:00", which was always UTC). Returns a Date, or null if it can't be read.
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const d = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/.test(text) ? new Date(`${text.replace(' ', 'T')}Z`) : new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Today as the person's own calendar day, "2026-11-08". Sent with list changes so a start or finish date
// matches their clock rather than the server's.
export function todayLocal(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
