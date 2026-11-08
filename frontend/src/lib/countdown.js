// "in 2d 4h", "in 5h 10m", "in 12m", or "airing now" for a number of seconds
export function untilText(secs) {
  if (!(secs > 0)) return 'airing now';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return m > 0 ? `in ${m}m` : 'in under a minute';
}
