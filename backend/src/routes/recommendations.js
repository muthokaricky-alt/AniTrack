import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isId } from '../inputs.js';
import { cleanImageUrl } from '../imageUrl.js';
import { BOX_LIMIT, cleanNote, limitMessage, parseKind } from '../recommend.js';

// "Recommend to a friend". Rules that keep it from becoming a spam channel:
//  - friends only: both people must follow each other
//  - you can only recommend a title that is on YOUR list, and the title, cover and your score are copied from your own
//    list row, so nobody can send a forged title or an arbitrary picture
//  - the note is short plain text, there are hourly and daily limits, and the same title can't be sent to the same friend twice
const router = Router();
router.use(requireAuth);

const TABLES = { anime: 'list_entries', manga: 'manga_entries' }; // fixed names, never user input
const NOT_FRIENDS = 'You can only send recommendations to friends: people you follow who also follow you back.';

// GET /api/recommendations/friends -> who you can send to (mutual follows)
router.get('/friends', async (req, res) => {
  const rows = await db.all(
    `SELECT u.username FROM follows a
       JOIN follows b ON b.follower_id = a.followee_id AND b.followee_id = a.follower_id
       JOIN users u ON u.id = a.followee_id
      WHERE a.follower_id = ? ORDER BY lower(u.username) LIMIT 100`,
    [req.userId]
  );
  res.json({ friends: rows.map((r) => ({ username: r.username })) });
});

// GET /api/recommendations/unread-count -> a number for the little badge. The app asks once when it opens; it never polls.
router.get('/unread-count', async (req, res) => {
  const row = await db.get('SELECT COUNT(*) AS n FROM recommendations WHERE recipient_id = ? AND read_at IS NULL AND dismissed = FALSE', [req.userId]);
  res.json({ unread: row.n });
});

// GET /api/recommendations?box=inbox|sent -> the latest few, newest first.
// Profile photos are sent once per person (in `avatars`) rather than repeated on every row.
router.get('/', async (req, res) => {
  const sent = req.query.box === 'sent';
  const rows = sent
    ? await db.all(
        `SELECT r.id, r.kind, r.mal_id, r.title, r.image_url, r.sender_score AS score, r.note, r.created_at,
                (r.read_at IS NOT NULL) AS seen, u.username, u.avatar
           FROM recommendations r JOIN users u ON u.id = r.recipient_id
          WHERE r.sender_id = ? ORDER BY r.created_at DESC LIMIT ${BOX_LIMIT}`,
        [req.userId]
      )
    : await db.all(
        `SELECT r.id, r.kind, r.mal_id, r.title, r.image_url, r.sender_score AS score, r.note, r.created_at,
                (r.read_at IS NULL) AS unread, u.username, u.avatar,
                (CASE WHEN r.kind = 'anime'
                      THEN EXISTS (SELECT 1 FROM list_entries le WHERE le.user_id = ? AND le.mal_id = r.mal_id)
                      ELSE EXISTS (SELECT 1 FROM manga_entries me WHERE me.user_id = ? AND me.mal_id = r.mal_id) END) AS on_list
           FROM recommendations r JOIN users u ON u.id = r.sender_id
          WHERE r.recipient_id = ? AND r.dismissed = FALSE ORDER BY r.created_at DESC LIMIT ${BOX_LIMIT}`,
        [req.userId, req.userId, req.userId]
      );
  const avatars = {};
  const items = rows.map(({ avatar, created_at: createdAt, ...r }) => {
    if (avatar) avatars[r.username] = avatar;
    return { ...r, created_at: new Date(createdAt).toISOString() };
  });
  res.json({ box: sent ? 'sent' : 'inbox', items, avatars });
});

// POST /api/recommendations/read -> mark everything in your inbox as seen
router.post('/read', async (req, res) => {
  await db.run('UPDATE recommendations SET read_at = now() WHERE recipient_id = ? AND read_at IS NULL', [req.userId]);
  res.json({ ok: true });
});

// POST /api/recommendations  { to: 'username', kind: 'anime'|'manga', mal_id, note? }
router.post('/', async (req, res) => {
  const body = req.body || {};
  const kind = parseKind(body.kind);
  if (!kind || !isId(body.mal_id)) return res.status(400).json({ error: 'Pick a title from your list to recommend.' });
  const malId = Number(body.mal_id);
  const note = cleanNote(body.note);
  const toName = String(body.to || '').trim().slice(0, 60);
  if (!toName) return res.status(400).json({ error: 'Choose a friend to send it to.' });

  // The recipient must exist AND be a mutual follow. One message for both, so this can't be used to look people up.
  const friend = await db.get(
    `SELECT u.id, u.username FROM users u
      WHERE lower(u.username) = lower(?)
        AND EXISTS (SELECT 1 FROM follows a JOIN follows b ON b.follower_id = a.followee_id AND b.followee_id = a.follower_id
                     WHERE a.follower_id = ? AND a.followee_id = u.id)`,
    [toName, req.userId]
  );
  if (!friend) return res.status(403).json({ error: NOT_FRIENDS });

  const entry = await db.get(`SELECT title, image_url, score FROM ${TABLES[kind]} WHERE user_id = ? AND mal_id = ?`, [req.userId, malId]);
  if (!entry) return res.status(400).json({ error: 'Add this title to your list first. You can only recommend things from your own list.' });

  const hour = await db.get(`SELECT COUNT(*) AS n FROM recommendations WHERE sender_id = ? AND created_at > now() - interval '1 hour'`, [req.userId]);
  const day = await db.get(`SELECT COUNT(*) AS n FROM recommendations WHERE sender_id = ? AND recipient_id = ? AND created_at > now() - interval '1 day'`, [req.userId, friend.id]);
  const tooMany = limitMessage({ lastHour: hour.n, toRecipientToday: day.n });
  if (tooMany) return res.status(429).json({ error: tooMany });

  const created = await db.get(
    `INSERT INTO recommendations (sender_id, recipient_id, kind, mal_id, title, image_url, sender_score, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id`,
    [req.userId, friend.id, kind, malId, String(entry.title).slice(0, 300), cleanImageUrl(entry.image_url), entry.score ?? null, note]
  );
  if (!created) return res.status(409).json({ error: `You already recommended this to ${friend.username}.` });
  res.status(201).json({ ok: true, id: created.id, to: friend.username });
});

// DELETE /api/recommendations/:id
//  - the person it was sent TO dismisses it (it is hidden, but kept so the same title can't be re-sent over and over)
//  - the person who SENT it unsends it (it disappears for both)
router.delete('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const id = Number(req.params.id);
  const row = await db.get('SELECT sender_id, recipient_id FROM recommendations WHERE id = ?', [id]);
  if (!row || (row.sender_id !== req.userId && row.recipient_id !== req.userId)) return res.status(404).json({ error: 'Not found' });
  if (row.recipient_id === req.userId) {
    await db.run('UPDATE recommendations SET dismissed = TRUE, read_at = COALESCE(read_at, now()) WHERE id = ?', [id]);
  } else {
    await db.run('DELETE FROM recommendations WHERE id = ?', [id]);
  }
  res.json({ ok: true });
});

export default router;
