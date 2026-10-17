import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

// One router factory serves both lists. Table and column names come from these constants, never from user input.
const KINDS = {
  anime: {
    table: 'list_entries',
    statuses: ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'],
    defaultStatus: 'plan_to_watch',
    progress: 'episodes_watched',
    total: 'total_episodes'
  },
  manga: {
    table: 'manga_entries',
    statuses: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read'],
    defaultStatus: 'plan_to_read',
    progress: 'chapters_read',
    total: 'total_chapters'
  }
};

// Parse an optional integer field. Returns undefined when absent, null when cleared, NaN when invalid.
function intField(value, { min, max }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
}

function packGenres(value) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((g) => typeof g === 'string').map((g) => g.slice(0, 40)).slice(0, 12);
  return list.length ? JSON.stringify(list) : null;
}

function unpack(row) {
  if (!row) return row;
  let genres = [];
  try {
    genres = row.genres ? JSON.parse(row.genres) : [];
  } catch {
    /* bad data: treat as no genres */
  }
  return { ...row, genres };
}

function makeRouter(cfg) {
  const { table: t, statuses, defaultStatus, progress, total } = cfg;
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY updated_at DESC, id DESC`).all(req.userId);
    res.json(rows.map(unpack));
  });

  router.get('/stats', (req, res) => {
    const rows = db.prepare(`SELECT status, ${progress} AS progress, score FROM ${t} WHERE user_id = ?`).all(req.userId);
    const scored = rows.filter((r) => r.score != null);
    res.json({
      totalEntries: rows.length,
      progress: rows.reduce((sum, r) => sum + (r.progress || 0), 0),
      meanScore: scored.length ? (scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(2) : null,
      byStatus: statuses.reduce((acc, s) => ({ ...acc, [s]: rows.filter((r) => r.status === s).length }), {})
    });
  });

  // Add an entry, or change the status of an existing one.
  // keep_existing: true adds only when missing (quick-add), so a completed title is never reset.
  router.post('/', (req, res) => {
    const { mal_id, title, image_url = null, status = defaultStatus, keep_existing = false } = req.body;
    if (!Number.isInteger(Number(mal_id)) || !title) return res.status(400).json({ error: 'mal_id and title are required' });
    if (!statuses.includes(status)) return res.status(400).json({ error: `status must be one of ${statuses.join(', ')}` });

    const totalVal = intField(req.body[total], { min: 0, max: 100000 });
    const malId = Number(mal_id);
    const genres = packGenres(req.body.genres);
    const existing = db.prepare(`SELECT * FROM ${t} WHERE user_id = ? AND mal_id = ?`).get(req.userId, malId);

    if (existing && keep_existing) return res.status(200).json(unpack(existing));

    const totalClean = Number.isNaN(totalVal) ? null : totalVal ?? null;
    if (existing) {
      const done = status === 'completed' && totalClean ? totalClean : existing[progress];
      db.prepare(`
        UPDATE ${t} SET status = @status, ${total} = COALESCE(@total, ${total}), ${progress} = @done,
          genres = COALESCE(@genres, genres), updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ status, total: totalClean, done, genres, id: existing.id });
    } else {
      db.prepare(`
        INSERT INTO ${t} (user_id, mal_id, title, image_url, status, ${total}, ${progress}, genres)
        VALUES (@userId, @malId, @title, @image_url, @status, @total, @done, @genres)
      `).run({
        userId: req.userId, malId, title: String(title).slice(0, 300), image_url, status,
        total: totalClean, done: status === 'completed' && totalClean ? totalClean : 0, genres
      });
    }
    const entry = db.prepare(`SELECT * FROM ${t} WHERE user_id = ? AND mal_id = ?`).get(req.userId, malId);
    res.status(existing ? 200 : 201).json(unpack(entry));
  });

  // Bulk upsert from an AniTrack export (overwrites entries with the same mal_id)
  router.post('/import', (req, res) => {
    const list = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!list) return res.status(400).json({ error: 'entries must be an array' });
    if (list.length > 3000) return res.status(400).json({ error: 'Too many entries (max 3000)' });

    const rows = [];
    for (const e of list) {
      const malId = Number(e?.mal_id);
      const title = typeof e?.title === 'string' ? e.title.trim().slice(0, 300) : '';
      if (!Number.isInteger(malId) || malId <= 0 || !title) continue;
      const tot = Number.isInteger(e[total]) && e[total] >= 0 ? e[total] : null;
      let done = Number.isInteger(e[progress]) && e[progress] >= 0 ? e[progress] : 0;
      if (tot) done = Math.min(done, tot);
      rows.push({
        malId, title,
        image_url: typeof e.image_url === 'string' && /^https?:\/\//.test(e.image_url) ? e.image_url.slice(0, 500) : null,
        status: statuses.includes(e.status) ? e.status : defaultStatus,
        score: Number.isInteger(e.score) && e.score >= 0 && e.score <= 10 ? e.score : null,
        done, total: tot,
        review: typeof e.review === 'string' ? e.review.slice(0, 5000) || null : null,
        genres: packGenres(e.genres)
      });
    }

    const stmt = db.prepare(`
      INSERT INTO ${t} (user_id, mal_id, title, image_url, status, score, ${progress}, ${total}, review, genres)
      VALUES (@userId, @malId, @title, @image_url, @status, @score, @done, @total, @review, @genres)
      ON CONFLICT(user_id, mal_id) DO UPDATE SET
        title = excluded.title, image_url = excluded.image_url, status = excluded.status, score = excluded.score,
        ${progress} = excluded.${progress}, ${total} = excluded.${total}, review = excluded.review,
        genres = COALESCE(excluded.genres, ${t}.genres), updated_at = CURRENT_TIMESTAMP
    `);
    db.transaction((batch) => {
      for (const r of batch) stmt.run({ ...r, userId: req.userId });
    })(rows);
    res.json({ imported: rows.length, skipped: list.length - rows.length });
  });

  // Update status, score, progress, notes (score/notes can be cleared with null)
  router.patch('/:id', (req, res) => {
    const entry = db.prepare(`SELECT * FROM ${t} WHERE id = ? AND user_id = ?`).get(req.params.id, req.userId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const body = req.body || {};
    if (body.status !== undefined && !statuses.includes(body.status)) {
      return res.status(400).json({ error: `status must be one of ${statuses.join(', ')}` });
    }
    const score = intField(body.score, { min: 0, max: 10 });
    if (Number.isNaN(score)) return res.status(400).json({ error: 'score must be a whole number from 0 to 10' });
    const done = intField(body[progress], { min: 0, max: entry[total] || 100000 });
    if (Number.isNaN(done)) return res.status(400).json({ error: `${progress} must be between 0 and ${entry[total] ?? 'the total'}` });
    if (done === null) return res.status(400).json({ error: `${progress} cannot be empty` });

    db.prepare(`
      UPDATE ${t} SET status = @status, score = @score, ${progress} = @done, review = @review, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND user_id = @userId
    `).run({
      status: body.status ?? entry.status,
      score: score === undefined ? entry.score : score,
      done: done === undefined ? entry[progress] : done,
      review: body.review === undefined ? entry.review : String(body.review).slice(0, 5000) || null,
      id: entry.id,
      userId: req.userId
    });
    res.json(unpack(db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(entry.id)));
  });

  router.delete('/:id', (req, res) => {
    const result = db.prepare(`DELETE FROM ${t} WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).send();
  });

  return router;
}

export const mangaListRoutes = makeRouter(KINDS.manga);
export default makeRouter(KINDS.anime);
