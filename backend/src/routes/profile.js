import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseAvatar, publicUser } from '../userUtil.js';
import { loadFavorites } from './favorites.js';

const router = Router();

const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// GET /api/profile -> the logged-in user's own profile
router.get('/', requireAuth, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: publicUser(user) });
});

// PATCH /api/profile -> any of username, bio, avatar (null removes it), is_public
router.patch('/', requireAuth, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const body = req.body || {};
  const next = { username: user.username, bio: user.bio, avatar: user.avatar, is_public: user.is_public };

  if (body.username !== undefined) {
    const name = String(body.username).trim();
    if (name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Username must be 2-30 characters' });
    const taken = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?').get(name, user.id);
    if (taken) return res.status(409).json({ error: 'That username is already taken' });
    next.username = name;
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio ?? '').trim();
    if (bio.length > 300) return res.status(400).json({ error: 'Bio can be at most 300 characters' });
    next.bio = bio || null;
  }
  if (body.avatar !== undefined) {
    const parsed = parseAvatar(body.avatar);
    if (!parsed.valid) return res.status(400).json({ error: 'Profile photo must be a JPEG, PNG or WebP image' });
    next.avatar = parsed.value;
  }
  if (body.is_public !== undefined) next.is_public = body.is_public ? 1 : 0;

  db.prepare('UPDATE users SET username = @username, bio = @bio, avatar = @avatar, is_public = @is_public WHERE id = @id').run({
    ...next,
    id: user.id
  });
  res.json({ user: publicUser(getUser(user.id)) });
});

// PATCH /api/profile/password
router.patch('/password', requireAuth, async (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');
  if (next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  // 400 rather than 401 so a typo doesn't sign the user out
  if (!(await bcrypt.compare(current, user.password_hash))) return res.status(400).json({ error: 'Current password is incorrect' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(next, 10), user.id);
  res.json({ ok: true });
});

// ----- Public profiles: opt-in only, and only non-sensitive fields -----
export const usersRoutes = Router();

function summary(table, progress, userId) {
  const rows = db.prepare(`SELECT status, score, ${progress} AS progress FROM ${table} WHERE user_id = ?`).all(userId);
  const scored = rows.filter((r) => r.score != null);
  const favorites = db
    .prepare(`SELECT mal_id, title, image_url, score FROM ${table} WHERE user_id = ? AND score IS NOT NULL ORDER BY score DESC, updated_at DESC LIMIT 8`)
    .all(userId);
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    progress: rows.reduce((sum, r) => sum + (r.progress || 0), 0),
    mean: scored.length ? (scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(1) : null,
    favorites
  };
}

// GET /api/users/:username
usersRoutes.get('/:username', (req, res) => {
  const u = db
    .prepare('SELECT id, username, avatar, bio, is_public, created_at FROM users WHERE lower(username) = lower(?)')
    .get(String(req.params.username).slice(0, 60));
  if (!u || !u.is_public) return res.status(404).json({ error: 'This profile is private or does not exist' });
  res.json({
    user: { username: u.username, avatar: u.avatar || null, bio: u.bio || '', joined: u.created_at },
    anime: summary('list_entries', 'episodes_watched', u.id),
    manga: summary('manga_entries', 'chapters_read', u.id),
    favorites: loadFavorites(u.id)
  });
});

// ----- Taste match -----
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const parseGenres = (text) => { try { const g = JSON.parse(text || '[]'); return Array.isArray(g) ? g : []; } catch { return []; } };

function loadTaste(userId) {
  const out = [];
  for (const [kind, table] of [['anime', 'list_entries'], ['manga', 'manga_entries']]) {
    for (const r of db.prepare(`SELECT mal_id, title, image_url, score, genres FROM ${table} WHERE user_id = ?`).all(userId)) {
      out.push({ kind, mal_id: r.mal_id, title: r.title, image_url: r.image_url, score: r.score, genres: parseGenres(r.genres) });
    }
  }
  return out;
}

// A genre "taste vector": each title adds weight to its genres, more for high scores (10 counts 6, unscored 1, 4 or less 0.5)
function genreVector(entries) {
  const v = new Map();
  for (const e of entries) {
    const w = e.score != null ? Math.max(0.5, e.score - 4) : 1;
    for (const g of e.genres) v.set(g, (v.get(g) || 0) + w);
  }
  return v;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, x] of b) nb += x * x;
  for (const [g, x] of a) if (b.has(g)) dot += x * b.get(g);
  return na && nb ? dot / Math.sqrt(na * nb) : null;
}

