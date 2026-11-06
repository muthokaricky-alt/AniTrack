import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanListInput, MAX_ITEMS } from '../src/customList.js';

const item = (over = {}) => ({ kind: 'anime', mal_id: 1, title: 'Cowboy Bebop', image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg', note: 'Session 5', ...over });

test('a good list passes and is tidied up', () => {
  const { value, error } = cleanListInput({ title: '  Top   10 arcs ', description: '  my picks  ', ranked: true, is_public: false, items: [item()] });
  assert.equal(error, undefined);
  assert.equal(value.title, 'Top 10 arcs');
  assert.equal(value.description, 'my picks');
  assert.equal(value.ranked, true);
  assert.equal(value.is_public, false);
  assert.equal(value.items.length, 1);
  assert.equal(value.items[0].note, 'Session 5');
});

test('only the fields that were sent come back, so editing one thing leaves the rest alone', () => {
  assert.deepEqual(Object.keys(cleanListInput({ is_public: true }).value), ['is_public']);
  assert.deepEqual(cleanListInput({}).value, {});
});

test('titles are required and limited', () => {
  for (const title of ['', '   ', null, 5, 'x'.repeat(81), undefined]) {
    assert.ok(cleanListInput({ title }).error, `should reject ${JSON.stringify(title)}`);
  }
  assert.ok(!cleanListInput({ title: 'x'.repeat(80) }).error);
});

test('description and flags are checked', () => {
  assert.ok(cleanListInput({ description: 'x'.repeat(501) }).error);
  assert.equal(cleanListInput({ description: null }).value.description, null);
  assert.equal(cleanListInput({ description: '   ' }).value.description, null);
  assert.ok(cleanListInput({ description: 5 }).error);
  assert.ok(cleanListInput({ ranked: 'yes' }).error);
  assert.ok(cleanListInput({ is_public: 1 }).error);
});

test('items need a kind, a positive MAL id and a name', () => {
  for (const bad of [item({ kind: 'character' }), item({ kind: undefined }), item({ mal_id: 0 }), item({ mal_id: -2 }), item({ mal_id: 1.5 }), item({ mal_id: 'abc' }), item({ title: '' }), item({ title: '  ' }), null, 'nope']) {
    assert.ok(cleanListInput({ items: [bad] }).error, `should reject ${JSON.stringify(bad)}`);
  }
  assert.ok(cleanListInput({ items: 'nope' }).error);
});

test('the same title can appear more than once, for lists like "Top 10 arcs"', () => {
  const { value } = cleanListInput({ items: [item({ note: 'Marineford' }), item({ note: 'Impel Down' }), item({ kind: 'manga' })] });
  assert.equal(value.items.length, 3);
  assert.deepEqual(value.items.map((i) => i.note), ['Marineford', 'Impel Down', 'Session 5']);
});

test('the item limit is enforced', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => item({ mal_id: i + 1 }));
  assert.equal(cleanListInput({ items: many(MAX_ITEMS) }).value.items.length, MAX_ITEMS);
  assert.ok(cleanListInput({ items: many(MAX_ITEMS + 1) }).error);
});

test('notes are limited and unsafe image links are dropped', () => {
  assert.ok(cleanListInput({ items: [item({ note: 'x'.repeat(281) })] }).error);
  assert.ok(cleanListInput({ items: [item({ note: 5 })] }).error);
  assert.equal(cleanListInput({ items: [item({ note: '  ' })] }).value.items[0].note, null);
  assert.equal(cleanListInput({ items: [item({ image_url: 'javascript:alert(1)' })] }).value.items[0].image_url, null);
});

test('rejects bodies that are not objects', () => {
  for (const bad of [null, undefined, 'x', 5, [], [{ title: 'x' }]]) assert.ok(cleanListInput(bad).error);
});
