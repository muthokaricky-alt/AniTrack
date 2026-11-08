import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USERNAME_RE, shapeCollection } from '../src/anilistList.js';

const entry = (over = {}, media = {}) => ({
  status: 'COMPLETED', score: 9, progress: 12, notes: 'great',
  media: { idMal: 1, title: { romaji: 'Sousou no Frieren', english: 'Frieren' }, episodes: 28, chapters: null, genres: ['Adventure', 'Drama'], coverImage: { extraLarge: 'https://s4.anilist.co/x.jpg' }, ...media },
  ...over
});

test('usernames follow the AniList rules', () => {
  for (const ok of ['kyalo', 'a_b', 'User123', 'xx']) assert.ok(USERNAME_RE.test(ok), ok);
  for (const bad of ['', 'a', 'has space', 'semi;colon', 'a'.repeat(21), '../etc', 'ünï']) assert.ok(!USERNAME_RE.test(bad), bad);
});

test('shapes an anime entry into an import row', () => {
  const { rows, skipped } = shapeCollection({ lists: [{ isCustomList: false, entries: [entry()] }] }, 'anime');
  assert.equal(skipped.length, 0);
  assert.deepEqual(rows[0], {
    title: 'Frieren', mal_id: 1, status: 'completed', score: 9, progress: 12, total: 28, review: 'great',
    started_on: null, finished_on: null, rewatches: 0,
    genres: ['Adventure', 'Drama'], ratings: null, image_url: 'https://s4.anilist.co/x.jpg'
  });
});

test('maps every AniList status and uses chapters for manga', () => {
  const statuses = { CURRENT: 'active', REPEATING: 'active', COMPLETED: 'completed', PAUSED: 'on_hold', DROPPED: 'dropped', PLANNING: 'plan' };
  const list = Object.keys(statuses).map((s, i) => entry({ status: s }, { idMal: 100 + i, chapters: 50, episodes: null }));
  const { rows } = shapeCollection({ lists: [{ entries: list }] }, 'manga');
  assert.deepEqual(rows.map((r) => r.status), Object.values(statuses));
  assert.ok(rows.every((r) => r.total === 50));
});

test('scores: zero means unscored, decimals round to half points, and nothing exceeds 10', () => {
  const rows = shapeCollection({ lists: [{ entries: [
    entry({ score: 0 }, { idMal: 1 }), entry({ score: 7.3 }, { idMal: 2 }), entry({ score: 8.74 }, { idMal: 3 }), entry({ score: 99 }, { idMal: 4 }), entry({ score: null }, { idMal: 5 })
  ] }] }, 'anime').rows;
  assert.deepEqual(rows.map((r) => r.score), [null, 7.5, 8.5, 10, null]);
});

test('custom lists and duplicates are ignored; titles without a MyAnimeList id are reported', () => {
  const { rows, skipped } = shapeCollection({ lists: [
    { isCustomList: false, entries: [entry(), entry({}, { idMal: 2 })] },
    { isCustomList: true, entries: [entry({}, { idMal: 3 })] },
    { isCustomList: false, entries: [entry(), entry({}, { idMal: null, title: { romaji: 'AniList Only', english: null } }), entry({}, { idMal: null, title: { romaji: 'AniList Only', english: null } })] }
  ] }, 'anime');
  assert.deepEqual(rows.map((r) => r.mal_id), [1, 2]);
  assert.deepEqual(skipped, ['AniList Only']);
});

test('copes with empty, null and odd data', () => {
  assert.deepEqual(shapeCollection(null, 'anime'), { rows: [], skipped: [] });
  assert.deepEqual(shapeCollection({ lists: null }, 'anime').rows, []);
  const { rows } = shapeCollection({ lists: [{ entries: [null, { media: null }, entry({ progress: -4, notes: '   ', status: 'WEIRD' }, { genres: null, coverImage: null })] }] }, 'anime');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].progress, null);
  assert.equal(rows[0].review, null);
  assert.equal(rows[0].status, null);
  assert.deepEqual(rows[0].genres, []);
  assert.equal(rows[0].image_url, null);
});

test('start and finish dates and repeat counts come across when AniList has them', () => {
  const { rows } = shapeCollection({ lists: [{ entries: [
    entry({ startedAt: { year: 2024, month: 3, day: 9 }, completedAt: { year: 2024, month: 4, day: 1 }, repeat: 2 }, { idMal: 10 }),
    entry({ startedAt: { year: 2024, month: null, day: null }, completedAt: { year: null, month: null, day: null }, repeat: 0 }, { idMal: 11 }),
    entry({ repeat: 500 }, { idMal: 12 })
  ] }] }, 'anime');
  assert.deepEqual([rows[0].started_on, rows[0].finished_on, rows[0].rewatches], ['2024-03-09', '2024-04-01', 2]);
  assert.deepEqual([rows[1].started_on, rows[1].finished_on, rows[1].rewatches], [null, null, 0]); // partial dates are dropped
  assert.equal(rows[2].rewatches, 99);
});
