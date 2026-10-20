import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// For routes anyone can open, but that show a bit more when the visitor is logged in.
// A missing or bad token just means "logged out" instead of an error.
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.userId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET).userId;
    } catch {
      /* treat as logged out */
    }
  }
  next();
}
