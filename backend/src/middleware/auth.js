import jwt from 'jsonwebtoken';
import db from '../db.js';
import { tokenMatchesUser } from '../tokenCheck.js';

// Returns the user id a request is really logged in as, or null.
// The token's signature must be valid AND the account behind it must still be the one the token was made for.
async function userIdFromHeader(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const user = await db.get('SELECT id, token_version, created_at FROM users WHERE id = ?', [payload.userId]);
  return tokenMatchesUser(payload, user) ? user.id : null;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const userId = await userIdFromHeader(header);
  if (userId == null) return res.status(401).json({ error: 'Invalid or expired token' });
  req.userId = userId;
  next();
}

// For routes anyone can open, but that show a bit more when the visitor is logged in.
// A missing or bad token just means "logged out" instead of an error.
export async function optionalAuth(req, res, next) {
  const userId = await userIdFromHeader(req.headers.authorization);
  if (userId != null) req.userId = userId;
  next();
}
