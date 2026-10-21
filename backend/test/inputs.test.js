import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery, clampPage, isId, bucketWindow, errDetail } from '../src/inputs.js';

test('search text is trimmed and capped', () => {
  assert.equal(cleanQuery('  naruto  '), 'naruto');
  assert.equal(cleanQuery('a'.repeat(5000)).length, 100);
  assert.equal(cleanQuery(undefined), '');
  assert.equal(cleanQuery(null), '');
  assert.equal(cleanQuery('x'.repeat(100), 40).length, 40);
});

test('page numbers are always a whole number from 1 to 50', () => {
  assert.equal(clampPage('3'), 3);
  assert.equal(clampPage(undefined), 1);
  assert.equal(clampPage('abc'), 1);
  assert.equal(clampPage('-5'), 1);
  assert.equal(clampPage('0'), 1);
  assert.equal(clampPage('2.9'), 2);
  assert.equal(clampPage('999999999'), 50);
  assert.equal(clampPage('Infinity'), 1);
  assert.equal(clampPage('1e308'), 50);
});

test('ids must be 1 to 9 plain digits', () => {
  for (const ok of ['1', '269', '122663', '000123', '999999999']) assert.equal(isId(ok), true, ok);
  for (const bad of ['', '1e3', '1.0', '-5', '0x10', ' 5', '5 ', 'abc', '1234567890', '１２３']) assert.equal(isId(bad), false, bad);
});

test('schedule windows are rounded outward to 5 minutes, so near-identical requests share a cache entry', () => {
  assert.deepEqual(bucketWindow(1000000, 1000300), [999900, 1000500]);
  const a = bucketWindow(1700000110, 1700600000); // both "from" values sit in the same 5-minute step
  const b = bucketWindow(1700000250, 1700599999);
  assert.deepEqual(a, b);
  assert.deepEqual(bucketWindow(1700000100, 1700600100), [1700000100, 1700600100]); // already on a 5-minute boundary: unchanged
  assert.ok(bucketWindow(1700000123, 1700600321)[0] <= 1700000123);
  assert.ok(bucketWindow(1700000123, 1700600321)[1] >= 1700600321);
});

test('technical error details are hidden in production', () => {
  assert.equal(errDetail(new Error('AniList request failed: 429'), { NODE_ENV: 'production' }), undefined);
  assert.equal(errDetail('timeout', { RENDER: 'true' }), undefined);
  assert.equal(errDetail(new Error('boom'), {}), 'boom');
  assert.equal(errDetail('plain text', {}), 'plain text');
});
