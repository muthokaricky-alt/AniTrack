import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import listRoutes from './routes/lists.js';
import animeRoutes from './routes/anime.js';

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
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/list', listRoutes);
app.use('/api/anime', animeRoutes);
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
