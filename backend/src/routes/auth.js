import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { parseAvatar, publicUser, USER_COLUMNS } from '../userUtil.js';
import { signToken } from '../tokens.js';

const router = Router();

router.post('/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 2-30 characters' });
  }

  const existing = await db.get('SELECT id FROM users WHERE lower(email) = ? OR lower(username) = lower(?)', [email, username]);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  const avatar = parseAvatar(req.body.avatar);
  if (!avatar.valid) return res.status(400).json({ error: 'Profile photo must be a JPEG, PNG or WebP image' });

  const passwordHash = await bcrypt.hash(password, 10);
  let created;
  try {
    created = await db.get(`INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?) RETURNING ${USER_COLUMNS}`, [username, email, passwordHash, avatar.value]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already in use' }); // two sign-ups raced
    throw err;
  }

  const token = signToken(created);
  res.status(201).json({ token, user: publicUser(created) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await db.get(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = ?`, [email]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

export default router;
