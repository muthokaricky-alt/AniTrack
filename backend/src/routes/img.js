import { Router } from 'express';
import fetch from 'node-fetch';

// Cover images come from other sites, and a browser refuses to export a canvas that contains pictures from a site
// that doesn't allow it. The share-card maker loads covers through this route so they count as same-site.
// Only a short list of image hosts is allowed, so this can't be used to reach anything else.
const ALLOWED = [/^s\d+\.anilist\.co$/i, /^img\d*\.anilist\.co$/i, /^cdn\.myanimelist\.net$/i];
const MAX_BYTES = 3 * 1024 * 1024;

const router = Router();

router.get('/', async (req, res) => {
  let url;
  try {
    url = new URL(String(req.query.url || ''));
  } catch {
    return res.status(400).json({ error: 'Invalid image address' });
  }
  if (url.protocol !== 'https:' || url.port || url.username || !ALLOWED.some((re) => re.test(url.hostname))) {
    return res.status(400).json({ error: 'That image host is not allowed' });
  }
  try {
    const upstream = await fetch(url.href, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const type = String(upstream.headers.get('content-type') || '');
    if (!upstream.ok || !/^image\/(jpeg|png|webp|gif|avif)/i.test(type)) return res.status(502).json({ error: 'Could not load that image' });
    const length = Number(upstream.headers.get('content-length'));
    if (length > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });
    res.set({ 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable' });
    res.send(buf);
  } catch {
    res.status(502).json({ error: 'Could not load that image' });
  }
});

export default router;
