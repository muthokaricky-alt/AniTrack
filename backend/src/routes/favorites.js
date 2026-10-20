import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const KINDS = ['anime', 'manga', 'character'];
export const LISTS = { top3: 3, top15: 15 };

const empty = () => Object.fromEntries(KINDS.map((k) => [k, Object.fromEntries(Object.keys(LISTS).map((l) => [l, []]))]));

// Everything a user has picked, grouped as { anime: { top3: [...], top15: [...] }, manga: {...}, character: {...} }
export async function loadFavorites(userId) {
  const out = empty();
  const rows = await db.all('SELECT kind, list, item_id, title, image_url, sub FROM favorites WHERE user_id = ? ORDER BY kind, list, position', [userId]);
  for (const r of rows) out[r.kind]?.[r.list]?.push({ item_id: r.item_id, title: r.title, image_url: r.image_url, sub: r.sub });
  return out;
}

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => res.json(await loadFavorites(req.userId)));

// Replace one whole list in order. PUT /api/favorites/anime/top3  { items: [{ item_id, title, image_url, sub }] }
router.put('/:kind/:list', async (req, res) => {
  const { kind, list } = req.params;
  if (!KINDS.includes(kind) || !(list in LISTS)) return res.status(404).json({ error: 'Unknown favourites list' });
  const items = req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  if (items.length > LISTS[list]) return res.status(400).json({ error: `A ${list === 'top3' ? 'top 3' : 'top 15'} list can hold at most ${LISTS[list]} items` });

  const clean = [];
  const seen = new Set();
  for (const it of items) {
    const id = Number(it?.item_id);
    const title = typeof it?.title === 'string' ? it.title.trim().slice(0, 300) : '';
    if (!Number.isInteger(id) || id <= 0 || !title) return res.status(400).json({ error: 'Each item needs an item_id and a title' });
    if (seen.has(id)) continue; // ignore duplicates instead of failing the whole save
    seen.add(id);
    clean.push({
      id,
      title,
      image_url: typeof it.image_url === 'string' && /^https?:\/\//.test(it.image_url) ? it.image_url.slice(0, 500) : null,
      sub: typeof it.sub === 'string' ? it.sub.trim().slice(0, 200) || null : null
    });
  }

  await db.tx(async (t) => {
    await t.run('DELETE FROM favorites WHERE user_id = ? AND kind = ? AND list = ?', [req.userId, kind, list]);
    for (const [i, c] of clean.entries()) {
      await t.run(
        'INSERT INTO favorites (user_id, kind, list, position, item_id, title, image_url, sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.userId, kind, list, i, c.id, c.title, c.image_url, c.sub]
      );
    }
  });
  res.json({ items: (await loadFavorites(req.userId))[kind][list] });
});

export default router;
