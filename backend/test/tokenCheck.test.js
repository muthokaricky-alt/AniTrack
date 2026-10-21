import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenMatchesUser } from '../src/tokenCheck.js';

const HOUR = 3600;
const now = Math.floor(Date.now() / 1000);
const account = { token_version: 0, created_at: new Date((now - 10 * HOUR) * 1000).toISOString() };

test('a normal, current token is accepted', () => {
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now - HOUR }, account), true);
});

test('a token for an account that no longer exists is refused', () => {
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now }, undefined), false);
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now }, null), false);
});

test('old-style tokens with no version are refused (this logs out anyone holding an old or stolen token)', () => {
  assert.equal(tokenMatchesUser({ userId: 1, iat: now }, account), false);
});

test('a token from before a password change or "log out everywhere" is refused', () => {
  const rotated = { ...account, token_version: 1 };
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now - HOUR }, rotated), false);
  assert.equal(tokenMatchesUser({ userId: 1, v: 1, iat: now }, rotated), true);
});

test('a token made before the account existed is refused (database reset, id reused by someone else)', () => {
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now - 20 * HOUR }, account), false);
});

test('a token made the same second the account was created is accepted', () => {
  const fresh = { token_version: 0, created_at: new Date(now * 1000 + 700).toISOString() };
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now }, fresh), true);
});

test('created_at as a Date object works too, and bad data is refused', () => {
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now }, { token_version: 0, created_at: new Date(account.created_at) }), true);
  assert.equal(tokenMatchesUser({ userId: 1, v: 0 }, account), false);
  assert.equal(tokenMatchesUser({ userId: 1, v: 0, iat: now }, { token_version: 0, created_at: null }), false);
  assert.equal(tokenMatchesUser(null, account), false);
});
