// PostgreSQL (Neon in production). One pool for the whole server.
// Set DATABASE_URL in backend/.env locally and in Render's Environment tab.
//
// Some networks block the normal Postgres port (5432). Setting NEON_WEBSOCKET=1 in backend/.env makes the server talk to
// Neon over a WebSocket on port 443 (the same port as any website) instead. Leave it off on Render.
import pg from 'pg';

let driver = pg;
if (process.env.NEON_WEBSOCKET === '1') {
  const neon = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');
  neon.neonConfig.webSocketConstructor = ws;
  driver = neon;
}
const { Pool, types } = driver;
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to backend/.env (and to Render > Environment).');
  process.exit(1);
}

// Neon's string ends in ?sslmode=require&channel_binding=require. Say "verify-full" outright (what pg does for "require"
// anyway, minus its warning) and drop channel_binding, which the driver does not need.
const connectionString = process.env.DATABASE_URL.trim().replace(/([?&])sslmode=require/, '$1sslmode=verify-full').replace(/[?&]channel_binding=[^&]*/, '');

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000
});
// Neon closes idle connections: that is normal, the pool simply opens a new one next time
pool.on('error', (err) => console.warn('database connection dropped:', err.message));

// SQL is written with ? placeholders; turn them into $1, $2, ... for Postgres
function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}
const clean = (params) => params.map((p) => (p === undefined ? null : p));

function bind(runner) {
  const run = (sql, params = []) => runner.query(toPg(sql), clean(params));
  return {
    all: async (sql, params) => (await run(sql, params)).rows,
    get: async (sql, params) => (await run(sql, params)).rows[0],
    run: async (sql, params) => { const r = await run(sql, params); return { changes: r.rowCount, rows: r.rows }; }
  };
}

// The anime and manga list tables are identical apart from their name, default status and progress columns.
const entryTable = (name, status, done, total) => `CREATE TABLE IF NOT EXISTS ${name} (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT '${status}',
        score DOUBLE PRECISION,
        ${done} INTEGER DEFAULT 0,
        ${total} INTEGER,
        review TEXT,
        genres TEXT,
        ratings TEXT,
        tags TEXT,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, mal_id)
      );
      ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS started_on DATE;
      ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS finished_on DATE;
      ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS rewatches INTEGER NOT NULL DEFAULT 0;`;

const db = {
  ...bind(pool),
  async tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(bind(client));
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  async init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        bio TEXT,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_shape TEXT NOT NULL DEFAULT 'circle';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_x INTEGER NOT NULL DEFAULT 50;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_y INTEGER NOT NULL DEFAULT 50;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_v INTEGER NOT NULL DEFAULT 0;

      -- new accounts are public unless they choose otherwise; this changes only the default, never an existing profile
      ALTER TABLE users ALTER COLUMN is_public SET DEFAULT 1;
      ${entryTable('list_entries', 'plan_to_watch', 'episodes_watched', 'total_episodes')}
      ${entryTable('manga_entries', 'plan_to_read', 'chapters_read', 'total_chapters')}

      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        list TEXT NOT NULL,
        position INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        sub TEXT,
        PRIMARY KEY (user_id, kind, list, position),
        UNIQUE (user_id, kind, list, item_id)
      );

      CREATE TABLE IF NOT EXISTS activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        mal_id INTEGER NOT NULL,
        delta INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS activity_user_time ON activity (user_id, created_at);

      CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id),
        CHECK (follower_id <> followee_id)
      );
      CREATE INDEX IF NOT EXISTS follows_followee ON follows (followee_id);
      CREATE TABLE IF NOT EXISTS recommendations (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('anime', 'manga')),
        mal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        sender_score DOUBLE PRECISION,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        read_at TIMESTAMPTZ,
        dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        CHECK (sender_id <> recipient_id),
        UNIQUE (sender_id, recipient_id, kind, mal_id)
      );
      CREATE INDEX IF NOT EXISTS recs_recipient ON recommendations (recipient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS recs_sender ON recommendations (sender_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS custom_lists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        ranked BOOLEAN NOT NULL DEFAULT FALSE,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS custom_lists_user ON custom_lists (user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS custom_list_items (
        list_id INTEGER NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('anime', 'manga', 'character')),
        mal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        note TEXT,
        PRIMARY KEY (list_id, position)
      );
      ALTER TABLE custom_lists ADD COLUMN IF NOT EXISTS copied_from INTEGER REFERENCES custom_lists(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS custom_lists_copied ON custom_lists (copied_from) WHERE copied_from IS NOT NULL;
      ALTER TABLE custom_list_items DROP CONSTRAINT IF EXISTS custom_list_items_list_id_kind_mal_id_key;
      ALTER TABLE custom_list_items DROP CONSTRAINT IF EXISTS custom_list_items_kind_check;
      ALTER TABLE custom_list_items ADD CONSTRAINT custom_list_items_kind_check CHECK (kind IN ('anime', 'manga', 'character'));
    `);
  }
};

export default db;
