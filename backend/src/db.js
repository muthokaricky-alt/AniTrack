import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'anitrack.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS list_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'plan_to_watch',
    score INTEGER,
    episodes_watched INTEGER DEFAULT 0,
    total_episodes INTEGER,
    review TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, mal_id)
  );

  CREATE TABLE IF NOT EXISTS manga_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'plan_to_read',
    score INTEGER,
    chapters_read INTEGER DEFAULT 0,
    total_chapters INTEGER,
    genres TEXT,
    review TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, mal_id)
  );
`);

// Older databases predate the genres column (used for the stats page)
const hasGenres = db.prepare("PRAGMA table_info(list_entries)").all().some((c) => c.name === 'genres');
if (!hasGenres) db.exec('ALTER TABLE list_entries ADD COLUMN genres TEXT');

export default db;
