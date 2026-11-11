// Tests for src/idList.js: parsing comma-separated id lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdList } from '../src/idList.js';

test('accepts a comma list, sorts it and removes duplicates', () => {
  assert.deepEqual(parseIdList('12,5, 9,5'), [5, 9, 12]);
  assert.deepEqual(parseIdList('1'), [1]);
});

test('rejects anything that is not 1 to max positive whole numbers', () => {
  for (const bad of [undefined, null, '', ',', '1,,2', '0', '-3', '1.5', 'abc', '1;2', '12345678901', ['1', '2'], '1 2']) {
    assert.equal(parseIdList(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test('enforces the maximum number of ids', () => {
  const fifty = Array.from({ length: 50 }, (_, i) => i + 1).join(',');
  const fiftyOne = Array.from({ length: 51 }, (_, i) => i + 1).join(',');
  assert.equal(parseIdList(fifty).length, 50);
  assert.equal(parseIdList(fiftyOne), null);
});
