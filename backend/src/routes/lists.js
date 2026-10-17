import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'];

// Parse an optional integer field. Returns undefined when absent, null when cleared, NaN when invalid.
function intField(value, { min, max }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
}

// GET /api/list  -> all entries for the logged-in user
router.get('/', (req, res) => {
  const entries = db
    .prepare('SELECT * FROM list_entries WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
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

// POST /api/list -> add an entry, or change the status of an existing one.
// Pass keep_existing: true to add only when the title isn't in the list yet (used by quick-add),
// so a completed show is never silently reset to "plan to watch".
router.post('/', (req, res) => {
  const { mal_id, title, image_url = null, status = 'plan_to_watch', total_episodes = null, keep_existing = false } = req.body;
  if (!Number.isInteger(Number(mal_id)) || !title) {
    return res.status(400).json({ error: 'mal_id and title are required' });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }

  const params = { userId: req.userId, mal_id: Number(mal_id), title, image_url, status, total_episodes };
  const existing = db.prepare('SELECT * FROM list_entries WHERE user_id = ? AND mal_id = ?').get(req.userId, params.mal_id);

  if (existing && keep_existing) return res.status(200).json(existing);

  if (existing) {
    // Finishing a show fills the progress counter; otherwise leave progress alone
    const watched = status === 'completed' && total_episodes ? total_episodes : existing.episodes_watched;
    db.prepare(`
      UPDATE list_entries SET status = @status, total_episodes = COALESCE(@total_episodes, total_episodes),
        episodes_watched = @watched, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ status, total_episodes, watched, id: existing.id });
  } else {
    db.prepare(`
      INSERT INTO list_entries (user_id, mal_id, title, image_url, status, total_episodes, episodes_watched)
      VALUES (@userId, @mal_id, @title, @image_url, @status, @total_episodes, @watched)
    `).run({ ...params, watched: status === 'completed' && total_episodes ? total_episodes : 0 });
  }

  const entry = db.prepare('SELECT * FROM list_entries WHERE user_id = ? AND mal_id = ?').get(req.userId, params.mal_id);
  res.status(existing ? 200 : 201).json(entry);
});

// PATCH /api/list/:id -> update status, score, progress, review (score/review can be cleared with null)
router.patch('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM list_entries WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const body = req.body || {};
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }
  const score = intField(body.score, { min: 0, max: 10 });
  if (Number.isNaN(score)) return res.status(400).json({ error: 'score must be a whole number from 0 to 10' });
  const maxEp = entry.total_episodes || 100000;
  const watched = intField(body.episodes_watched, { min: 0, max: maxEp });
  if (Number.isNaN(watched)) return res.status(400).json({ error: `episodes_watched must be between 0 and ${entry.total_episodes ?? 'the episode count'}` });
  if (watched === null) return res.status(400).json({ error: 'episodes_watched cannot be empty' });

  const next = {
    status: body.status ?? entry.status,
    score: score === undefined ? entry.score : score,
    episodes_watched: watched === undefined ? entry.episodes_watched : watched,
    review: body.review === undefined ? entry.review : (String(body.review).slice(0, 5000) || null)
  };

  db.prepare(`
    UPDATE list_entries SET status = @status, score = @score, episodes_watched = @episodes_watched,
      review = @review, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND user_id = @userId
  `).run({ ...next, id: entry.id, userId: req.userId });

  res.json(db.prepare('SELECT * FROM list_entries WHERE id = ?').get(entry.id));
});

// DELETE /api/list/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM list_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(204).send();
});

export default router;
