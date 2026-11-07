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

// ----- favourites -----
import { compareFavourites } from '../src/taste.js';
const fav = (kind, mal_id) => ({ kind, mal_id, title: `F${mal_id}`, image_url: null });

test('compareFavourites finds shared favourites and applies the 40% rule', () => {
  const r = compareFavourites([fav('anime', 1), fav('anime', 2), fav('manga', 3), fav('anime', 4)], [fav('anime', 1), fav('manga', 3), fav('anime', 9)]);
  assert.deepEqual(r.shared.map((s) => `${s.kind}:${s.mal_id}`), ['anime:1', 'manga:3']);
  assert.equal(r.overlap, 1); // 2 of the smaller set's 3 is well past 40%
  assert.equal(compareFavourites([fav('anime', 1)], [fav('anime', 2)]).overlap, 0);
});

test('the same id as anime and as manga are different favourites', () => {
  assert.equal(compareFavourites([fav('anime', 5)], [fav('manga', 5)]).shared.length, 0);
});

test('compareFavourites gives null overlap when either side has no favourites', () => {
  assert.equal(compareFavourites([], [fav('anime', 1)]).overlap, null);
  assert.equal(compareFavourites([fav('anime', 1)], []).overlap, null);
  assert.equal(compareFavourites().overlap, null);
});

test('without favourites the result is exactly what it was before, and says it is based on the lists', () => {
  const list = [entry('anime', 1, 9, action), entry('anime', 2, 8, action), entry('anime', 3, 7, action)];
  const plain = compareTaste(list, list);
  const withEmpty = compareTaste(list, list, { mine: [], theirs: [] });
  assert.equal(plain.percent, withEmpty.percent);
  assert.equal(plain.basis, 'lists');
  assert.equal(plain.parts.favourites, null);
  assert.deepEqual(plain.shared_favourites, []);
});

test('favourites join the blend when both people have lists and favourites', () => {
  const list = [entry('anime', 1, 9, action), entry('anime', 2, 8, action), entry('anime', 3, 7, action)];
  const same = [fav('anime', 1), fav('anime', 2)];
  const r = compareTaste(list, list, { mine: same, theirs: same });
  assert.equal(r.basis, 'both');
  assert.equal(r.parts.favourites, 100);
  assert.equal(r.shared_favourites_count, 2);
  const apart = compareTaste(list, list, { mine: [fav('anime', 1)], theirs: [fav('anime', 7)] });
  assert.equal(apart.parts.favourites, 0);
  assert.ok(apart.percent < r.percent, 'no shared favourites should pull the match down');
});

test('someone with only favourites can still be matched, on favourites alone', () => {
  const r = compareTaste([], [], { mine: [fav('anime', 1), fav('anime', 2), fav('anime', 3)], theirs: [fav('anime', 2), fav('anime', 3), fav('manga', 8)] });
  assert.equal(r.basis, 'favourites');
  assert.equal(r.percent, 100);
  assert.equal(r.parts.genres, null);
  assert.equal(r.parts.scores, null);
  assert.equal(r.parts.overlap, null);
  assert.deepEqual(r.shared_favourites.map((s) => s.mal_id), [2, 3]);
  const none = compareTaste([], [], { mine: [fav('anime', 1)], theirs: [fav('anime', 2)] });
  assert.equal(none.percent, 0);
  assert.equal(none.basis, 'favourites');
});

test('one empty list with a full one only compares favourites, and nothing at all is a quiet zero', () => {
  const list = [entry('anime', 1, 9, action)];
  const r = compareTaste(list, [], { mine: [fav('anime', 1)], theirs: [fav('anime', 1)] });
  assert.equal(r.basis, 'favourites');
  assert.equal(r.percent, 100);
  assert.equal(compareTaste([], []).percent, 0);
});

test('shared favourites are capped at six for display but counted in full', () => {
  const many = Array.from({ length: 9 }, (_, i) => fav('anime', i + 1));
  const r = compareTaste([], [], { mine: many, theirs: many });
  assert.equal(r.shared_favourites.length, 6);
  assert.equal(r.shared_favourites_count, 9);
});
