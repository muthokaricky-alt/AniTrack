import 'dotenv/config';
import 'express-async-errors'; // lets async route handlers pass errors to the error middleware below
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import listRoutes, { mangaListRoutes } from './routes/lists.js';
import activityRoutes from './routes/activity.js';
import animeRoutes from './routes/anime.js';
import mangaRoutes from './routes/manga.js';
import profileRoutes, { usersRoutes } from './routes/profile.js';
import favoritesRoutes from './routes/favorites.js';
import { userFollowRoutes, followRoutes } from './routes/follows.js';
import recommendationRoutes from './routes/recommendations.js';
import characterRoutes from './routes/characters.js';
import imgRoutes from './routes/img.js';
import db from './db.js';
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './securityHeaders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fail fast: without a real secret, tokens would be signed with a guessable key
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_to_a_long_random_string') {
  // RENDER is set automatically on Render, so a forgotten NODE_ENV can't leave the site running on a public, guessable secret
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    console.error('JWT_SECRET is missing or still the placeholder. Set a long random value.');
    process.exit(1);
  }
  console.warn('⚠ JWT_SECRET is the placeholder value. Fine for local dev, never for production.');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real client
const extraHeaders = securityHeaders(process.env);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extraHeaders
  });
  next();
});
// On the live site the app and the API share one address, so no cross-site access is needed unless CORS_ORIGIN says otherwise.
// (Locally the Vite dev server runs on a different port, which is why it stays open outside production.)
const onHost = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
app.use(cors({ origin: process.env.CORS_ORIGIN || !onHost }));
app.use(['/api/list/import', '/api/manga-list/import'], express.json({ limit: '2mb' })); // list backups can be large
// profile photos (data URLs) need a little more room than ordinary JSON bodies
app.use(['/api/auth/register', '/api/profile'], express.json({ limit: '200kb' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Rate limits (per visitor IP). A general ceiling for everything, then tighter ones on the things that cost real money or
// real quota: AniList lookups (all users share this server's IP, which AniList limits) and database-heavy comparisons.
const perMinute = (max) => rateLimit({ windowMs: 60 * 1000, max, message: 'Too many requests. Slow down for a minute.' });
app.use('/api', perMinute(300));
app.use(['/api/anime/search', '/api/manga/search', '/api/characters/search'], perMinute(30));
app.use('/api/anime/schedule', perMinute(10));
app.use(['/api/follows/matches', '/api/users/:username/match'], perMinute(15));
app.use('/api/users', perMinute(90));
app.use('/api/recommendations', perMinute(60));

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Try again in a few minutes.' }),
  authRoutes
);
app.use('/api/list', listRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/manga-list', mangaListRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/manga', mangaRoutes);
app.use('/api/profile/password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Try again in a few minutes.' }));
app.use('/api/profile', profileRoutes);
app.use('/api/users', userFollowRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/img', rateLimit({ windowMs: 60 * 1000, max: 90, message: 'Too many image requests. Try again in a minute.' }), imgRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production the Express server also serves the built React app,
// so one free host runs the whole thing.
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
}

app.use((err, req, res, next) => {
  // bad or oversized request bodies are the sender's mistake, not a server fault
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
try {
  await db.init();
} catch (err) {
  const parts = [err.message, err.code, ...(err.errors || []).map((e) => `${e.code || ''} ${e.address || ''}:${e.port || ''} ${e.message || ''}`.trim())].filter(Boolean);
  console.error('Could not set up the database:', parts.join(' | ') || err);
  if (!parts.length || parts.some((x) => /ECONNREFUSED|ETIMEDOUT|ENETUNREACH|ENOTFOUND|EAI_AGAIN|timeout/i.test(x))) {
    console.error('The server could not reach Neon. Check DATABASE_URL, your internet connection, and whether this network blocks port 5432 (try a phone hotspot).');
  } else if (/password|authentication/i.test(parts.join(' '))) {
    console.error('Neon refused the login. Copy the connection string again (after resetting the password) into backend/.env.');
  }
  process.exit(1);
}
app.listen(PORT, () => console.log(`AniTrack listening on port ${PORT}`));
