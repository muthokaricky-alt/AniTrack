import test from 'node:test';
import assert from 'node:assert/strict';
import { untilText } from './countdown.js';

test('formats days, hours and minutes', () => {
  assert.equal(untilText(2 * 86400 + 4 * 3600 + 59), 'in 2d 4h');
  assert.equal(untilText(5 * 3600 + 10 * 60), 'in 5h 10m');
  assert.equal(untilText(12 * 60), 'in 12m');
});

test('very short waits and times already passed read naturally', () => {
  assert.equal(untilText(30), 'in under a minute');
  assert.equal(untilText(0), 'airing now');
  assert.equal(untilText(-500), 'airing now');
  assert.equal(untilText(NaN), 'airing now');
  assert.equal(untilText(undefined), 'airing now');
});
