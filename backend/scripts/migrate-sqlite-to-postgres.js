// One-time copy of an old SQLite database (anitrack.db) into Postgres.
//
//   npm install --no-save better-sqlite3
//   node scripts/migrate-sqlite-to-postgres.js path/to/anitrack.db
//
// Reads DATABASE_URL from backend/.env. Safe to run twice: rows that already exist are skipped.
import 'dotenv/config';
import db from '../src/db.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate-sqlite-to-postgres.js path/to/anitrack.db');
  process.exit(1);
}

let Sqlite;
try {
  Sqlite = (await import('better-sqlite3')).default;
} catch {
  console.error('Run this first:  npm install --no-save better-sqlite3');
  process.exit(1);
}

const lite = new Sqlite(file, { readonly: true, fileMustExist: true });
const has = (table) => lite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
const cols = (table) => lite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const stamp = (v) => (v ? new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`) : null);

await db.init();
const idMap = new Map(); // old user id -> new user id
let counts = { users: 0, anime: 0, manga: 0, favorites: 0 };

for (const u of lite.prepare('SELECT * FROM users ORDER BY id').all()) {
  const found = await db.get('SELECT id FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)', [u.email, u.username]);
  if (found) { idMap.set(u.id, found.id); continue; }
  const row = await db.get(
    'INSERT INTO users (username, email, password_hash, avatar, bio, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [u.username, u.email, u.password_hash, u.avatar ?? null, u.bio ?? null, u.is_public ? 1 : 0, stamp(u.created_at)]
  );
  idMap.set(u.id, row.id);
  counts.users += 1;
}

async function copyEntries(table, progress, total, key) {
  if (!has(table)) return;
  const have = new Set(cols(table));
  for (const e of lite.prepare(`SELECT * FROM ${table}`).all()) {
    const userId = idMap.get(e.user_id);
    if (!userId) continue;
    const r = await db.run(
      `INSERT INTO ${table} (user_id, mal_id, title, image_url, status, score, ${progress}, ${total}, review, genres, ratings, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, mal_id) DO NOTHING`,
      [userId, e.mal_id, e.title, e.image_url ?? null, e.status, e.score ?? null, e[progress] ?? 0, e[total] ?? null, e.review ?? null,
        have.has('genres') ? e.genres : null, have.has('ratings') ? e.ratings : null, have.has('tags') ? e.tags : null, stamp(e.updated_at)]
    );
    counts[key] += r.changes;
  }
}
await copyEntries('list_entries', 'episodes_watched', 'total_episodes', 'anime');
await copyEntries('manga_entries', 'chapters_read', 'total_chapters', 'manga');

if (has('favorites')) {
  for (const f of lite.prepare('SELECT * FROM favorites').all()) {
    const userId = idMap.get(f.user_id);
    if (!userId) continue;
    const r = await db.run(
      'INSERT INTO favorites (user_id, kind, list, position, item_id, title, image_url, sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
      [userId, f.kind, f.list, f.position, f.item_id, f.title, f.image_url ?? null, f.sub ?? null]
    );
    counts.favorites += r.changes;
  }
}

console.log(`Copied ${counts.users} accounts, ${counts.anime} anime, ${counts.manga} manga, ${counts.favorites} favourites.`);
process.exit(0);
