import { Router } from 'express';
import fetch from 'node-fetch';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { cleanQuery, clampPage, isId, bucketWindow, errDetail, CATALOG_DOWN, USER_AGENT } from '../inputs.js';
import { makeBreaker } from '../breaker.js';
import { tryBackup, backupTopAnime, backupSeasonNow, backupSearchAnime, backupAnime } from '../jikan.js';

const router = Router();
const ANILIST_URL = process.env.ANILIST_URL || 'https://graphql.anilist.co';

// Simple in-memory cache — AniList's rate limit is generous but this
// keeps repeat requests (e.g. revisiting the same anime) instant.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// AniList can switch its API off for hours. After 3 failures in a row we stop asking for 30 seconds, so pages fall back to
// the backup source immediately and AniList isn't hammered while it recovers. (Requests identify themselves with USER_AGENT.)
const breaker = makeBreaker({ threshold: 3, pauseMs: 30000 });

// retries: how many times to wait and try again when AniList says "slow down" (429) or has a hiccup (5xx)
export async function anilistQuery(query, variables, cacheKey, { tolerateErrors = false, retries = 2 } = {}) {
  const cached = cacheKey ? cache.get(cacheKey) : null;
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;
  if (breaker.isOpen()) {
    if (cached) return cached.data;
    throw Object.assign(new Error('AniList is paused after repeated failures'), { paused: true });
  }

  try {
    let response;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await fetch(ANILIST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(12000)
        });
      } catch (netErr) {
        if (attempt >= retries) throw Object.assign(netErr, { outage: true }); // timeout or dropped connection: try again, shared hosts hiccup
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (response.ok || attempt >= retries || !(response.status === 429 || response.status >= 500)) break;
      const wait = Number(response.headers.get('retry-after'));
      await sleep(Math.min(Number.isFinite(wait) && wait > 0 ? wait * 1000 : 2000 * (attempt + 1), 8000));
    }
    if (!response.ok) {
      // Keep the start of AniList's reply for the server log: a Cloudflare block page and an AniList error look different.
      let body = '';
      try { body = (await response.text()).replace(/\s+/g, ' ').slice(0, 200); } catch { /* ignore */ }
      const err = new Error(`AniList request failed: ${response.status}`);
      err.body = body;
      err.outage = response.status === 403 || response.status === 429 || response.status >= 500;
      throw err;
    }
    const json = await response.json();
    if (json.errors && !(tolerateErrors && json.data)) throw new Error(json.errors.map((e) => e.message).join('; '));
    breaker.success();
    if (cacheKey) {
      if (cache.size > 500) cache.delete(cache.keys().next().value); // keep memory bounded
      cache.set(cacheKey, { data: json.data, time: Date.now() });
    }
    return json.data;
  } catch (err) {
    // Visitors only see "failed to reach the data source". The real reason (429, 403, timeout, ...) goes to the server log.
    if (err.outage) breaker.failure();
    console.warn('AniList lookup failed:', err.message, err.body ? `| AniList said: ${err.body}` : '');
    if (cached) return cached.data; // better a slightly old answer than an error page
    throw err;
  }
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

// AniList gives each cover a dominant colour like "#e4a15d". Only a strict 6-digit hex is passed on, since it ends up in CSS.
export const safeColor = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null);

