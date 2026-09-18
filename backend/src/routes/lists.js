import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'];

// GET /api/list  -> all entries for the logged-in user
router.get('/', (req, res) => {
  const entries = db
    .prepare('SELECT * FROM list_entries WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.userId);
  res.json(entries);
});

// GET /api/list/stats -> quick profile stats
router.get('/stats', (req, res) => {
  const rows = db.prepare('SELECT status, episodes_watched, score FROM list_entries WHERE user_id = ?').all(req.userId);
  const totalEntries = rows.length;
  const episodesWatched = rows.reduce((sum, r) => sum + (r.episodes_watched || 0), 0);
  const scored = rows.filter((r) => r.score != null);
  const meanScore = scored.length ? (scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(2) : null;
  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {});
  res.json({ totalEntries, episodesWatched, meanScore, byStatus });
});

// POST /api/list -> add or upsert an entry
router.post('/', (req, res) => {
  const { mal_id, title, image_url, status = 'plan_to_watch', total_episodes } = req.body;
  if (!mal_id || !title) return res.status(400).json({ error: 'mal_id and title are required' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });

  db.prepare(`
    INSERT INTO list_entries (user_id, mal_id, title, image_url, status, total_episodes)
    VALUES (@userId, @mal_id, @title, @image_url, @status, @total_episodes)
    ON CONFLICT(user_id, mal_id) DO UPDATE SET
      status = excluded.status,
      total_episodes = excluded.total_episodes,
      updated_at = CURRENT_TIMESTAMP
  `).run({ userId: req.userId, mal_id, title, image_url, status, total_episodes });

  const entry = db.prepare('SELECT * FROM list_entries WHERE user_id = ? AND mal_id = ?').get(req.userId, mal_id);
  res.status(201).json(entry);
});

// PATCH /api/list/:id -> update status, score, progress, review
router.patch('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM list_entries WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { status, score, episodes_watched, review } = req.body;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }

  db.prepare(`
    UPDATE list_entries SET
      status = COALESCE(@status, status),
      score = COALESCE(@score, score),
      episodes_watched = COALESCE(@episodes_watched, episodes_watched),
      review = COALESCE(@review, review),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND user_id = @userId
  `).run({ id: req.params.id, userId: req.userId, status, score, episodes_watched, review });

  const updated = db.prepare('SELECT * FROM list_entries WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/list/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM list_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(204).send();
});

export default router;
