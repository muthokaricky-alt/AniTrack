import { Router } from 'express';
import { anilistQuery, stripHtml, GENRES, safeColor } from './anime.js';

const router = Router();

// Same output shape as the anime routes (mal_id, title, images.jpg.image_url, score...), with chapters/volumes instead of episodes
function toMangaShape(media) {
  if (!media) return null;
  return {
    color: safeColor(media.coverImage?.color),
    mal_id: media.idMal,
    title: media.title?.english || media.title?.romaji || 'Untitled',
    type: media.format || 'MANGA',
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
    score: media.averageScore != null ? Math.round(media.averageScore) / 10 : null,
    status: media.status,
    year: media.startDate?.year || null,
    genres: media.genres || [],
    banner: media.bannerImage || null,
    synopsis: stripHtml(media.description),
    ...(media.recommendations
      ? {
          recommendations: (media.recommendations.nodes || [])
            .map((n) => n.mediaRecommendation)
            .filter((m) => m && m.idMal)
            .map(toMangaShape)
        }
      : {}),
    images: { jpg: { image_url: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null } }
  };
}

const FIELDS = `
  idMal
  title { romaji english }
  format
  chapters
  volumes
  averageScore
  status
  startDate { year }
  genres
  bannerImage
  description(asHtml: false)
  coverImage { extraLarge large medium color }
`;

const PAGE_QUERY = `
  query ($search: String, $genre: String, $page: Int, $sort: [MediaSort], $status: MediaStatus) {
    Page(page: $page, perPage: 20) {
      pageInfo { hasNextPage }
      media(search: $search, genre: $genre, type: MANGA, format_not: NOVEL, status: $status, sort: $sort, isAdult: false) {
        ${FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: MANGA) {
      ${FIELDS}
      recommendations(perPage: 8, sort: RATING_DESC) {
        nodes {
          mediaRecommendation {
            idMal
            title { romaji english }
            format
            chapters
            averageScore
            coverImage { extraLarge large medium }
          }
        }
      }
    }
  }
`;

const mapList = (media) => media.filter((m) => m.idMal).map(toMangaShape);
const fail = (res, err) => res.status(502).json({ error: 'Failed to reach manga data source', detail: err.message });

async function pageOf(variables, key, res) {
  try {
    const data = await anilistQuery(PAGE_QUERY, variables, key);
    res.json({ data: mapList(data.Page.media), pagination: { has_next_page: data.Page.pageInfo.hasNextPage } });
  } catch (err) {
    fail(res, err);
  }
}

// GET /api/manga/search?q=berserk&genre=Action&page=1
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const genre = String(req.query.genre || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!q && !genre) return res.status(400).json({ error: 'Provide q or genre' });
  if (genre && !GENRES.includes(genre)) return res.status(400).json({ error: 'Unknown genre' });
  const variables = { page, sort: [q ? 'SEARCH_MATCH' : 'POPULARITY_DESC'] };
  if (q) variables.search = q;
  if (genre) variables.genre = genre;
  return pageOf(variables, `manga:search:${q}:${genre}:${page}`, res);
});

// GET /api/manga/top
router.get('/top', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  return pageOf({ page, sort: ['SCORE_DESC'] }, `manga:top:${page}`, res);
});

// GET /api/manga/trending  (what people are reading right now)
router.get('/trending', (req, res) =>
  pageOf({ page: 1, sort: ['TRENDING_DESC'], status: 'RELEASING' }, 'manga:trending', res)
);

// GET /api/manga/:id  (MyAnimeList id)
router.get('/:id', async (req, res) => {
  if (!Number.isInteger(Number(req.params.id))) return res.status(400).json({ error: 'Invalid manga id' });
  try {
    const data = await anilistQuery(DETAIL_QUERY, { idMal: Number(req.params.id) }, `manga:detail:${req.params.id}`);
    if (!data.Media) return res.status(404).json({ error: 'Manga not found' });
    res.json({ data: toMangaShape(data.Media) });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