// Reshape an AniList Media object into the shape the frontend already expects
export function toJikanShape(media) {
  if (!media) return null;
  return {
    color: safeColor(media.coverImage?.color),
    mal_id: media.idMal,
    title: media.title?.english || media.title?.romaji || 'Untitled',
    type: media.format || 'TV',
    episodes: media.episodes,
    score: media.averageScore != null ? Math.round(media.averageScore) / 10 : null,
    status: media.status,
    year: media.seasonYear || null,
    genres: media.genres || [],
    banner: media.bannerImage || null,
    synopsis: stripHtml(media.description),
    ...(media.popularity != null ? { popularity: media.popularity } : {}),
    ...(media.nextAiringEpisode !== undefined
      ? {
          next_airing: media.nextAiringEpisode
            ? { episode: media.nextAiringEpisode.episode, airing_at: media.nextAiringEpisode.airingAt }
            : null
        }
      : {}),
    ...(media.trailer?.site === 'youtube' && /^[\w-]{6,20}$/.test(media.trailer.id || '') ? { trailer: media.trailer.id } : {}),
    ...(media.studios?.nodes?.[0]?.name ? { studio: media.studios.nodes[0].name } : {}),
    ...(media.relations
      ? {
          relations: (media.relations.edges || [])
            .filter((e) => e.node?.idMal && e.node.type === 'ANIME' && ['SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE'].includes(e.relationType))
            .slice(0, 8)
            .map((e) => ({ relation: e.relationType.replace('_', ' ').toLowerCase(), ...toJikanShape(e.node) }))
        }
      : {}),
    ...(media.recommendations
      ? {
          recommendations: (media.recommendations.nodes || [])
            .map((n) => n.mediaRecommendation)
            .filter((m) => m && m.idMal)
            .map(toJikanShape)
        }
      : {}),
    images: {
      jpg: {
        image_url: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null
      }
    }
  };
}

const MEDIA_FIELDS = `
  idMal
  title { romaji english }
  format
  episodes
  averageScore
  status
  seasonYear
  genres
  bannerImage
  description(asHtml: false)
  coverImage { extraLarge large medium color }
`;

const PAGE_QUERY = `
  query ($search: String, $genre: String, $page: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: 20) {
      pageInfo { hasNextPage }
      media(search: $search, genre: $genre, type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      ${MEDIA_FIELDS}
      nextAiringEpisode { airingAt episode }
      trailer { id site }
      studios(isMain: true) { nodes { name } }
      relations {
        edges {
          relationType
          node { idMal type format title { romaji english } episodes averageScore seasonYear coverImage { extraLarge large medium color } }
        }
      }
      recommendations(perPage: 8, sort: RATING_DESC) {
        nodes {
          mediaRecommendation {
            idMal
            title { romaji english }
            format
            episodes
            averageScore
            coverImage { extraLarge large medium }
          }
        }
      }
    }
  }
`;

const SCHEDULE_QUERY = `
  query ($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        airingAt
        episode
        media {
          idMal
          title { romaji english }
          format
          episodes
          averageScore
          popularity
          isAdult
          coverImage { large medium }
        }
      }
    }
  }
`;

export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

// AniList entries without a MyAnimeList id can't be linked or saved, so skip them
const mapList = (media) => media.filter((m) => m.idMal).map(toJikanShape);

function currentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { season: 'WINTER', seasonYear: year };
  if (month <= 6) return { season: 'SPRING', seasonYear: year };
  if (month <= 9) return { season: 'SUMMER', seasonYear: year };
  return { season: 'FALL', seasonYear: year };
}

