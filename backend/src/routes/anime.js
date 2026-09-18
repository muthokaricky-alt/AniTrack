import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const ANILIST_URL = 'https://graphql.anilist.co';

// Simple in-memory cache — AniList's rate limit is generous but this
// keeps repeat requests (e.g. revisiting the same anime) instant.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function anilistQuery(query, variables, cacheKey) {
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
  if (cacheKey) cache.set(cacheKey, { data: json.data, time: Date.now() });
  return json.data;
}

function stripHtml(html) {
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
    synopsis: stripHtml(media.description),
    images: {
      jpg: {
        image_url: media.coverImage?.large || media.coverImage?.medium || null
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
  description(asHtml: false)
  coverImage { large medium }
`;

const PAGE_QUERY = `
  query ($search: String, $page: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: 20) {
      pageInfo { hasNextPage }
      media(search: $search, type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      ${MEDIA_FIELDS}
    }
  }
`;

function currentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { season: 'WINTER', seasonYear: year };
  if (month <= 6) return { season: 'SPRING', seasonYear: year };
  if (month <= 9) return { season: 'SUMMER', seasonYear: year };
  return { season: 'FALL', seasonYear: year };
}

// GET /api/anime/search?q=naruto&page=1
router.get('/search', async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required' });
  try {
    const data = await anilistQuery(
      PAGE_QUERY,
      { search: q, page: Number(page), sort: ['SEARCH_MATCH'] },
      `search:${q}:${page}`
    );
    res.json({
      data: data.Page.media.map(toJikanShape),
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
      data: data.Page.media.map(toJikanShape),
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
      data: data.Page.media.map(toJikanShape),
      pagination: { has_next_page: data.Page.pageInfo.hasNextPage }
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/:id  (id = MyAnimeList id, kept for compatibility with stored list entries)
router.get('/:id', async (req, res) => {
  try {
    const data = await anilistQuery(DETAIL_QUERY, { idMal: Number(req.params.id) }, `detail:${req.params.id}`);
    if (!data.Media) return res.status(404).json({ error: 'Anime not found' });
    res.json({ data: toJikanShape(data.Media) });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

export default router;