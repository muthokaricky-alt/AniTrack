import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, dailyCounts, levelFor, buildHeatmap, daysWatched } from './activity.js';
import { ACTIVITY_STEP_CAP } from '../constants.js';

// noon UTC keeps each event on the same calendar day in every time zone
const ev = (iso, delta = 1, kind = 'anime') => ({ ts: `${iso}T12:00:00Z`, kind, delta });
const NOW = new Date(2026, 10, 8, 15); // Sunday 8 November 2026, local time

test('dayKey matches the format the streak code uses', () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-1-5');
});

test('daily counts add up per day, cap one update, and can be filtered by kind', () => {
  const events = [ev('2026-11-06', 3), ev('2026-11-06', 2), ev('2026-11-07', 500), ev('2026-11-07', 4, 'manga')];
  const both = dailyCounts(events);
  assert.equal(both.get(dayKey(new Date(2026, 10, 6))), 5);
  assert.equal(both.get(dayKey(new Date(2026, 10, 7))), ACTIVITY_STEP_CAP + 4);
  assert.equal(dailyCounts(events, 'manga').get(dayKey(new Date(2026, 10, 7))), 4);
  assert.equal(dailyCounts(events, 'anime').size, 2);
  assert.equal(dailyCounts(null).size, 0);
});

test('negative or broken deltas count as nothing', () => {
  const c = dailyCounts([ev('2026-11-06', -5), ev('2026-11-06', 'abc')]);
  assert.equal(c.get(dayKey(new Date(2026, 10, 6))), 0);
});

test('levels run from 0 to 4 relative to the busiest day', () => {
  assert.equal(levelFor(0, 10), 0);
  assert.equal(levelFor(1, 10), 1);
  assert.equal(levelFor(3, 10), 2);
  assert.equal(levelFor(6, 10), 3);
  assert.equal(levelFor(10, 10), 4);
  assert.equal(levelFor(1, 1), 4);
  assert.equal(levelFor(5, 0), 4); // no division by zero
});

test('the grid has the right shape and today lands in the last column', () => {
  const h = buildHeatmap([ev('2026-11-08', 2), ev('2026-11-02', 6), ev('2026-05-20', 1)], NOW, 26);
  assert.equal(h.weeks.length, 26);
  assert.ok(h.weeks.every((w) => w.length === 7));
  // 8 Nov 2026 is a Sunday, so it is the last cell of the last (Monday to Sunday) column
  const last = h.weeks[25][6];
  assert.equal(last.key, '2026-11-8');
  assert.equal(last.count, 2);
  assert.equal(last.future, false);
  assert.equal(h.weeks[25][0].key, '2026-11-2'); // that week's Monday
  assert.equal(h.total, 9);
  assert.equal(h.activeDays, 3);
  assert.equal(h.max, 6);
  assert.equal(h.weeks[25][0].level, 4);
});

test('days after today are marked as future and never counted', () => {
  const wed = new Date(2026, 10, 4, 9); // Wednesday
  const h = buildHeatmap([ev('2026-11-05', 9)], wed, 4);
  const lastWeek = h.weeks[3];
  assert.equal(lastWeek[2].future, false); // Wednesday itself
  assert.equal(lastWeek[3].future, true);  // Thursday
  assert.equal(lastWeek[3].count, 0);
  assert.equal(h.total, 0);
});

test('an empty history gives an empty but well-formed grid', () => {
  const h = buildHeatmap([], NOW, 10);
  assert.equal(h.total, 0);
  assert.equal(h.activeDays, 0);
  assert.ok(h.weeks.flat().every((c) => c.level === 0));
});

test('days watched is episodes times minutes, rounded to one decimal', () => {
  assert.equal(daysWatched(60), 1); // 60 x 24 min = exactly 1 day
  assert.equal(daysWatched(3412), 56.9);
  assert.equal(daysWatched(10, 30), 0.2);
  assert.equal(daysWatched(0), 0);
  assert.equal(daysWatched(-4), 0);
  assert.equal(daysWatched('x'), 0);
});
