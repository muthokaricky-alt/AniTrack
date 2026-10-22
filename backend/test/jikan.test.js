import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  animeShape, mangaShape, jikanConfig, resetBackupState, tryBackup,
  backupTopAnime, backupSeasonNow, backupSearchAnime, backupAnime,
  backupTopManga, backupTrendingManga, backupSearchManga, backupManga
} from '../src/jikan.js';

// A realistic (trimmed) answer from Jikan v4
const fmab = {
  mal_id: 5114, title: 'Sousou no Frieren', title_english: 'Frieren: Beyond Journey\'s End', type: 'TV', episodes: 28,
  status: 'Finished Airing', score: 9.3, year: 2023, aired: { prop: { from: { year: 2023 } } },
  synopsis: 'The demon king has been defeated.',
  trailer: { youtube_id: 'abc_DEF-123' },
  studios: [{ name: 'Madhouse' }],
  genres: [{ mal_id: 2, name: 'Adventure' }, { mal_id: 8, name: 'Drama' }],
  images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/1/small.jpg', large_image_url: 'https://cdn.myanimelist.net/images/anime/1/large.jpg' } }
};
const berserk = {
  mal_id: 2, title: 'Berserk', title_english: null, type: 'Manga', chapters: null, volumes: 41, status: 'Publishing', score: 9.47,
  published: { prop: { from: { year: 1989 } } }, synopsis: 'Guts.', genres: [{ name: 'Action' }],
  images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/manga/1/b.jpg' } }
};

const realFetch = globalThis.fetch;
let calls;
function stubFetch(handler) {
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return handler(String(url));
  };
}
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  resetBackupState();
  Object.assign(jikanConfig, { spacingMs: 0, perMinute: 50, maxWaitMs: 6000, retryMs: 0, cacheMs: 15 * 60 * 1000 });
  delete process.env.BACKUP_SOURCE;
});
afterEach(() => { globalThis.fetch = realFetch; });

test('anime are reshaped into what the pages expect', () => {
  const a = animeShape(fmab);
  assert.equal(a.mal_id, 5114);
  assert.equal(a.title, "Frieren: Beyond Journey's End");
  assert.equal(a.type, 'TV');
  assert.equal(a.episodes, 28);
  assert.equal(a.score, 9.3);
  assert.equal(a.status, 'FINISHED');
  assert.equal(a.year, 2023);
  assert.deepEqual(a.genres, ['Adventure', 'Drama']);
  assert.equal(a.studio, 'Madhouse');
  assert.equal(a.trailer, 'abc_DEF-123');
  assert.equal(a.banner, null);
  assert.equal(a.images.jpg.image_url, 'https://cdn.myanimelist.net/images/anime/1/large.jpg'); // large picture preferred
});

test('anime: missing or odd data never crashes the page', () => {
  assert.equal(animeShape(null), null);
  assert.equal(animeShape({ title: 'no id' }), null);
  const a = animeShape({ mal_id: 1, title: 'Plain', score: 0, status: 'Weird', type: 'TV Special', trailer: { youtube_id: '<script>' }, genres: null, images: {} });
  assert.equal(a.title, 'Plain');
  assert.equal(a.score, null); // Jikan uses 0 for "no score"
  assert.equal(a.status, null);
  assert.equal(a.type, 'TV_SPECIAL');
  assert.equal('trailer' in a, false); // an unsafe trailer id is dropped
  assert.deepEqual(a.genres, []);
  assert.equal(a.images.jpg.image_url, null);
  assert.equal(animeShape({ mal_id: 3, title: 'Old', aired: { prop: { from: { year: 1998 } } } }).year, 1998);
});

test('manga are reshaped, and novels are left out', () => {
  const m = mangaShape(berserk);
  assert.equal(m.title, 'Berserk');
  assert.equal(m.type, 'MANGA');
  assert.equal(m.volumes, 41);
  assert.equal(m.chapters, null);
  assert.equal(m.status, 'RELEASING');
  assert.equal(m.year, 1989);
  assert.equal(m.images.jpg.image_url, 'https://cdn.myanimelist.net/images/manga/1/b.jpg');
  assert.equal(mangaShape({ ...berserk, type: 'Light Novel' }), null);
  assert.equal(mangaShape({ ...berserk, type: 'Novel' }), null);
  assert.equal(mangaShape({ ...berserk, type: 'Manhwa' }).type, 'MANGA');
  assert.equal(mangaShape({ ...berserk, type: 'One-shot' }).type, 'ONE_SHOT');
});

test('top anime: asks Jikan the right question and flags the answer as backup data', async () => {
  stubFetch(() => reply({ pagination: { has_next_page: true }, data: [fmab] }));
  const out = await backupTopAnime('2');
  assert.equal(out.source, 'backup');
  assert.equal(out.pagination.has_next_page, true);
  assert.equal(out.data[0].mal_id, 5114);
  assert.match(calls[0].url, /\/top\/anime\?page=2&limit=20&sfw=true$/);
  assert.match(calls[0].opts.headers['User-Agent'], /AniTrack/);
});

