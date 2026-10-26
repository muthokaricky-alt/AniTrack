import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LOGGED_STEP, loggedDelta, autoStatus } from '../src/progress.js';

test('a normal update is logged as it is', () => {
  assert.equal(loggedDelta(3, 4), 1);
  assert.equal(loggedDelta(0, 12), 12);
  assert.equal(loggedDelta(10, 35), 25);
});

test('marking a long series as caught up in one go is capped, not logged as 1,158 episodes this week', () => {
  assert.equal(MAX_LOGGED_STEP, 25);
  assert.equal(loggedDelta(0, 1158), 25);
  assert.equal(loggedDelta(0, 26), 25);
  assert.equal(loggedDelta(100, 4000), 25);
});

test('going down, staying the same or missing numbers logs nothing', () => {
  assert.equal(loggedDelta(10, 10), 0);
  assert.equal(loggedDelta(10, 4), 0);
  assert.equal(loggedDelta(null, null), 0);
  assert.equal(loggedDelta(undefined, 3), 3);
  assert.equal(loggedDelta('5', '8'), 3);
  assert.equal(loggedDelta('x', 'y'), 0);
});

test('reaching the last episode completes a series that was being watched', () => {
  assert.equal(autoStatus({ requested: undefined, current: 'watching', done: 12, total: 12 }), 'completed');
  assert.equal(autoStatus({ requested: undefined, current: 'plan_to_watch', done: 12, total: 12 }), 'completed');
  assert.equal(autoStatus({ requested: undefined, current: 'on_hold', done: 13, total: 12 }), 'completed');
  assert.equal(autoStatus({ requested: undefined, current: 'reading', done: 120, total: 120 }), 'completed');
});

test('not finished yet, or no known total: the status is left alone', () => {
  assert.equal(autoStatus({ requested: undefined, current: 'watching', done: 11, total: 12 }), 'watching');
  assert.equal(autoStatus({ requested: undefined, current: 'watching', done: 500, total: null }), 'watching');
  assert.equal(autoStatus({ requested: undefined, current: 'watching', done: 500, total: 0 }), 'watching');
});

test('a status the person picks always wins, and dropped stays dropped', () => {
  assert.equal(autoStatus({ requested: 'watching', current: 'completed', done: 12, total: 12 }), 'watching');
  assert.equal(autoStatus({ requested: 'on_hold', current: 'watching', done: 12, total: 12 }), 'on_hold');
  assert.equal(autoStatus({ requested: undefined, current: 'dropped', done: 12, total: 12 }), 'dropped');
  assert.equal(autoStatus({ requested: undefined, current: 'completed', done: 12, total: 12 }), 'completed');
});
