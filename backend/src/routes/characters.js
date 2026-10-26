import { Router } from 'express';
import { anilistQuery } from './anime.js';
import { cleanQuery, isId, errDetail, CATALOG_DOWN } from '../inputs.js';
import { characterShape } from '../character.js';

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

const DETAIL_QUERY = `
  query ($id: Int) {
    Character(id: $id) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      gender
      age
      dateOfBirth { month day }
      bloodType
      favourites
      media(perPage: 8, sort: POPULARITY_DESC) {
        nodes { idMal type format title { romaji english } coverImage { large medium } }
      }
    }
  }
`;

// GET /api/characters/:id  (an AniList character id) -> everything the character dialog shows, spoilers removed
router.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid character id' });
  const id = Number(req.params.id);
  try {
    const data = await anilistQuery(DETAIL_QUERY, { id }, `char:detail:${id}`);
    const character = characterShape(data.Character);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    res.json({ data: character });
  } catch (err) {
    res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
});

export default router;
