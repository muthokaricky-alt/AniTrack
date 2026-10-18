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

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    list TEXT NOT NULL,
    position INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    sub TEXT,
    PRIMARY KEY (user_id, kind, list, position),
    UNIQUE (user_id, kind, list, item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Profile fields were added after launch; upgrade older databases in place
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
for (const [col, ddl] of [['avatar', 'TEXT'], ['bio', 'TEXT'], ['is_public', 'INTEGER NOT NULL DEFAULT 0']]) {
  if (!userCols.includes(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${ddl}`);
}

// Older databases predate the genres column (used for the stats page)
const hasGenres = db.prepare("PRAGMA table_info(list_entries)").all().some((c) => c.name === 'genres');
if (!hasGenres) db.exec('ALTER TABLE list_entries ADD COLUMN genres TEXT');

// Optional per-category ratings (story, visuals, music...) stored as JSON next to the overall score.
// Scores themselves need no migration: SQLite keeps a value like 7.5 as a real number in the score column.
for (const table of ['list_entries', 'manga_entries']) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes('ratings')) db.exec(`ALTER TABLE ${table} ADD COLUMN ratings TEXT`);
}

export default db;
