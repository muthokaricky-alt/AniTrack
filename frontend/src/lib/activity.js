import { ACTIVITY_STEP_CAP } from '../constants.js';

// Same format the streak code has always used, so both agree on what "a day" is
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// Progress made per local day. One update counts for at most ACTIVITY_STEP_CAP, so marking a long
// series as caught up does not light up the whole map. kind: 'anime' | 'manga' | null for both.
export function dailyCounts(events, kind = null) {
  const out = new Map();
  for (const e of events || []) {
    if (kind && e.kind !== kind) continue;
    const key = dayKey(new Date(e.ts));
    out.set(key, (out.get(key) || 0) + Math.min(Math.max(Number(e.delta) || 0, 0), ACTIVITY_STEP_CAP));
  }
  return out;
}

// How strongly to colour a day: 0 for nothing, then 1 to 4 relative to the busiest day
export function levelFor(count, max) {
  if (!count || count <= 0) return 0;
  const ratio = count / Math.max(max, 1);
  return ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
}

// A GitHub-style grid: columns are weeks (Monday to Sunday), the last column is this week.
// Days after today are marked future so they can be left blank.
export function buildHeatmap(events, now = new Date(), weeks = 26, kind = null) {
  const counts = dailyCounts(events, kind);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(start.getDate() - (weeks - 1) * 7);

  const cells = [];
  let total = 0;
  let activeDays = 0;
  let max = 0;
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const future = date > today;
    const count = future ? 0 : counts.get(dayKey(date)) || 0;
    total += count;
    if (count > 0) activeDays += 1;
    if (count > max) max = count;
    cells.push({ key: dayKey(date), date, count, future });
  }
  for (const c of cells) c.level = levelFor(c.count, max);
  const grid = Array.from({ length: weeks }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return { weeks: grid, total, activeDays, max };
}

// Rough time spent: episodes times minutes each, in days, to one decimal place
export function daysWatched(episodes, minutesPerEpisode = 24) {
  const n = Number(episodes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(((n * minutesPerEpisode) / 1440) * 10) / 10;
}
