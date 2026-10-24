import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANNER_MAX_CHARS, sniffImageType, dataUrlParts, parseBanner, clampPos, publicBanner } from '../src/banner.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest of the file')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]);
const dataUrl = (type, buf) => `data:image/${type};base64,${buf.toString('base64')}`;

const SERIES = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg';
const COVER = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.jpg';

test('pictures are recognised by their real first bytes, not by what they claim to be', () => {
  assert.equal(sniffImageType(JPEG), 'jpeg');
  assert.equal(sniffImageType(PNG), 'png');
  assert.equal(sniffImageType(WEBP), 'webp');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffImageType(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8])), null); // too short to be a JPEG
});

test('a data URL only counts if the file inside really is the type it says', () => {
  assert.equal(dataUrlParts(dataUrl('jpeg', JPEG)).type, 'jpeg');
  assert.equal(dataUrlParts(dataUrl('png', PNG)).type, 'png');
  assert.equal(dataUrlParts(dataUrl('webp', WEBP)).type, 'webp');
  assert.deepEqual(dataUrlParts(dataUrl('jpeg', JPEG)).buffer, JPEG);
  assert.equal(dataUrlParts(dataUrl('png', JPEG)), null); // says PNG, is a JPEG
  assert.equal(dataUrlParts(dataUrl('jpeg', Buffer.from('<svg></svg>'))), null); // says JPEG, is SVG
  assert.equal(dataUrlParts('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), null);
  assert.equal(dataUrlParts('data:image/jpeg;base64,not base64 !!'), null);
  assert.equal(dataUrlParts('data:text/html;base64,PHNjcmlwdD4='), null);
  assert.equal(dataUrlParts(12345), null);
});

test('removing a banner is allowed: null and empty text both mean "none"', () => {
  assert.deepEqual(parseBanner(null), { valid: true, value: null, kind: null });
  assert.deepEqual(parseBanner(''), { valid: true, value: null, kind: null });
});

test('an uploaded picture is accepted when it is a real JPEG, PNG or WebP', () => {
  for (const [type, buf] of [['jpeg', JPEG], ['png', PNG], ['webp', WEBP]]) {
    const r = parseBanner(dataUrl(type, buf));
    assert.equal(r.valid, true, type);
    assert.equal(r.kind, 'upload');
  }
});

test('uploads are refused when disguised, wrongly typed or too big', () => {
  assert.equal(parseBanner(dataUrl('png', JPEG)).valid, false);
  assert.equal(parseBanner('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').valid, false);
  assert.equal(parseBanner('data:image/gif;base64,R0lGODlh').valid, false);
  const huge = `data:image/jpeg;base64,${Buffer.concat([JPEG, Buffer.alloc(BANNER_MAX_CHARS)]).toString('base64')}`;
  assert.ok(huge.length > BANNER_MAX_CHARS);
  assert.equal(parseBanner(huge).valid, false);
  assert.match(parseBanner(huge).error, /too large/);
});

test('a series banner must be an AniList banner picture', () => {
  const ok = parseBanner(SERIES);
  assert.equal(ok.valid, true);
  assert.equal(ok.kind, 'series');
  assert.equal(parseBanner(COVER).valid, false); // an AniList cover is not a banner
  assert.equal(parseBanner('https://evil.example/file/anilistcdn/media/anime/banner/x.jpg').valid, false);
  assert.equal(parseBanner('http://s4.anilist.co/file/anilistcdn/media/anime/banner/x.jpg').valid, false);
  assert.equal(parseBanner('https://s4.anilist.co.evil.example/media/anime/banner/x.jpg').valid, false);
  assert.equal(parseBanner('javascript:alert(1)').valid, false);
  assert.equal(parseBanner(`${SERIES}?${'a'.repeat(600)}`).valid, false);
});

test('anything that is not text is refused', () => {
  for (const bad of [123, true, {}, [], ['x']]) assert.equal(parseBanner(bad).valid, false);
});

test('the picture position is always a whole number from 0 to 100', () => {
  assert.equal(clampPos(30), 30);
  assert.equal(clampPos('72'), 72);
  assert.equal(clampPos(33.6), 34);
  assert.equal(clampPos(-20), 0);
  assert.equal(clampPos(500), 100);
  assert.equal(clampPos('abc', 40), 40);
  assert.equal(clampPos(undefined), 50);
  assert.equal(clampPos(null, 25), 25);
  assert.equal(clampPos('', 25), 25);
  assert.equal(clampPos(NaN), 50);
});

test('a public profile gets a cacheable address for an uploaded banner, and the AniList address for a series banner', () => {
  assert.deepEqual(
    publicBanner({ username: 'Rick Sanchez', banner_url: null, banner_upload: true, banner_x: 30, banner_y: 70, banner_v: 4 }),
    { src: '/api/users/Rick%20Sanchez/banner?v=4', x: 30, y: 70 }
  );
  assert.deepEqual(
    publicBanner({ username: 'jim', banner_url: SERIES, banner_upload: false, banner_x: 50, banner_y: 50, banner_v: 1 }),
    { src: SERIES, x: 50, y: 50 }
  );
  assert.equal(publicBanner({ username: 'x', banner_url: null, banner_upload: null, banner_x: 50, banner_y: 50, banner_v: 0 }), null);
});
