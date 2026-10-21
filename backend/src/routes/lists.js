import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { anilistQuery } from './anime.js';
import { cleanImageUrl } from '../imageUrl.js';
import { errDetail } from '../inputs.js';

// One router factory serves both lists. Table and column names come from these constants, never from user input.
const KINDS = {
  anime: {
    kind: 'anime',
    table: 'list_entries',
    statuses: ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'],
    defaultStatus: 'plan_to_watch',
    anilistType: 'ANIME',
    totalField: 'episodes',
    progress: 'episodes_watched',
    total: 'total_episodes',
    ratingKeys: ['story', 'characters', 'visuals', 'music', 'enjoyment']
  },
  manga: {
    kind: 'manga',
    table: 'manga_entries',
    statuses: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read'],
    defaultStatus: 'plan_to_read',
    anilistType: 'MANGA',
    totalField: 'chapters',
    progress: 'chapters_read',
    total: 'total_chapters',
    ratingKeys: ['story', 'characters', 'art', 'pacing', 'enjoyment']
  }
};

const MAX_RESOLVE = 25;
const BATCH = 8; // titles per AniList request

// Parse an optional integer field. Returns undefined when absent, null when cleared, NaN when invalid.
function intField(value, { min, max }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
}

// Scores go from 0.5 to 10 in steps of 0.5. Same return convention as intField.
function halfField(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.5 || n > 10 || Math.round(n * 2) !== n * 2) return NaN;
  return n;
}

// Optional category ratings, e.g. { story: 8.5, music: 9 }. Returns a JSON string, null (none), or false (invalid).
function packRatings(value, allowedKeys) {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (!allowedKeys.includes(key)) return false;
    if (v === null || v === undefined || v === '') continue;
    const n = halfField(v);
    if (Number.isNaN(n)) return false;
    out[key] = n;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

function packGenres(value) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((g) => typeof g === 'string').map((g) => g.slice(0, 40)).slice(0, 12);
  return list.length ? JSON.stringify(list) : null;
}

// Up to 8 short tags per title, lower-case duplicates dropped
function packTags(value) {
  if (!Array.isArray(value)) return false;
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out.length ? JSON.stringify(out) : null;
}

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function unpack(row) {
  if (!row) return row;
  return { ...row, genres: parseJson(row.genres, []), ratings: parseJson(row.ratings, {}), tags: parseJson(row.tags, []) };
}

