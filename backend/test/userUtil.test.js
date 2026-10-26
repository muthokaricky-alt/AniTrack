import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAvatar, publicUser, parseShape, AVATAR_SHAPES, DEFAULT_AVATAR_SHAPE } from '../src/userUtil.js';

test('no avatar is allowed and becomes null', () => {
  assert.deepEqual(parseAvatar(undefined), { valid: true, value: null });
  assert.deepEqual(parseAvatar(null), { valid: true, value: null });
  assert.deepEqual(parseAvatar(''), { valid: true, value: null });
});

test('small JPEG, PNG and WebP data URLs are accepted', () => {
  for (const type of ['jpeg', 'png', 'webp']) {
    const url = `data:image/${type};base64,AAAA`;
    assert.deepEqual(parseAvatar(url), { valid: true, value: url });
  }
});

test('SVG, other types and non-strings are rejected (SVG can carry scripts)', () => {
  assert.equal(parseAvatar('data:image/svg+xml;base64,AAAA').valid, false);
  assert.equal(parseAvatar('data:text/html;base64,AAAA').valid, false);
  assert.equal(parseAvatar('https://example.com/me.png').valid, false);
  assert.equal(parseAvatar(12345).valid, false);
});

test('oversized avatars are rejected', () => {
  const big = `data:image/png;base64,${'A'.repeat(100001)}`;
  assert.equal(parseAvatar(big).valid, false);
});

test('publicUser never includes the password hash', () => {
  const out = publicUser({ id: 1, username: 'a', email: 'a@b.c', password_hash: 'secret', avatar: null, bio: null, is_public: 1 });
  assert.equal('password_hash' in out, false);
  assert.equal(out.is_public, true);
  assert.equal(out.bio, '');
});

test('profile picture shapes: five are allowed, circle is the default, anything else is refused', () => {
  assert.deepEqual(AVATAR_SHAPES, ['circle', 'square', 'rounded', 'hexagon', 'heart']);
  assert.equal(DEFAULT_AVATAR_SHAPE, 'circle');
  for (const ok of AVATAR_SHAPES) assert.equal(parseShape(ok), ok);
  for (const bad of ['star', 'CIRCLE', '', null, undefined, 5, ['circle']]) assert.equal(parseShape(bad), null);
});

test('publicUser always has a valid shape, even for old rows without one', () => {
  const base = { id: 1, username: 'a', email: 'a@b.c', avatar: null, bio: null, is_public: 1 };
  assert.equal(publicUser(base).avatar_shape, 'circle');
  assert.equal(publicUser({ ...base, avatar_shape: 'heart' }).avatar_shape, 'heart');
  assert.equal(publicUser({ ...base, avatar_shape: 'nonsense' }).avatar_shape, 'circle');
});
