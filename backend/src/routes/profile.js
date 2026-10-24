import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../tokens.js';
import { USER_COLUMNS } from '../userUtil.js';
import { parseBanner, clampPos, dataUrlParts, publicBanner } from '../banner.js';
import { anilistQuery } from './anime.js';
import { CATALOG_DOWN, errDetail } from '../inputs.js';
import { parseAvatar, publicUser } from '../userUtil.js';
import { loadFavorites } from './favorites.js';
import { compareTaste, parseGenres } from '../taste.js';

export { compareTaste }; // follows.js imports it from here

const router = Router();

const getUser = (id) => db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);

// GET /api/profile -> the logged-in user's own profile
router.get('/', requireAuth, async (req, res) => {
  const user = await getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: publicUser(user) });
});

// PATCH /api/profile -> any of username, bio, avatar (null removes it), is_public
router.patch('/', requireAuth, async (req, res) => {
  const user = await getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const body = req.body || {};
  const next = { username: user.username, bio: user.bio, avatar: user.avatar, is_public: user.is_public };

  if (body.username !== undefined) {
    const name = String(body.username).trim();
    if (name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Username must be 2-30 characters' });
    const taken = await db.get('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?', [name, user.id]);
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

  try {
    await db.run('UPDATE users SET username = ?, bio = ?, avatar = ?, is_public = ? WHERE id = ?', [next.username, next.bio, next.avatar, next.is_public, user.id]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    throw err;
  }
  res.json({ user: publicUser(await getUser(user.id)) });
});

// PATCH /api/profile/password
router.patch('/password', requireAuth, async (req, res) => {
  const user = await getUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');
  if (next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  // 400 rather than 401 so a typo doesn't sign the user out
  if (!(await bcrypt.compare(current, user.password_hash))) return res.status(400).json({ error: 'Current password is incorrect' });
  // Bumping token_version signs out every other device. This device gets a fresh token so it stays logged in.
  const updated = await db.get(`UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? RETURNING ${USER_COLUMNS}`, [await bcrypt.hash(next, 10), user.id]);
  res.json({ ok: true, token: signToken(updated) });
});

// POST /api/profile/logout-all -> sign out every other device (this one stays signed in)
router.post('/logout-all', requireAuth, async (req, res) => {
  const updated = await db.get(`UPDATE users SET token_version = token_version + 1 WHERE id = ? RETURNING ${USER_COLUMNS}`, [req.userId]);
  res.json({ ok: true, token: signToken(updated) });
});

// ----- Profile banner -----

// GET /api/profile/banner -> your own banner (the address, or the uploaded picture) and where it sits in the frame
router.get('/banner', requireAuth, async (req, res) => {
  const row = await db.get('SELECT banner, banner_x, banner_y FROM users WHERE id = ?', [req.userId]);
  res.json({ banner: row?.banner || null, x: row?.banner_x ?? 50, y: row?.banner_y ?? 50 });
});

// PUT /api/profile/banner  { banner?: address | data URL | null, x?: 0-100, y?: 0-100 }
// Send `banner` to change or remove the picture (null removes it), and/or `x` and `y` to move it inside the frame.
router.put('/banner', requireAuth, async (req, res) => {
  const body = req.body || {};
  const hasBanner = 'banner' in body;
  if (!hasBanner && !('x' in body) && !('y' in body)) return res.status(400).json({ error: 'Nothing to change' });
  const current = await db.get('SELECT banner, banner_x, banner_y FROM users WHERE id = ?', [req.userId]);
  let banner = current?.banner || null;
  if (hasBanner) {
    const parsed = parseBanner(body.banner);
    if (!parsed.valid) return res.status(400).json({ error: parsed.error });
    banner = parsed.value;
    if (banner === null) {
      // null (or an empty string) means "remove my banner"
      await db.run('UPDATE users SET banner = NULL, banner_x = 50, banner_y = 50, banner_v = banner_v + 1 WHERE id = ?', [req.userId]);
      return res.json({ banner: null, x: 50, y: 50 });
    }
  }
  if (!banner) return res.status(400).json({ error: 'Pick or upload a banner first' });
  const x = clampPos(body.x, current?.banner_x ?? 50);
  const y = clampPos(body.y, current?.banner_y ?? 50);
  // banner_v changes with every save, so browsers replace any cached copy of an uploaded picture
  await db.run('UPDATE users SET banner = ?, banner_x = ?, banner_y = ?, banner_v = banner_v + 1 WHERE id = ?', [banner, x, y, req.userId]);
  res.json({ banner, x, y });
});

// DELETE /api/profile/banner -> remove your banner
router.delete('/banner', requireAuth, async (req, res) => {
  await db.run('UPDATE users SET banner = NULL, banner_x = 50, banner_y = 50, banner_v = banner_v + 1 WHERE id = ?', [req.userId]);
  res.json({ banner: null, x: 50, y: 50 });
});

// GET /api/profile/banner-options -> banner pictures for the series you care about: your favourites first, then your
// highest-rated titles. The pictures live on AniList, so this needs it to be up; titles without a banner are skipped.
const bannerQuery = (type) => `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ${type}) { idMal title { romaji english } bannerImage } } }`;
router.get('/banner-options', requireAuth, async (req, res) => {
  const wanted = { anime: [], manga: [] }; // ids in priority order
  const add = (kind, id, title) => {
    if (wanted[kind].length < 30 && !wanted[kind].some((w) => w.id === id)) wanted[kind].push({ id, title });
  };
  const favs = await db.all(
    `SELECT kind, item_id, title FROM favorites WHERE user_id = ? AND kind IN ('anime', 'manga') ORDER BY (list = 'top3') DESC, position`,
    [req.userId]
  );
  favs.forEach((f) => add(f.kind, f.item_id, f.title));
  for (const [kind, table] of [['anime', 'list_entries'], ['manga', 'manga_entries']]) {
    const rows = await db.all(`SELECT mal_id, title FROM ${table} WHERE user_id = ? AND score IS NOT NULL ORDER BY score DESC, updated_at DESC LIMIT 30`, [req.userId]);
    rows.forEach((r) => add(kind, r.mal_id, r.title));
  }
  const options = [];
  try {
    for (const [kind, type] of [['anime', 'ANIME'], ['manga', 'MANGA']]) {
      const ids = wanted[kind].map((w) => w.id);
      if (!ids.length) continue;
      const data = await anilistQuery(bannerQuery(type), { ids }, `banners:${kind}:${ids.join(',')}`, { retries: 1 });
      const byId = new Map((data.Page.media || []).map((m) => [m.idMal, m]));
      for (const w of wanted[kind]) {
        const m = byId.get(w.id);
        // only offer pictures that could actually be saved as a banner
        if (m?.bannerImage && parseBanner(m.bannerImage).valid) {
          options.push({ kind, mal_id: w.id, title: m.title?.english || m.title?.romaji || w.title, url: m.bannerImage });
        }
      }
    }
  } catch (err) {
    return res.status(502).json({ error: CATALOG_DOWN, detail: errDetail(err) });
  }
  res.json({ options: options.slice(0, 36) });
});

// ----- Public profiles: opt-in only, and only non-sensitive fields -----
export const usersRoutes = Router();

async function summary(table, progress, userId) {
  const rows = await db.all(`SELECT status, score, ${progress} AS progress FROM ${table} WHERE user_id = ?`, [userId]);
  const scored = rows.filter((r) => r.score != null);
  const favorites = await db.all(`SELECT mal_id, title, image_url, score FROM ${table} WHERE user_id = ? AND score IS NOT NULL ORDER BY score DESC, updated_at DESC LIMIT 8`, [userId]);
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    progress: rows.reduce((sum, r) => sum + (r.progress || 0), 0),
    mean: scored.length ? (scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(1) : null,
    favorites
  };
}

// GET /api/users/:username
usersRoutes.get('/:username', async (req, res) => {
  const u = await db.get(
    `SELECT id, username, avatar, bio, is_public, created_at,
            CASE WHEN banner LIKE 'data:%' THEN NULL ELSE banner END AS banner_url, (banner LIKE 'data:%') AS banner_upload,
            banner_x, banner_y, banner_v
       FROM users WHERE lower(username) = lower(?)`,
    [String(req.params.username).slice(0, 60)]
  );
  if (!u || !u.is_public) return res.status(404).json({ error: 'This profile is private or does not exist' });
  res.json({
    user: { username: u.username, avatar: u.avatar || null, bio: u.bio || '', joined: u.created_at, banner: publicBanner(u) },
    anime: await summary('list_entries', 'episodes_watched', u.id),
    manga: await summary('manga_entries', 'chapters_read', u.id),
    favorites: await loadFavorites(u.id)
  });
});

// GET /api/users/:username/banner -> the uploaded banner picture of a PUBLIC profile, cacheable by the browser
// (the address carries ?v=<version>, which changes whenever the banner changes). Private profiles and series banners give 404.
usersRoutes.get('/:username/banner', async (req, res) => {
  const u = await db.get('SELECT is_public, banner FROM users WHERE lower(username) = lower(?)', [String(req.params.username).slice(0, 60)]);
  const parts = u && u.is_public && u.banner ? dataUrlParts(u.banner) : null;
  if (!parts) return res.status(404).end();
  res.set({ 'Content-Type': `image/${parts.type}`, 'Cache-Control': 'public, max-age=86400' });
  res.send(parts.buffer);
});

// ----- Taste match -----
export async function loadTaste(userId) {
  const out = [];
  for (const [kind, table] of [['anime', 'list_entries'], ['manga', 'manga_entries']]) {
    for (const r of await db.all(`SELECT mal_id, title, image_url, score, genres FROM ${table} WHERE user_id = ?`, [userId])) {
      out.push({ kind, mal_id: r.mal_id, title: r.title, image_url: r.image_url, score: r.score, genres: parseGenres(r.genres) });
    }
  }
  return out;
}

// GET /api/users/:username/match -> compare the logged-in user with a public profile
usersRoutes.get('/:username/match', requireAuth, async (req, res) => {
  const them = await db.get('SELECT id, username, is_public FROM users WHERE lower(username) = lower(?)', [String(req.params.username).slice(0, 60)]);
  if (!them || !them.is_public) return res.status(404).json({ error: 'This profile is private or does not exist' });
  if (them.id === req.userId) return res.status(400).json({ error: "That's your own profile" });
  const mine = await loadTaste(req.userId);
  const theirs = await loadTaste(them.id);
  if (!mine.length) return res.status(400).json({ error: 'Add some titles to your list first, then come back to compare' });
  if (!theirs.length) return res.status(400).json({ error: `${them.username} has no titles on their list yet` });
  res.json({ username: them.username, ...compareTaste(mine, theirs) });
});

export default router;
