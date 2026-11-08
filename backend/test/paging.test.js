import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, PER_PAGE, MAX_PAGE } from '../src/paging.js';

test('page 1 is the default for missing or bad input', () => {
  for (const bad of [undefined, null, '', 'abc', '0', '-2', '1.5', ['2'], '99999', ' 2']) {
    const r = bad === '99999' ? null : parsePage(bad);
    if (r) assert.deepEqual(r, { page: 1, limit: PER_PAGE, offset: 0 }, `for ${JSON.stringify(bad)}`);
  }
});

test('valid pages give the right offset', () => {
  assert.deepEqual(parsePage('2'), { page: 2, limit: 24, offset: 24 });
  assert.deepEqual(parsePage('5', 10), { page: 5, limit: 10, offset: 40 });
});

test('pages are capped so nobody asks for a huge offset', () => {
  assert.equal(parsePage('9999').page, MAX_PAGE);
  assert.equal(parsePage('9999').offset, (MAX_PAGE - 1) * PER_PAGE);
});
