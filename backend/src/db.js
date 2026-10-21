import pg from 'pg';

// PostgreSQL (Neon in production). One pool for the whole server.
// Set DATABASE_URL in backend/.env locally and in Render's Environment tab.
//
// Some networks block the normal Postgres port (5432). Setting NEON_WEBSOCKET=1 in backend/.env makes the server talk to
// Neon over a WebSocket on port 443 (the same port as any website) instead. Leave it off on Render.
let driver = pg;
if (process.env.NEON_WEBSOCKET === '1') {
  const neon = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');
  neon.neonConfig.webSocketConstructor = ws;
  driver = neon;
}
const { Pool, types } = driver;
types.setTypeParser(20, (v) => Number(v));      // COUNT(*) and other bigints arrive as numbers
types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC as numbers

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
  connectionTimeoutMillis: 15000 // a sleeping Neon database needs a moment to wake
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

const db = {
  ...bind(pool),
  // run several statements as one all-or-nothing unit: await db.tx(async (t) => { await t.run(...); ... })
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
        is_public INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS list_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'plan_to_watch',
        score DOUBLE PRECISION,
        episodes_watched INTEGER DEFAULT 0,
        total_episodes INTEGER,
        review TEXT,
        genres TEXT,
        ratings TEXT,
        tags TEXT,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, mal_id)
      );

      CREATE TABLE IF NOT EXISTS manga_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'plan_to_read',
        score DOUBLE PRECISION,
        chapters_read INTEGER DEFAULT 0,
        total_chapters INTEGER,
        review TEXT,
        genres TEXT,
        ratings TEXT,
        tags TEXT,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, mal_id)
      );

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
    `);
  }
};

export default db;
