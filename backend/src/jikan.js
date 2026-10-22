// A small BACKUP data source for when AniList can't be reached: the Jikan API, a free read-only wrapper around MyAnimeList
// (no key needed). AniTrack identifies every title by its MyAnimeList id, so answers from here drop straight into the same
// pages, lists and favourites.
//
// It deliberately covers only the discovery pages: browse, search and detail pages for anime and manga. Anything that needs
// AniList-only data (the airing schedule, "for you", the airing tracker) keeps showing the normal error.
//
// Jikan allows 3 requests a second and 60 a minute, so every call is spaced out and counted, and answers are cached.
import { USER_AGENT } from './inputs.js';

export const jikanConfig = {
  baseUrl: null, // or set JIKAN_URL in the environment
  spacingMs: 450, // gap between calls (Jikan: 3 per second)
  perMinute: 50, // our own ceiling (Jikan: 60 per minute)
  maxWaitMs: 6000, // if the queue is longer than this, give up instead of making a visitor wait
  retryMs: 1200, // pause before the single retry after a 429
  cacheMs: 15 * 60 * 1000,
  timeoutMs: 10000
};
const baseUrl = () => jikanConfig.baseUrl || process.env.JIKAN_URL || 'https://api.jikan.moe/v4';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cache = new Map();
let nextSlot = 0;
let recent = [];
export function resetBackupState() {
  cache.clear();
  nextSlot = 0;
  recent = [];
}

const busy = () => Object.assign(new Error('The backup source is busy'), { status: 503 });

// Wait for our turn, or refuse if the queue is too long / the minute's budget is spent
async function takeSlot() {
  const now = Date.now();
  recent = recent.filter((t) => now - t < 60000);
  if (recent.length >= jikanConfig.perMinute) throw busy();
  const slot = Math.max(now, nextSlot);
  if (slot - now > jikanConfig.maxWaitMs) throw busy();
  nextSlot = slot + jikanConfig.spacingMs;
  recent.push(slot);
  if (slot > now) await sleep(slot - now);
}

async function jikanGet(path, params, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < jikanConfig.cacheMs) return cached.json;
  try {
    const qs = new URLSearchParams(params).toString();
    const url = `${baseUrl()}${path}${qs ? `?${qs}` : ''}`;
    let res;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await takeSlot();
      res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(jikanConfig.timeoutMs)
      });
      if (res.status !== 429) break;
      await sleep(jikanConfig.retryMs); // told to slow down: wait once, then try again
    }
    if (!res.ok) throw Object.assign(new Error(`Jikan request failed: ${res.status}`), { status: res.status });
    const json = await res.json();
    if (cache.size > 300) cache.delete(cache.keys().next().value); // keep memory bounded
    cache.set(cacheKey, { json, time: Date.now() });
    return json;
  } catch (err) {
    if (cached && err.status !== 404) return cached.json; // a slightly old answer beats an error page
    throw err;
  }
}

// ----- Reshaping Jikan's answers into the shape the pages already expect (the same one the AniList routes produce) -----

const ANIME_STATUS = { 'Finished Airing': 'FINISHED', 'Currently Airing': 'RELEASING', 'Not yet aired': 'NOT_YET_RELEASED' };
const MANGA_STATUS = { Finished: 'FINISHED', Publishing: 'RELEASING', 'On Hiatus': 'HIATUS', Discontinued: 'CANCELLED', 'Not yet published': 'NOT_YET_RELEASED' };
const MANGA_FORMAT = { Manga: 'MANGA', Manhwa: 'MANGA', Manhua: 'MANGA', Doujinshi: 'MANGA', 'One-shot': 'ONE_SHOT' };

const cover = (item) => item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null;
const score = (s) => (typeof s === 'number' && s > 0 ? s : null); // Jikan uses 0 or null for "no score yet"
const genreNames = (item) => (Array.isArray(item.genres) ? item.genres.map((g) => g?.name).filter(Boolean) : []);