// How alike two people's lists are. Three parts, averaged over the parts that can be measured:
//   genres  (40%): cosine similarity of score-weighted genre vectors, 0.5 or less counts as 0%
//   scores  (40%): how closely they rate titles they both have (0 points apart = 100%, 3 or more apart = 0%)
//   overlap (20%): how many titles they share (40% of the smaller list in common = 100%)
export function compareTaste(mine, theirs) {
  const theirById = new Map(theirs.map((e) => [`${e.kind}:${e.mal_id}`, e]));
  const shared = [];
  for (const e of mine) {
    const o = theirById.get(`${e.kind}:${e.mal_id}`);
    if (o) shared.push({ kind: e.kind, mal_id: e.mal_id, title: e.title, image_url: e.image_url || o.image_url, you: e.score, them: o.score });
  }
  const both = shared.filter((s) => s.you != null && s.them != null);
  const meanDiff = both.length >= 3 ? both.reduce((sum, s) => sum + Math.abs(s.you - s.them), 0) / both.length : null;
  const cos = cosine(genreVector(mine), genreVector(theirs));
  const overlapRaw = mine.length && theirs.length ? shared.length / Math.min(mine.length, theirs.length) : 0;

  const parts = {
    genres: cos == null ? null : clamp01((cos - 0.5) / 0.5),
    scores: meanDiff == null ? null : clamp01(1 - meanDiff / 3),
    overlap: clamp01(overlapRaw / 0.4)
  };
  const weights = { genres: 0.4, scores: 0.4, overlap: 0.2 };
  let sum = 0, wsum = 0;
  for (const k of Object.keys(parts)) if (parts[k] != null) { sum += parts[k] * weights[k]; wsum += weights[k]; }

  // genres you both lean towards, by the smaller of the two weights
  const gm = genreVector(mine), gt = genreVector(theirs);
  const commonGenres = [...gm.keys()].filter((g) => gt.has(g)).sort((a, b) => Math.min(gt.get(b), gm.get(b)) - Math.min(gt.get(a), gm.get(a))).slice(0, 5);

  const pct = (x) => (x == null ? null : Math.round(x * 100));
  return {
    percent: wsum ? Math.round((sum / wsum) * 100) : 0,
    parts: { genres: pct(parts.genres), scores: pct(parts.scores), overlap: pct(parts.overlap) },
    shared_count: shared.length,
    mean_diff: meanDiff == null ? null : Math.round(meanDiff * 10) / 10,
    both_loved: both.filter((s) => s.you >= 8 && s.them >= 8).sort((a, b) => Math.min(b.you, b.them) - Math.min(a.you, a.them)).slice(0, 6),
    disagree: both.filter((s) => Math.abs(s.you - s.them) >= 2).sort((a, b) => Math.abs(b.you - b.them) - Math.abs(a.you - a.them)).slice(0, 3),
    common_genres: commonGenres
  };
}

// GET /api/users/:username/match -> compare the logged-in user with a public profile
usersRoutes.get('/:username/match', requireAuth, (req, res) => {
  const them = db.prepare('SELECT id, username, is_public FROM users WHERE lower(username) = lower(?)').get(String(req.params.username).slice(0, 60));
  if (!them || !them.is_public) return res.status(404).json({ error: 'This profile is private or does not exist' });
  if (them.id === req.userId) return res.status(400).json({ error: "That's your own profile" });
  const mine = loadTaste(req.userId);
  const theirs = loadTaste(them.id);
  if (!mine.length) return res.status(400).json({ error: 'Add some titles to your list first, then come back to compare' });
  if (!theirs.length) return res.status(400).json({ error: `${them.username} has no titles on their list yet` });
  res.json({ username: them.username, ...compareTaste(mine, theirs) });
});

export default router;
