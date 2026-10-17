import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const ANILIST_URL = 'https://graphql.anilist.co';

// Simple in-memory cache — AniList's rate limit is generous but this
// keeps repeat requests (e.g. revisiting the same anime) instant.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function anilistQuery(query, variables, cacheKey) {
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;
  }
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    throw new Error(`AniList request failed: ${response.status}`);
  }
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (cacheKey) {
    if (cache.size > 500) cache.delete(cache.keys().next().value); // keep memory bounded
    cache.set(cacheKey, { data: json.data, time: Date.now() });
  }
  return json.data;
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

// Reshape an AniList Media object into the shape the frontend already expects
function toJikanShape(media) {
  if (!media) return null;
  return {
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
  coverImage { extraLarge large medium }
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
  const q = String(req.query.q || '').trim();
  const genre = String(req.query.genre || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
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
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/top
router.get('/top', async (req, res) => {
  const { page = 1 } = req.query;
  try {
    const data = await anilistQuery(
      PAGE_QUERY,
      { page: Number(page), sort: ['SCORE_DESC'] },
      `top:${page}`
    );
    res.json({
      data: mapList(data.Page.media),
      pagination: { has_next_page: data.Page.pageInfo.hasNextPage }
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
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
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/schedule?from=<unix>&to=<unix>  -> episodes airing in the window (max 8 days)
router.get('/schedule', async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const from = req.query.from !== undefined ? Number(req.query.from) : now - 3600;
  let to = req.query.to !== undefined ? Number(req.query.to) : from + 7 * 86400;
  if (!Number.isInteger(from) || !Number.isInteger(to) || to <= from) {
    return res.status(400).json({ error: 'from and to must be unix timestamps with to > from' });
  }
  to = Math.min(to, from + 8 * 86400);

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
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/:id  (id = MyAnimeList id, kept for compatibility with stored list entries)
router.get('/:id', async (req, res) => {
  if (!Number.isInteger(Number(req.params.id))) return res.status(400).json({ error: 'Invalid anime id' });
  try {
    const data = await anilistQuery(DETAIL_QUERY, { idMal: Number(req.params.id) }, `detail:${req.params.id}`);
    if (!data.Media) return res.status(404).json({ error: 'Anime not found' });
    res.json({ data: toJikanShape(data.Media) });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

export default router;