// Tiny in-memory rate limiter (per client IP). Enough to slow down password guessing on a single instance.
export function rateLimit({ windowMs, max, message = 'Too many requests. Please try again later.' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, h] of hits) if (h.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(req.ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