export function animeShape(item) {
  if (!item || !Number.isInteger(item.mal_id)) return null;
  const trailer = item.trailer?.youtube_id;
  const studio = item.studios?.[0]?.name;
  return {
    color: null,
    mal_id: item.mal_id,
    title: item.title_english || item.title || 'Untitled',
    type: item.type ? String(item.type).toUpperCase().replace(/[\s-]+/g, '_') : 'TV',
    episodes: item.episodes ?? null,
    score: score(item.score),
    status: ANIME_STATUS[item.status] || null,
    year: item.year || item.aired?.prop?.from?.year || null,
    genres: genreNames(item),
    banner: null,
    synopsis: item.synopsis || '',
    ...(typeof trailer === 'string' && /^[\w-]{6,20}$/.test(trailer) ? { trailer } : {}),
    ...(studio ? { studio } : {}),
    images: { jpg: { image_url: cover(item) } }
  };
}

// Novels and light novels are left out, the same way the AniList routes leave them out
export function mangaShape(item) {
  if (!item || !Number.isInteger(item.mal_id)) return null;
  if (item.type === 'Novel' || item.type === 'Light Novel') return null;
  return {
    color: null,
    mal_id: item.mal_id,
    title: item.title_english || item.title || 'Untitled',
    type: MANGA_FORMAT[item.type] || 'MANGA',
    chapters: item.chapters ?? null,
    volumes: item.volumes ?? null,
    score: score(item.score),
    status: MANGA_STATUS[item.status] || null,
    year: item.published?.prop?.from?.year || null,
    genres: genreNames(item),
    banner: null,
    synopsis: item.synopsis || '',
    images: { jpg: { image_url: cover(item) } }
  };
}

// A page of results: reshaped, with repeats (Jikan's seasonal lists can repeat a title) and unusable rows removed
function pageResult(json, shape) {
  const seen = new Set();
  const data = [];
  for (const item of json?.data || []) {
    const out = shape(item);
    if (!out || seen.has(out.mal_id)) continue;
    seen.add(out.mal_id);
    data.push(out);
  }
  return { data, pagination: { has_next_page: Boolean(json?.pagination?.has_next_page) }, source: 'backup' };
}

function detailResult(json, shape) {
  const data = shape(json?.data);
  if (!data) throw Object.assign(new Error('Not found'), { status: 404 });
  return { data, source: 'backup' };
}

const PAGE = '20';
const SFW = 'true';

export const backupTopAnime = async (page) => pageResult(await jikanGet('/top/anime', { page, limit: PAGE, sfw: SFW }, `top:${page}`), animeShape);
export const backupSeasonNow = async () => pageResult(await jikanGet('/seasons/now', { limit: PAGE, sfw: SFW }, 'season:now'), animeShape);
export const backupSearchAnime = async (q, page) => pageResult(await jikanGet('/anime', { q, page, limit: PAGE, sfw: SFW }, `search:${q}:${page}`), animeShape);
export const backupAnime = async (id) => detailResult(await jikanGet(`/anime/${id}`, {}, `anime:${id}`), animeShape);

export const backupTopManga = async (page) => pageResult(await jikanGet('/top/manga', { page, limit: PAGE, sfw: SFW }, `mtop:${page}`), mangaShape);
export const backupTrendingManga = async () => pageResult(await jikanGet('/top/manga', { filter: 'publishing', limit: PAGE, sfw: SFW }, 'mtrending'), mangaShape);
export const backupSearchManga = async (q, page) => pageResult(await jikanGet('/manga', { q, page, limit: PAGE, sfw: SFW }, `msearch:${q}:${page}`), mangaShape);
export const backupManga = async (id) => detailResult(await jikanGet(`/manga/${id}`, {}, `manga:${id}`), mangaShape);

// Run a backup lookup. Resolves to its answer, to { notFound: true } when MyAnimeList has no such title, or to null
// when the backup is switched off or can't help either (the caller then shows the normal error).
export async function tryBackup(fn) {
  if (process.env.BACKUP_SOURCE === 'off') return null;
  try {
    return await fn();
  } catch (err) {
    if (err.status === 404) return { notFound: true };
    console.warn('Backup source (Jikan) failed:', err.message);
    return null;
  }
}
