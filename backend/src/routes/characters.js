import { Router } from 'express';
import { anilistQuery } from './anime.js';
import { cleanQuery, errDetail, CATALOG_DOWN } from '../inputs.js';

const router = Router();

const QUERY = `
  query ($search: String) {
    Page(perPage: 12) {
      characters(search: $search, sort: SEARCH_MATCH) {
        id
        name { full }
        image { large medium }
        media(perPage: 1, sort: POPULARITY_DESC) {
          nodes { title { romaji english } }
        }
      }
    }
  }
`;

// GET /api/characters/search?q=luffy  (ids are AniList character ids)
router.get('/search', async (req, res) => {
  const q = cleanQuery(req.query.q);
  if (!q) return res.status(400).json({ error: 'Provide q' });
  try {
    const data = await anilistQuery(QUERY, { search: q }, `char:${q.toLowerCase()}`);
    res.json({
      data: data.Page.characters.map((c) => {
        const series = c.media?.nodes?.[0]?.title;
        return {
          id: c.id,
          name: c.name?.full || 'Unknown',
          image_url: c.image?.large || c.image?.medium || null,
          series: series?.english || series?.romaji || null
        };
      })
    });
  } catch (err) {
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

export default router;
