import { USER_AGENT } from './inputs.js';
import { LIST_QUERY, shapeCollection } from './anilistList.js';

const ANILIST_URL = process.env.ANILIST_URL || 'https://graphql.anilist.co';
export const MAX_CHUNKS = 10; // 500 titles per chunk, so up to 5000 titles

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true });

// One request to AniList. This is user-triggered and rare, so it is kept apart from the shared catalogue client:
// a private or misspelled profile must never count as an AniList outage for everyone else.
async function fetchChunk(variables, fetchFn) {
  let response;
  try {
    response = await fetchFn(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ query: LIST_QUERY, variables }),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw fail(502, 'Could not reach AniList just now. Try again in a moment.');
  }
  const json = await response.json().catch(() => null);
  const message = (json?.errors || []).map((e) => String(e?.message || '')).join('; ');
  if (/private/i.test(message)) throw fail(403, 'That AniList profile is private. Make it public in your AniList settings, import, then switch it back.');
  if (/not found/i.test(message)) throw fail(404, 'No AniList user with that name.');
  if (response.status === 429) throw fail(429, 'AniList is busy. Try again in a minute.');
  if (!response.ok || !json?.data?.MediaListCollection) throw fail(502, 'AniList did not return a list. Try again in a moment.');
  return json.data.MediaListCollection;
}

// Everything on a user's public AniList for one kind, shaped for the import preview.
// Throws an error with .status and .message (safe to show) when AniList refuses or is unreachable.
export async function loadAniList(username, kind, fetchFn = fetch) {
  const collection = { lists: [] };
  for (let chunk = 1; chunk <= MAX_CHUNKS; chunk += 1) {
    const part = await fetchChunk({ userName: username, type: kind === 'manga' ? 'MANGA' : 'ANIME', chunk }, fetchFn);
    collection.lists.push(...(part.lists || []));
    if (!part.hasNextChunk) break;
  }
  return shapeCollection(collection, kind);
}