test('this season, search and details use the right Jikan endpoints', async () => {
  stubFetch((url) => (url.includes('/anime/5114') ? reply({ data: fmab }) : reply({ data: [fmab] })));
  await backupSeasonNow();
  await backupSearchAnime('frieren', 3);
  const detail = await backupAnime(5114);
  assert.match(calls[0].url, /\/seasons\/now\?limit=20&sfw=true$/);
  assert.match(calls[1].url, /\/anime\?q=frieren&page=3&limit=20&sfw=true$/);
  assert.match(calls[2].url, /\/anime\/5114$/);
  assert.equal(detail.source, 'backup');
  assert.equal(detail.data.title, "Frieren: Beyond Journey's End");
});

test('search text is URL-encoded, so odd characters cannot change the request', async () => {
  stubFetch(() => reply({ data: [] }));
  await backupSearchAnime('a&sfw=false #x', 1);
  assert.ok(calls[0].url.includes('q=a%26sfw%3Dfalse+%23x'));
  assert.equal((calls[0].url.match(/sfw=/g) || []).length, 1);
});

test('manga: top, trending, search and detail; novels removed from lists', async () => {
  stubFetch((url) => (url.endsWith('/manga/2') ? reply({ data: berserk }) : reply({ data: [berserk, { ...berserk, mal_id: 9, type: 'Novel' }] })));
  const top = await backupTopManga('1');
  assert.equal(top.data.length, 1);
  await backupTrendingManga();
  await backupSearchManga('berserk', 1);
  const one = await backupManga(2);
  assert.match(calls[0].url, /\/top\/manga\?page=1&limit=20&sfw=true$/);
  assert.match(calls[1].url, /\/top\/manga\?filter=publishing&limit=20&sfw=true$/);
  assert.match(calls[2].url, /\/manga\?q=berserk&page=1&limit=20&sfw=true$/);
  assert.equal(one.data.title, 'Berserk');
});

test('repeated titles in a list are shown once', async () => {
  stubFetch(() => reply({ data: [fmab, fmab, { ...fmab, mal_id: 7 }] }));
  const out = await backupSeasonNow();
  assert.deepEqual(out.data.map((a) => a.mal_id), [5114, 7]);
});

test('answers are cached, so a second visitor does not cost another Jikan request', async () => {
  stubFetch(() => reply({ data: [fmab] }));
  await backupTopAnime('1');
  await backupTopAnime('1');
  assert.equal(calls.length, 1);
});

test('if Jikan fails but we have an older answer, the older answer is used', async () => {
  stubFetch(() => reply({ data: [fmab] }));
  await backupTopAnime('1');
  jikanConfig.cacheMs = 0; // everything is now "old"
  stubFetch(() => reply({}, 500));
  const out = await backupTopAnime('1');
  assert.equal(out.data[0].mal_id, 5114);
});

test('a title MyAnimeList does not have gives a 404 error', async () => {
  stubFetch(() => reply({ status: 404 }, 404));
  await assert.rejects(() => backupAnime(999999999), (err) => err.status === 404);
  stubFetch(() => reply({ data: null }));
  await assert.rejects(() => backupAnime(5), (err) => err.status === 404);
});

test('told to slow down (429), it waits once and tries again', async () => {
  let n = 0;
  stubFetch(() => (++n === 1 ? reply({}, 429) : reply({ data: [fmab] })));
  const out = await backupTopAnime('1');
  assert.equal(out.data.length, 1);
  assert.equal(calls.length, 2);
});

test('stays under Jikan\'s per-minute limit instead of getting blocked', async () => {
  jikanConfig.perMinute = 2;
  stubFetch(() => reply({ data: [fmab] }));
  await backupTopAnime('1');
  await backupTopAnime('2');
  await assert.rejects(() => backupTopAnime('3'), (err) => err.status === 503);
  assert.equal(calls.length, 2);
});

test('a long queue is refused rather than making visitors wait', async () => {
  jikanConfig.spacingMs = 5000; // the next free slot is 5 seconds away...
  jikanConfig.maxWaitMs = 4000; // ...which is longer than a visitor should wait
  stubFetch(() => reply({ data: [fmab] }));
  await backupTopAnime('1'); // takes the first slot immediately
  await assert.rejects(() => backupTopAnime('2'), (err) => err.status === 503);
  assert.equal(calls.length, 1);
});

test('tryBackup: answer, not-found, failure and the off switch', async () => {
  assert.deepEqual(await tryBackup(async () => ({ ok: 1 })), { ok: 1 });
  assert.deepEqual(await tryBackup(async () => { throw Object.assign(new Error('x'), { status: 404 }); }), { notFound: true });
  const warn = console.warn; console.warn = () => {};
  assert.equal(await tryBackup(async () => { throw new Error('down'); }), null);
  console.warn = warn;
  process.env.BACKUP_SOURCE = 'off';
  assert.equal(await tryBackup(async () => ({ ok: 1 })), null);
});
