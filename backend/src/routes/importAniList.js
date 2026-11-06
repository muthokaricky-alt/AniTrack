import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { USERNAME_RE } from '../anilistList.js';
import { loadAniList } from '../anilistImport.js';

const router = Router();
router.use(requireAuth);

// GET /api/import/anilist?username=name&kind=anime|manga
router.get('/anilist', async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim().replace(/^@/, '') : '';
  const kind = req.query.kind === 'anime' || req.query.kind === 'manga' ? req.query.kind : null;
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'AniList usernames are 2 to 20 letters, numbers or underscores.' });
  if (!kind) return res.status(400).json({ error: 'kind must be anime or manga' });

  try {
    const { rows, skipped } = await loadAniList(username, kind);
    res.json({ entries: rows, skipped_count: skipped.length, skipped: skipped.slice(0, 20) });
  } catch (err) {
    if (err.expose) return res.status(err.status).json({ error: err.message });
    console.warn('AniList import failed:', err.message);
    res.status(502).json({ error: 'AniList import failed. Try again in a moment.' });
  }
});

export default router;
