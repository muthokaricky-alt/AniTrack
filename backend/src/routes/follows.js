import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loadTaste, compareTaste } from './profile.js';

// Following is deliberately simple: no approvals, no notifications, no feed. Just "who do I follow" and "who follows me",
// which is what makes the taste match useful across several people at once.
const MAX_FOLLOWING = 100; // keeps the "match with everyone you follow" screen quick
const LIST_LIMIT = 50;
const MATCH_LIMIT = 30;
const PRIVATE_MSG = 'This profile is private or does not exist';

const findUser = (name) => db.get('SELECT id, username, is_public FROM users WHERE lower(username) = lower(?)', [String(name).slice(0, 60)]);

// Follower / following counts. Other people only see public profiles in the numbers and lists (a private profile stays private),
// the owner sees everyone.
async function counts(userId, ownerView) {
  const pub = ownerView ? '' : 'AND u.is_public = 1';
  const followers = await db.get(`SELECT COUNT(*) AS n FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ? ${pub}`, [userId]);
  const following = await db.get(`SELECT COUNT(*) AS n FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? ${pub}`, [userId]);
  return { followers: followers.n, following: following.n };
}

async function info(target, viewerId) {
  const own = viewerId === target.id;
  const rel = viewerId && !own ? await db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [viewerId, target.id]) : null;
  return { ...(await counts(target.id, own)), is_self: own, is_following: Boolean(rel) };
}

const followLimit = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Slow down a little. Try again in a minute.' });

// ----- /api/users/:username/... -----
export const userFollowRoutes = Router();

// GET counts, plus whether the logged-in visitor follows this person
userFollowRoutes.get('/:username/follow', optionalAuth, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target || (!target.is_public && target.id !== req.userId)) return res.status(404).json({ error: PRIVATE_MSG });
  res.json(await info(target, req.userId));
});

// GET the people who follow them, or that they follow: ?type=followers|following
userFollowRoutes.get('/:username/network', optionalAuth, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target || (!target.is_public && target.id !== req.userId)) return res.status(404).json({ error: PRIVATE_MSG });
  const type = req.query.type === 'following' ? 'following' : 'followers';
  const [show, filter] = type === 'followers' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id']; // fixed column names, never user input
  const pub = target.id === req.userId ? '' : 'AND u.is_public = 1';
  const rows = await db.all(
    `SELECT u.username, u.avatar, u.is_public FROM follows f JOIN users u ON u.id = f.${show} WHERE f.${filter} = ? ${pub} ORDER BY f.created_at DESC LIMIT ${LIST_LIMIT}`,
    [target.id]
  );
  res.json({ type, users: rows.map((u) => ({ username: u.username, avatar: u.avatar || null, is_public: Boolean(u.is_public) })) });
});

userFollowRoutes.post('/:username/follow', requireAuth, followLimit, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target || !target.is_public) return res.status(404).json({ error: PRIVATE_MSG });
  if (target.id === req.userId) return res.status(400).json({ error: "You can't follow yourself" });
  const already = await db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [req.userId, target.id]);
  if (!already) {
    const { n } = await db.get('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?', [req.userId]);
    if (n >= MAX_FOLLOWING) return res.status(400).json({ error: `You can follow up to ${MAX_FOLLOWING} people. Unfollow someone first.` });
    await db.run('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.userId, target.id]);
  }
  res.json(await info(target, req.userId));
});

// Unfollowing always works, even if they have since gone private
userFollowRoutes.delete('/:username/follow', requireAuth, followLimit, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'That user does not exist' });
  await db.run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [req.userId, target.id]);
  if (!target.is_public && target.id !== req.userId) return res.json({ is_following: false });
  res.json(await info(target, req.userId));
});

// ----- /api/follows/... -----
export const followRoutes = Router();

// GET everyone you follow (public profiles), each with their taste match against you, best match first
followRoutes.get('/matches', requireAuth, async (req, res) => {
  const people = await db.all(
    `SELECT u.id, u.username, u.avatar FROM follows f JOIN users u ON u.id = f.followee_id
     WHERE f.follower_id = ? AND u.is_public = 1 ORDER BY f.created_at DESC LIMIT ${MATCH_LIMIT}`,
    [req.userId]
  );
  const mine = await loadTaste(req.userId);
  const matches = await Promise.all(
    people.map(async (p) => {
      const base = { username: p.username, avatar: p.avatar || null, percent: null, shared_count: 0, common_genres: [] };
      if (!mine.length) return base;
      const theirs = await loadTaste(p.id);
      if (!theirs.length) return base;
      const m = compareTaste(mine, theirs);
      return { ...base, percent: m.percent, shared_count: m.shared_count, common_genres: m.common_genres.slice(0, 3) };
    })
  );
  matches.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  res.json({ matches, has_list: mine.length > 0 });
});
