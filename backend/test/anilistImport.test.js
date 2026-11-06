import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAniList, MAX_CHUNKS } from '../src/anilistImport.js';

const media = (id) => ({ idMal: id, title: { romaji: `Show ${id}`, english: null }, episodes: 12, genres: [], coverImage: null });
const ok = (collection, status = 200) => ({ ok: status < 400, status, json: async () => ({ data: { MediaListCollection: collection } }) });
const errors = (message, status = 404) => ({ ok: false, status, json: async () => ({ data: null, errors: [{ message }] }) });

test('reads a user list and sends the right query variables', async () => {
  let sent;
  const fetchFn = async (url, init) => {
    sent = JSON.parse(init.body);
    return ok({ hasNextChunk: false, lists: [{ isCustomList: false, entries: [{ status: 'CURRENT', score: 8, progress: 3, media: media(5) }] }] });
  };
  const { rows } = await loadAniList('kyalo', 'anime', fetchFn);
  assert.deepEqual(sent.variables, { userName: 'kyalo', type: 'ANIME', chunk: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'active');
});

test('follows chunks until AniList says there are no more, and merges them', async () => {
  const seen = [];
  const fetchFn = async (url, init) => {
    const { chunk } = JSON.parse(init.body).variables;
    seen.push(chunk);
    return ok({ hasNextChunk: chunk < 3, lists: [{ entries: [{ status: 'COMPLETED', score: 7, progress: 1, media: media(chunk) }] }] });
  };
  const { rows } = await loadAniList('kyalo', 'manga', fetchFn);
  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(rows.map((r) => r.mal_id), [1, 2, 3]);
});

test('never asks for more than the chunk limit, even if AniList keeps saying there is more', async () => {
  let calls = 0;
  const fetchFn = async () => { calls += 1; return ok({ hasNextChunk: true, lists: [] }); };
  await loadAniList('kyalo', 'anime', fetchFn);
  assert.equal(calls, MAX_CHUNKS);
});

test('gives clear, safe messages for the failures people will actually hit', async () => {
  const cases = [
    [errors('User not found'), 404, /No AniList user/],
    [errors('Private User', 403), 403, /private/],
    [{ ok: false, status: 429, json: async () => ({}) }, 429, /busy/],
    [{ ok: false, status: 500, json: async () => ({}) }, 502, /did not return a list/],
    [{ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }, 502, /did not return a list/]
  ];
  for (const [reply, status, pattern] of cases) {
    await assert.rejects(() => loadAniList('kyalo', 'anime', async () => reply), (err) => err.expose === true && err.status === status && pattern.test(err.message));
  }
});

test('a network failure becomes a friendly 502 that does not leak details', async () => {
  await assert.rejects(
    () => loadAniList('kyalo', 'anime', async () => { throw new Error('ECONNRESET 10.0.0.1:443'); }),
    (err) => err.status === 502 && !/ECONNRESET|10\.0\.0\.1/.test(err.message)
  );
});