function makeRouter(cfg) {
  const { table: t, statuses, defaultStatus, progress, total, ratingKeys, anilistType, totalField } = cfg;
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const rows = await db.all(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY updated_at DESC, id DESC`, [req.userId]);
    res.json(rows.map(unpack));
  });

  router.get('/stats', async (req, res) => {
    const rows = await db.all(`SELECT status, ${progress} AS progress, score FROM ${t} WHERE user_id = ?`, [req.userId]);
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
  router.post('/', async (req, res) => {
    const { mal_id, title, image_url = null, status = defaultStatus, keep_existing = false } = req.body;
    if (!Number.isInteger(Number(mal_id)) || !title) return res.status(400).json({ error: 'mal_id and title are required' });
    if (!statuses.includes(status)) return res.status(400).json({ error: `status must be one of ${statuses.join(', ')}` });

    const totalVal = intField(req.body[total], { min: 0, max: 100000 });
    const malId = Number(mal_id);
    const cover = cleanImageUrl(image_url);
    const genres = packGenres(req.body.genres);
    const existing = await db.get(`SELECT * FROM ${t} WHERE user_id = ? AND mal_id = ?`, [req.userId, malId]);

    if (existing && keep_existing) return res.status(200).json(unpack(existing));

    const totalClean = Number.isNaN(totalVal) ? null : totalVal ?? null;
    if (existing) {
      const done = status === 'completed' && totalClean ? totalClean : existing[progress];
      await db.run(
        `UPDATE ${t} SET status = ?, ${total} = COALESCE(?, ${total}), ${progress} = ?,
          genres = COALESCE(?, genres), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, totalClean, done, genres, existing.id]
      );
    } else {
      await db.run(
        `INSERT INTO ${t} (user_id, mal_id, title, image_url, status, ${total}, ${progress}, genres) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, mal_id) DO NOTHING`,
        [req.userId, malId, String(title).slice(0, 300), cover, status, totalClean, status === 'completed' && totalClean ? totalClean : 0, genres]
      );
    }
    const entry = await db.get(`SELECT * FROM ${t} WHERE user_id = ? AND mal_id = ?`, [req.userId, malId]);
    res.status(existing ? 200 : 201).json(unpack(entry));
  });

  // Match plain titles (from a spreadsheet or Word file) to catalogue entries so they can be imported.
  // Titles go to AniList in small batches (one alias per title). If a batch fails, its titles are retried one by one,
  // so a single odd title or a busy moment costs only that title instead of the whole import.
  const fields = anilistType === 'MANGA' ? 'chapters' : 'episodes';
  async function lookup(queries) {
    const vars = {};
    const defs = queries.map((q, n) => { vars[`s${n}`] = q; return `$s${n}: String`; }).join(', ');
    const body = queries.map((_, n) => `
      m${n}: Media(search: $s${n}, type: ${anilistType}, ${anilistType === 'MANGA' ? 'format_not: NOVEL, ' : ''}isAdult: false) {
        idMal title { romaji english } ${fields} genres coverImage { large medium }
      }`).join('\n');
    const data = await anilistQuery(`query (${defs}) { ${body} }`, vars, null, { tolerateErrors: true, retries: 2 });
    return queries.map((_, n) => {
      const m = data?.[`m${n}`];
      if (!m || !m.idMal) return null; // list entries are keyed by MyAnimeList id, so a title without one can't be stored
      return {
        mal_id: m.idMal,
        title: (m.title?.english || m.title?.romaji || '').slice(0, 300),
        image_url: m.coverImage?.large || m.coverImage?.medium || null,
        [total]: m[totalField] ?? null,
        genres: m.genres || []
      };
    });
  }

  router.post('/resolve', async (req, res) => {
    const titles = Array.isArray(req.body?.titles) ? req.body.titles : null;
    if (!titles) return res.status(400).json({ error: 'titles must be an array' });
    if (titles.length > MAX_RESOLVE) return res.status(400).json({ error: `Send at most ${MAX_RESOLVE} titles at a time` });

    const clean = titles.map((x) => (typeof x === 'string' ? x.trim().slice(0, 200) : ''));
    const matches = clean.map(() => null);
    const wanted = clean.map((q, i) => [q, i]).filter(([q]) => q);
    let lastError = '';
    let failures = 0;

    for (let i = 0; i < wanted.length; i += BATCH) {
      const part = wanted.slice(i, i + BATCH);
      try {
        (await lookup(part.map(([q]) => q))).forEach((m, n) => { matches[part[n][1]] = m; });
      } catch (err) {
        console.error('resolve batch failed, retrying one by one:', err.message);
        lastError = err.message;
        for (const [q, idx] of part) {
          try {
            matches[idx] = (await lookup([q]))[0];
          } catch (err2) {
            lastError = err2.message;
            failures += 1;
            matches[idx] = { failed: true };
          }
        }
      }
    }
    // Nothing at all could be looked up: report it as an error instead of a list of "failed" rows
    if (wanted.length && failures === wanted.length) {
      return res.status(502).json({ error: 'Could not reach the anime catalogue just now. Try again in a moment.', detail: errDetail(lastError) });
    }
    res.json({ matches });
  });

  // Bulk upsert from an AniTrack export (overwrites entries with the same mal_id)
  router.post('/import', async (req, res) => {
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
      const score = halfField(e.score);
      const ratings = e.ratings === undefined ? null : packRatings(e.ratings, ratingKeys);
      rows.push({
        malId, title,
        image_url: cleanImageUrl(e.image_url),
        status: statuses.includes(e.status) ? e.status : defaultStatus,
        score: Number.isNaN(score) ? null : score ?? null,
        done, total: tot,
        review: typeof e.review === 'string' ? e.review.slice(0, 5000) || null : null,
        genres: packGenres(e.genres),
        ratings: ratings === false ? null : ratings,
        tags: e.tags === undefined ? null : packTags(e.tags) || null
      });
    }

    // one row per title (the last one wins), sent to the database as parallel arrays in a single statement
    const byId = new Map(rows.map((r) => [r.malId, r]));
    const uniq = [...byId.values()];
    const col = (k) => uniq.map((r) => r[k]);
    if (uniq.length) {
      await db.run(
        `INSERT INTO ${t} (user_id, mal_id, title, image_url, status, score, ${progress}, ${total}, review, genres, ratings, tags)
         SELECT ?::int, * FROM unnest(?::int[], ?::text[], ?::text[], ?::text[], ?::float8[], ?::int[], ?::int[], ?::text[], ?::text[], ?::text[], ?::text[])
         ON CONFLICT (user_id, mal_id) DO UPDATE SET
           title = excluded.title, image_url = excluded.image_url, status = excluded.status, score = excluded.score,
           ${progress} = excluded.${progress}, ${total} = excluded.${total}, review = excluded.review,
           genres = COALESCE(excluded.genres, ${t}.genres), ratings = COALESCE(excluded.ratings, ${t}.ratings), tags = COALESCE(excluded.tags, ${t}.tags),
           updated_at = CURRENT_TIMESTAMP`,
        [req.userId, col('malId'), col('title'), col('image_url'), col('status'), col('score'), col('done'), col('total'), col('review'), col('genres'), col('ratings'), col('tags')]
      );
    }
    res.json({ imported: rows.length, skipped: list.length - rows.length });
  });

  // Update status, overall score (0.5 steps), category ratings, progress, notes. Score, ratings and notes can be cleared with null.
  router.patch('/:id', async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Entry not found' });
    const entry = await db.get(`SELECT * FROM ${t} WHERE id = ? AND user_id = ?`, [req.params.id, req.userId]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const body = req.body || {};
    if (body.status !== undefined && !statuses.includes(body.status)) {
      return res.status(400).json({ error: `status must be one of ${statuses.join(', ')}` });
    }
    const score = halfField(body.score);
    if (Number.isNaN(score)) return res.status(400).json({ error: 'score must be between 0.5 and 10, in steps of 0.5' });
    const done = intField(body[progress], { min: 0, max: entry[total] || 100000 });
    if (Number.isNaN(done)) return res.status(400).json({ error: `${progress} must be between 0 and ${entry[total] ?? 'the total'}` });
    if (done === null) return res.status(400).json({ error: `${progress} cannot be empty` });

    let ratings = entry.ratings;
    if (body.ratings !== undefined) {
      ratings = packRatings(body.ratings, ratingKeys);
      if (ratings === false) return res.status(400).json({ error: `ratings may only use: ${ratingKeys.join(', ')} (0.5 to 10, in steps of 0.5)` });
    }

    let tags = entry.tags;
    if (body.tags !== undefined) {
      tags = packTags(body.tags);
      if (tags === false) return res.status(400).json({ error: 'tags must be a list of short words' });
    }

    const newDone = done === undefined ? entry[progress] : done;
    await db.run(
      `UPDATE ${t} SET status = ?, score = ?, ${progress} = ?, review = ?, ratings = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        body.status ?? entry.status,
        score === undefined ? entry.score : score,
        newDone,
        body.review === undefined ? entry.review : String(body.review).slice(0, 5000) || null,
        ratings,
        tags,
        entry.id,
        req.userId
      ]
    );
    if (done !== undefined && done > (entry[progress] || 0)) {
      await db.run('INSERT INTO activity (user_id, kind, mal_id, delta) VALUES (?, ?, ?, ?)', [req.userId, cfg.kind, entry.mal_id, done - (entry[progress] || 0)]);
    }
    res.json(unpack(await db.get(`SELECT * FROM ${t} WHERE id = ?`, [entry.id])));
  });

  router.delete('/:id', async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Entry not found' });
    const result = await db.run(`DELETE FROM ${t} WHERE id = ? AND user_id = ?`, [req.params.id, req.userId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).send();
  });

  return router;
}

export const mangaListRoutes = makeRouter(KINDS.manga);
export default makeRouter(KINDS.anime);
