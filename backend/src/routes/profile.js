import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseAvatar, publicUser } from '../userUtil.js';

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
    manga: summary('manga_entries', 'chapters_read', u.id)
  });
});

export default router;
