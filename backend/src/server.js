import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import listRoutes, { mangaListRoutes } from './routes/lists.js';
import animeRoutes from './routes/anime.js';
import mangaRoutes from './routes/manga.js';
import profileRoutes, { usersRoutes } from './routes/profile.js';
import { rateLimit } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fail fast: without a real secret, tokens would be signed with a guessable key
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_to_a_long_random_string') {
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET is missing or still the placeholder. Set a long random value.');
    process.exit(1);
  }
  console.warn('⚠ JWT_SECRET is the placeholder value. Fine for local dev, never for production.');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real client
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(['/api/list/import', '/api/manga-list/import'], express.json({ limit: '2mb' })); // list backups can be large
// profile photos (data URLs) need a little more room than ordinary JSON bodies
app.use(['/api/auth/register', '/api/profile'], express.json({ limit: '200kb' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Try again in a few minutes.' }),
  authRoutes
);
app.use('/api/list', listRoutes);
app.use('/api/manga-list', mangaListRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/manga', mangaRoutes);
app.use('/api/profile/password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Try again in a few minutes.' }));
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
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
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AniTrack listening on port ${PORT}`));
