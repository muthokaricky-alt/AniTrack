import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedImageUrl, cleanImageUrl } from '../src/imageUrl.js';

test('real AniList and MyAnimeList cover addresses are allowed', () => {
  for (const ok of [
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-abc.jpg',
    'https://s1.anilist.co/x.png',
    'https://img.anili.st'.replace('anili.st', 'anilist.co') + '/a.jpg',
    'https://cdn.myanimelist.net/images/anime/1/2.jpg'
  ]) assert.equal(isAllowedImageUrl(ok), true, ok);
});

test('anything else is refused: other hosts, look-alikes, plain http, ports, logins, junk', () => {
  for (const bad of [
    'https://evil.example/pixel.png',
    'http://s4.anilist.co/x.jpg',
    'https://s4.anilist.co.evil.example/x.jpg',
    'https://evil.example/s4.anilist.co/x.jpg',
    'https://anilist.co.evil.example/x.jpg',
    'https://s4.anilist.co:8443/x.jpg',
    'https://user:pass@s4.anilist.co/x.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '//s4.anilist.co/x.jpg',
    'not a url',
    ''
  ]) assert.equal(isAllowedImageUrl(bad), false, bad);
});

test('cleanImageUrl returns the address or null, never something else', () => {
  const good = 'https://s4.anilist.co/x.jpg';
  assert.equal(cleanImageUrl(good), good);
  assert.equal(cleanImageUrl('https://evil.example/x.jpg'), null);
  assert.equal(cleanImageUrl(undefined), null);
  assert.equal(cleanImageUrl({ toString: () => good }), null);
  assert.equal(cleanImageUrl(['https://s4.anilist.co/x.jpg']), null);
  assert.equal(cleanImageUrl(`https://s4.anilist.co/${'a'.repeat(600)}`), null);
});
