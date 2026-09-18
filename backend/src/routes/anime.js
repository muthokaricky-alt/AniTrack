import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Simple in-memory cache to stay under Jikan's rate limit (3 req/sec, 60/min)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function jikanGet(path) {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }
  const response = await fetch(`${JIKAN_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Jikan request failed: ${response.status}`);
  }
  const data = await response.json();
  cache.set(path, { data, time: Date.now() });
  return data;
}

// GET /api/anime/search?q=naruto&page=1
router.get('/search', async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required' });
  try {
    const data = await jikanGet(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/top
router.get('/top', async (req, res) => {
  const { page = 1 } = req.query;
  try {
    const data = await jikanGet(`/top/anime?page=${page}&limit=20`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/season/now
router.get('/season/now', async (req, res) => {
  try {
    const data = await jikanGet('/seasons/now?limit=20');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

// GET /api/anime/:id
router.get('/:id', async (req, res) => {
  try {
    const data = await jikanGet(`/anime/${req.params.id}/full`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach anime data source', detail: err.message });
  }
});

export default router;
