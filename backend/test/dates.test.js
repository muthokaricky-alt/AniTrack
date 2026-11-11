// Tests for src/dates.js: date checks, the person's own 'today' and AniList dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateField, todayFrom, fuzzyToIso } from '../src/dates.js';

const NOW = new Date('2026-11-08T10:00:00Z');

test('dateField accepts real dates and passes undefined and clearing through', () => {
  assert.equal(dateField('2026-11-08', NOW), '2026-11-08');
  assert.equal(dateField('1999-02-28', NOW), '1999-02-28');
  assert.equal(dateField(undefined, NOW), undefined);
  assert.equal(dateField(null, NOW), null);
  assert.equal(dateField('', NOW), null);
});

test('dateField rejects anything that is not a real, recent-enough date', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '0000-00-00', '1949-12-31', '08/11/2026', '2026-1-5', 'yesterday', 5, {}, [], '2026-11-08T00:00:00Z']) {
    assert.ok(Number.isNaN(dateField(bad, NOW)), `should reject ${JSON.stringify(bad)}`);
  }
});

test('leap days are handled', () => {
  assert.equal(dateField('2024-02-29', NOW), '2024-02-29');
  assert.ok(Number.isNaN(dateField('2025-02-29', NOW)));
});

test('the future is not allowed, apart from a day of time zone slack', () => {
  assert.equal(dateField('2026-11-09', NOW), '2026-11-09');
  assert.ok(Number.isNaN(dateField('2026-11-10', NOW)));
});

test("todayFrom uses the browser's day when it is close to the server's, and the server's otherwise", () => {
  assert.equal(todayFrom('2026-11-09', NOW), '2026-11-09');
  assert.equal(todayFrom('2026-11-07', NOW), '2026-11-07');
  assert.equal(todayFrom('2026-11-01', NOW), '2026-11-08');
  assert.equal(todayFrom('rubbish', NOW), '2026-11-08');
  assert.equal(todayFrom(undefined, NOW), '2026-11-08');
});

test('AniList fuzzy dates need all three parts', () => {
  assert.equal(fuzzyToIso({ year: 2024, month: 3, day: 9 }), '2024-03-09');
  assert.equal(fuzzyToIso({ year: 2024, month: null, day: null }), null);
  assert.equal(fuzzyToIso({ year: 2024, month: 2, day: 31 }), null);
  assert.equal(fuzzyToIso(null), null);
  assert.equal(fuzzyToIso({}), null);
});
