import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOP15_MAX, withTop3First, withoutTop3 } from '../src/top3.js';

const it = (id) => ({ item_id: id, title: `T${id}`, image_url: null, sub: null });
const ids = (list) => list.map((i) => i.item_id);

test('the Top 15 starts with the Top 3, in order, followed by the other picks', () => {
  assert.deepEqual(ids(withTop3First([it(1), it(2), it(3)], [it(10), it(11)])), [1, 2, 3, 10, 11]);
});

test('anything already in the Top 3 is not repeated further down', () => {
  assert.deepEqual(ids(withTop3First([it(1), it(2), it(3)], [it(2), it(10), it(1), it(11)])), [1, 2, 3, 10, 11]);
});

test('with fewer than three in the Top 3, the rest of the list follows straight on', () => {
  assert.deepEqual(ids(withTop3First([it(1)], [it(10), it(11)])), [1, 10, 11]);
  assert.deepEqual(ids(withTop3First([], [it(10), it(11)])), [10, 11]);
  assert.deepEqual(ids(withTop3First([it(1), it(2)], [])), [1, 2]);
});

test('the result never has more than 15 entries', () => {
  assert.equal(TOP15_MAX, 15);
  const rest = Array.from({ length: 20 }, (_, i) => it(100 + i));
  const out = withTop3First([it(1), it(2), it(3)], rest);
  assert.equal(out.length, 15);
  assert.deepEqual(ids(out).slice(0, 4), [1, 2, 3, 100]);
});

test('changing the Top 3 changes the start of the Top 15 on its own', () => {
  const stored = [it(10), it(11)];
  assert.deepEqual(ids(withTop3First([it(1), it(2), it(3)], stored)), [1, 2, 3, 10, 11]);
  assert.deepEqual(ids(withTop3First([it(7), it(2), it(3)], stored)), [7, 2, 3, 10, 11]);
  assert.deepEqual(ids(withTop3First([it(10), it(2), it(3)], stored)), [10, 2, 3, 11]); // 10 moved up into the Top 3
});

test('what gets stored for the Top 15 leaves the Top 3 picks out', () => {
  assert.deepEqual(ids(withoutTop3([it(1), it(2), it(3), it(10), it(11)], [it(1), it(2), it(3)])), [10, 11]);
  assert.deepEqual(ids(withoutTop3([it(10)], [])), [10]);
});
