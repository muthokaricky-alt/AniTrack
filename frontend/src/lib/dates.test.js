import test from 'node:test';
import assert from 'node:assert/strict';
import { todayLocal } from './dates.js';

test('todayLocal gives the local calendar day with padding', () => {
  assert.equal(todayLocal(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
  assert.equal(todayLocal(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});
