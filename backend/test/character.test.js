import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCharacterText, birthdayText, characterShape } from '../src/character.js';

test('spoilers are removed completely, so nobody gets plot twists on a profile', () => {
  assert.equal(cleanCharacterText('A cheerful captain. ~!He dies in chapter 50.!~ He loves meat.'), 'A cheerful captain.  He loves meat.');
  assert.equal(cleanCharacterText('Before ~!secret one!~ middle ~!secret two\nspanning lines!~ after'), 'Before  middle  after');
  assert.equal(cleanCharacterText('Dangling ~! marker'), 'Dangling  marker');
});

test('AniList mark-up becomes plain, readable text', () => {
  assert.equal(cleanCharacterText('__Height:__ 181 cm<br>__Age:__ 17'), 'Height: 181 cm\nAge: 17');
  assert.equal(cleanCharacterText('**Bold** and ~~struck~~ words'), 'Bold and struck words');
  assert.equal(cleanCharacterText('See [the wiki](https://example.com/x) now'), 'See the wiki now');
  assert.equal(cleanCharacterText('Before img220(https://example.com/pic.jpg) after'), 'Before  after');
  assert.equal(cleanCharacterText('<script>alert(1)</script>Hello <b>there</b>'), 'alert(1)Hello there'); // tags are dropped, never executed
});

test('blank lines are tidied and the text is trimmed', () => {
  assert.equal(cleanCharacterText('  one\r\n\r\n\r\n\r\ntwo   \n'), 'one\n\ntwo');
  assert.equal(cleanCharacterText(null), '');
  assert.equal(cleanCharacterText(undefined), '');
});

test('long text is cut at a word boundary with an ellipsis', () => {
  const long = 'word '.repeat(600);
  const out = cleanCharacterText(long, 100);
  assert.ok(out.length <= 101, out.length);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.slice(0, -1).endsWith(' ')); // no dangling space
  assert.equal(cleanCharacterText('short text'), 'short text');
});

test('birthdays read naturally', () => {
  assert.equal(birthdayText({ month: 3, day: 11 }), 'March 11');
  assert.equal(birthdayText({ month: 12, day: 31 }), 'December 31');
  assert.equal(birthdayText({ month: 7, day: null }), 'July');
  assert.equal(birthdayText({ month: null, day: 5 }), null);
  assert.equal(birthdayText({ month: 13, day: 5 }), null);
  assert.equal(birthdayText({ month: 2, day: 40 }), 'February');
  assert.equal(birthdayText(null), null);
});

test('a character is reshaped into safe fields, and only series that can be opened in AniTrack are listed', () => {
  const out = characterShape({
    id: 5, name: { full: 'Ichigo Kurosaki', native: '黒崎一護', alternative: ['Strawberry', '', null, 'Ichi', 'A', 'B', 'C'] },
    image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/b5-x.png' },
    description: '__Age:__ 15 ~!spoiler!~', gender: 'Male', age: '15', dateOfBirth: { month: 7, day: 15 }, bloodType: 'A', favourites: 1234,
    media: { nodes: [
      { idMal: 269, type: 'ANIME', format: 'TV', title: { romaji: 'Bleach', english: null }, coverImage: { large: 'https://s4.anilist.co/c.jpg' } },
      { idMal: null, type: 'ANIME', format: 'TV', title: { romaji: 'No MAL id' }, coverImage: {} },
      { idMal: 2, type: 'MANGA', format: 'MANGA', title: { romaji: 'Bleach manga' }, coverImage: { large: 'https://evil.example/x.jpg' } }
    ] }
  });
  assert.equal(out.name, 'Ichigo Kurosaki');
  assert.equal(out.native, '黒崎一護');
  assert.deepEqual(out.alternative, ['Strawberry', 'Ichi', 'A', 'B']);
  assert.equal(out.description, 'Age: 15');
  assert.equal(out.birthday, 'July 15');
  assert.equal(out.favourites, 1234);
  assert.deepEqual(out.appears_in.map((a) => [a.mal_id, a.kind]), [[269, 'anime'], [2, 'manga']]);
  assert.equal(out.appears_in[1].image_url, null); // a picture from another website is dropped
  assert.equal(out.image_url, 'https://s4.anilist.co/file/anilistcdn/character/large/b5-x.png');
});

test('missing data never crashes the dialog', () => {
  assert.equal(characterShape(null), null);
  const out = characterShape({ id: 1, name: {}, media: null });
  assert.equal(out.name, 'Unknown');
  assert.deepEqual(out.appears_in, []);
  assert.equal(out.image_url, null);
  assert.equal(out.favourites, null);
});