// GET /api/anime/search?q=naruto&genre=Action&page=1   (q and/or genre)
router.get('/search', async (req, res) => {
  const q = cleanQuery(req.query.q);
  const genre = cleanQuery(req.query.genre, 40);
  const page = clampPage(req.query.page);
  if (!q && !genre) return res.status(400).json({ error: 'Provide q or genre' });
  if (genre && !GENRES.includes(genre)) return res.status(400).json({ error: 'Unknown genre' });

  const variables = { page, sort: [q ? 'SEARCH_MATCH' : 'POPULARITY_DESC'] };
  if (q) variables.search = q;
  if (genre) variables.genre = genre;

  try {
    const data = await anilistQuery(PAGE_QUERY, variables, `search:${q}:${genre}:${page}`);
    res.json({
      data: mapList(data.Page.media),
      pagination: { has_next_page: data.Page.pageInfo.hasNextPage }
    });
  } catch (err) {
    const backup = genre ? null : await tryBackup(() => backupSearchAnime(q, page)); // genre-only searches have no backup
    if (backup) return res.json(backup);
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// GET /api/anime/top
router.get('/top', async (req, res) => {
  const page = clampPage(req.query.page);
  try {
    const data = await anilistQuery(
      PAGE_QUERY,
      { page, sort: ['SCORE_DESC'] },
      `top:${page}`
    );
    res.json({
      data: mapList(data.Page.media),
      pagination: { has_next_page: data.Page.pageInfo.hasNextPage }
    });
  } catch (err) {
    const backup = await tryBackup(() => backupTopAnime(page));
    if (backup) return res.json(backup);
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// GET /api/anime/season/now
router.get('/season/now', async (req, res) => {
  const { season, seasonYear } = currentSeason();
  try {
    const data = await anilistQuery(
      PAGE_QUERY,
      { page: 1, sort: ['POPULARITY_DESC'], season, seasonYear },
      `season:${season}:${seasonYear}`
    );
    res.json({
      data: mapList(data.Page.media),
      pagination: { has_next_page: data.Page.pageInfo.hasNextPage }
    });
  } catch (err) {
    const backup = await tryBackup(() => backupSeasonNow());
    if (backup) return res.json(backup);
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// GET /api/anime/schedule?from=<unix>&to=<unix>  -> episodes airing in the window (max 8 days)
router.get('/schedule', async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const fromRaw = req.query.from !== undefined ? Number(req.query.from) : now - 3600;
  const toRaw = req.query.to !== undefined ? Number(req.query.to) : fromRaw + 7 * 86400;
  if (!Number.isInteger(fromRaw) || !Number.isInteger(toRaw) || toRaw <= fromRaw) {
    return res.status(400).json({ error: 'from and to must be unix timestamps with to > from' });
  }
  if (Math.abs(fromRaw - now) > 90 * 86400) return res.status(400).json({ error: 'That date range is too far from today' });
  // whole 5-minute steps, so near-identical requests share one cached answer instead of each asking AniList again
  const [from, to] = bucketWindow(fromRaw, Math.min(toRaw, fromRaw + 8 * 86400));

  try {
    const rows = [];
    for (let page = 1; page <= 10; page++) {
      const data = await anilistQuery(SCHEDULE_QUERY, { from, to, page }, `schedule:${from}:${to}:${page}`);
      rows.push(...data.Page.airingSchedules);
      if (!data.Page.pageInfo.hasNextPage) break;
    }
    const data = rows
      .filter((r) => r.media && r.media.idMal && !r.media.isAdult)
      .map((r) => ({ airing_at: r.airingAt, episode: r.episode, anime: toJikanShape(r.media) }));
    res.json({ data });
  } catch (err) {
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// ----- Routes that need the logged-in user (must sit above /:id) -----

const REC_CARD = `
  idMal title { romaji english } format episodes averageScore seasonYear status genres
  coverImage { extraLarge large medium color }
`;

// GET /api/anime/airing -> your Watching and Plan-to-watch titles that are still airing, soonest episode first
router.get('/airing', requireAuth, async (req, res) => {
  const rows = await db.all("SELECT mal_id, status, episodes_watched FROM list_entries WHERE user_id = ? AND status IN ('watching', 'plan_to_watch') ORDER BY updated_at DESC LIMIT 60", [req.userId]);
  if (!rows.length) return res.json({ data: [] });
  const mine = new Map(rows.map((r) => [r.mal_id, r]));
  const ids = [...mine.keys()].sort((a, b) => a - b);
  try {
    const data = await anilistQuery(
      `query ($ids: [Int]) {
        Page(perPage: 60) {
          media(idMal_in: $ids, type: ANIME, status: RELEASING) {
            idMal title { romaji english } episodes
            nextAiringEpisode { airingAt episode }
            coverImage { large medium color }
          }
        }
      }`,
      { ids },
      `airing:${ids.join(',')}`,
      { retries: 1 }
    );
    const out = (data.Page.media || [])
      .filter((m) => m.idMal && m.nextAiringEpisode)
      .map((m) => {
        const mineRow = mine.get(m.idMal);
        const aired = m.nextAiringEpisode.episode - 1; // episodes already out
        return {
          mal_id: m.idMal,
          title: m.title?.english || m.title?.romaji || 'Untitled',
          image_url: m.coverImage?.large || m.coverImage?.medium || null,
          color: safeColor(m.coverImage?.color),
          next_episode: m.nextAiringEpisode.episode,
          airing_at: m.nextAiringEpisode.airingAt,
          total: m.episodes ?? null,
          status: mineRow?.status,
          watched: mineRow?.episodes_watched || 0,
          behind: Math.max(0, aired - (mineRow?.episodes_watched || 0))
        };
      })
      .sort((a, b) => a.airing_at - b.airing_at);
    res.json({ data: out });
  } catch (err) {
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// GET /api/anime/for-you -> "Because you loved X": AniList's recommendations for a few of your top-scored titles,
// minus anything already on your list. The seeds rotate daily so the row isn't the same every visit.
router.get('/for-you', requireAuth, async (req, res) => {
  const top = await db.all('SELECT mal_id, title, score FROM list_entries WHERE user_id = ? AND score IS NOT NULL ORDER BY score DESC, updated_at DESC LIMIT 40', [req.userId]);
  if (!top.length) return res.json({ rows: [] });
  const loved = top.filter((t) => t.score >= 9);
  const pool = (loved.length >= 3 ? loved : top.slice(0, 8)).slice(0, 14);
  const day = Math.floor(Date.now() / 86400000);
  const seeds = Array.from({ length: Math.min(4, pool.length) }, (_, i) => pool[(day + i * 3) % pool.length]);
  const uniqueSeeds = [...new Map(seeds.map((s) => [s.mal_id, s])).values()];
  const owned = new Set((await db.all('SELECT mal_id FROM list_entries WHERE user_id = ?', [req.userId])).map((r) => r.mal_id));

  const vars = {};
  const defs = uniqueSeeds.map((s, n) => { vars[`i${n}`] = s.mal_id; return `$i${n}: Int`; }).join(', ');
  const body = uniqueSeeds.map((_, n) => `
    r${n}: Media(idMal: $i${n}, type: ANIME) {
      recommendations(perPage: 16, sort: RATING_DESC) { nodes { mediaRecommendation { ${REC_CARD} } } }
    }`).join('\n');
  try {
    const data = await anilistQuery(`query (${defs}) { ${body} }`, vars, `foryou:${uniqueSeeds.map((s) => s.mal_id).join(',')}`, { tolerateErrors: true, retries: 1 });
    const seen = new Set();
    const rows = [];
    uniqueSeeds.forEach((seed, n) => {
      const items = [];
      for (const node of data?.[`r${n}`]?.recommendations?.nodes || []) {
        const m = node.mediaRecommendation;
        if (!m?.idMal || owned.has(m.idMal) || seen.has(m.idMal)) continue;
        seen.add(m.idMal);
        items.push(toJikanShape(m));
        if (items.length >= 8) break;
      }
      if (items.length >= 3) rows.push({ seed: { mal_id: seed.mal_id, title: seed.title }, data: items });
    });
    res.json({ rows });
  } catch (err) {
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

// GET /api/anime/:id  (id = MyAnimeList id, kept for compatibility with stored list entries)
router.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid anime id' });
  const id = Number(req.params.id);
  try {
    const data = await anilistQuery(DETAIL_QUERY, { idMal: id }, `detail:${id}`);
    if (!data.Media) return res.status(404).json({ error: 'Anime not found' });
    res.json({ data: toJikanShape(data.Media) });
  } catch (err) {
    const backup = await tryBackup(() => backupAnime(id));
    if (backup?.notFound) return res.status(404).json({ error: 'Anime not found' });
    if (backup) return res.json(backup);
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

export default router;