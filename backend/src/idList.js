// "12,5,9" from a query string to [5, 9, 12], or null when it is not 1..max positive whole numbers.
export function parseIdList(raw, max = 50) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 600) return null;
  const parts = [...new Set(raw.split(',').map((s) => s.trim()))];
  if (parts.length === 0 || parts.length > max) return null;
  const ids = [];
  for (const p of parts) {
    if (!/^\d{1,9}$/.test(p)) return null;
    const n = Number(p);
    if (n <= 0) return null;
    ids.push(n);
  }
  return ids.sort((a, b) => a - b);
}
