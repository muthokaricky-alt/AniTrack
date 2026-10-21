import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTaste, parseGenres } from '../src/taste.js';

const entry = (kind, mal_id, score, genres) => ({ kind, mal_id, title: `T${mal_id}`, image_url: null, score, genres });

const action = ['Action', 'Adventure'];
const romance = ['Romance', 'Drama'];

test('two identical lists are a near-perfect match', () => {
  const list = [entry('anime', 1, 9, action), entry('anime', 2, 8, action), entry('anime', 3, 7, action), entry('anime', 4, 9, romance)];
  const r = compareTaste(list, list);
  assert.ok(r.percent >= 95, `expected 95+, got ${r.percent}`);
  assert.equal(r.shared_count, 4);
  assert.equal(r.mean_diff, 0);
});

test('different genres and nothing in common is a very low match', () => {
  const a = [entry('anime', 1, 9, action), entry('anime', 2, 8, action)];
  const b = [entry('anime', 10, 9, romance), entry('anime', 11, 8, romance)];
  const r = compareTaste(a, b);
  assert.ok(r.percent <= 10, `expected 10 or less, got ${r.percent}`);
  assert.equal(r.shared_count, 0);
});

test('the result is the same whichever person is "me"', () => {
  const a = [entry('anime', 1, 9, action), entry('anime', 2, 5, romance), entry('anime', 3, 7, action), entry('manga', 4, 8, romance)];
  const b = [entry('anime', 1, 6, action), entry('anime', 2, 5, romance), entry('anime', 3, 8, action), entry('anime', 9, 10, action)];
  assert.equal(compareTaste(a, b).percent, compareTaste(b, a).percent);
});

test('rating shared titles further apart lowers the match', () => {
  const base = [entry('anime', 1, 9, action), entry('anime', 2, 8, action), entry('anime', 3, 7, action)];
  const close = [entry('anime', 1, 9, action), entry('anime', 2, 8, action), entry('anime', 3, 7, action)];
  const far = [entry('anime', 1, 3, action), entry('anime', 2, 2, action), entry('anime', 3, 4, action)];
  assert.ok(compareTaste(base, close).percent > compareTaste(base, far).percent);
});

test('fewer than 3 shared rated titles: the score part is skipped, not counted as zero', () => {
  const a = [entry('anime', 1, 9, action), entry('anime', 2, 8, action)];
  const b = [entry('anime', 1, 9, action), entry('anime', 2, 8, action)];
  const r = compareTaste(a, b);
  assert.equal(r.parts.scores, null);
  assert.equal(r.mean_diff, null);
  assert.ok(r.percent > 0);
});

test('"both loved" needs 8+ from both, "disagree" needs a gap of 2+', () => {
  const a = [entry('anime', 1, 9, action), entry('anime', 2, 9, action), entry('anime', 3, 3, action)];
  const b = [entry('anime', 1, 8, action), entry('anime', 2, 5, action), entry('anime', 3, 9, action)];
  const r = compareTaste(a, b);
  assert.deepEqual(r.both_loved.map((t) => t.mal_id), [1]);
  assert.deepEqual(r.disagree.map((t) => t.mal_id).sort(), [2, 3]);
});

test('an anime and a manga with the same id are different titles', () => {
  const a = [entry('anime', 5, 9, action)];
  const b = [entry('manga', 5, 9, action)];
  assert.equal(compareTaste(a, b).shared_count, 0);
});

test('an empty list gives 0%, not a crash', () => {
  const some = [entry('anime', 1, 9, action)];
  assert.equal(compareTaste([], some).percent, 0);
  assert.equal(compareTaste(some, []).percent, 0);
  assert.equal(compareTaste([], []).percent, 0);
});

test('percent always stays between 0 and 100', () => {
  const a = [entry('anime', 1, 10, action), entry('anime', 2, null, romance)];
  const b = [entry('anime', 1, 1, romance), entry('anime', 2, 10, action)];
  const { percent } = compareTaste(a, b);
  assert.ok(percent >= 0 && percent <= 100);
});

test('parseGenres copes with bad data', () => {
  assert.deepEqual(parseGenres('["Action","Drama"]'), ['Action', 'Drama']);
  assert.deepEqual(parseGenres(null), []);
  assert.deepEqual(parseGenres('not json'), []);
  assert.deepEqual(parseGenres('{"a":1}'), []);
});
