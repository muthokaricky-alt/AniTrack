import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { cleanListInput, MAX_LISTS, MAX_ITEMS } from '../customList.js';
import { parsePage } from '../paging.js';

const router = Router();
const isId = (s) => /^\d{1,9}$/.test(String(s));

// Rows of custom_lists plus a count and up to four covers each, for list cards
async function withCovers(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const covers = await db.all(
    `SELECT list_id, image_url FROM custom_list_items WHERE list_id IN (${marks}) AND image_url IS NOT NULL AND position < 4 ORDER BY list_id, position`,
    ids
  );
  const byList = new Map();
  for (const c of covers) byList.set(c.list_id, [...(byList.get(c.list_id) || []), c.image_url]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    ranked: r.ranked,
    is_public: r.is_public,
    count: r.count,
    covers: byList.get(r.id) || [],
    ...(r.username ? { owner: { username: r.username } } : {}),
    ...(r.saves != null ? { saves: r.saves } : {}),
    updated_at: r.updated_at
  }));
}

const SUMMARY_SQL = `
  SELECT l.id, l.title, l.description, l.ranked, l.is_public, l.updated_at,
         (SELECT COUNT(*) FROM custom_list_items i WHERE i.list_id = l.id) AS count
  FROM custom_lists l`;

async function loadFull(id, viewerId) {
  const list = await db.get(
    'SELECT l.id, l.user_id, l.title, l.description, l.ranked, l.is_public, l.created_at, l.updated_at, u.username FROM custom_lists l JOIN users u ON u.id = l.user_id WHERE l.id = ?',
    [id]
  );
  if (!list) return null;
  const isOwner = viewerId != null && viewerId === list.user_id;
  if (!list.is_public && !isOwner) return null; // a private list looks exactly like one that does not exist
  const items = await db.all('SELECT kind, mal_id, title, image_url, note FROM custom_list_items WHERE list_id = ? ORDER BY position', [id]);
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    ranked: list.ranked,
    is_public: list.is_public,
    owner: { username: list.username },
    is_owner: isOwner,
    created_at: list.created_at,
    updated_at: list.updated_at,
    items
  };
}

async function replaceItems(t, listId, items) {
  await t.run('DELETE FROM custom_list_items WHERE list_id = ?', [listId]);
  for (const [i, it] of items.entries()) {
    await t.run(
      'INSERT INTO custom_list_items (list_id, position, kind, mal_id, title, image_url, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [listId, i, it.kind, it.mal_id, it.title, it.image_url, it.note]
    );
  }
}

// GET /api/custom-lists  (my lists)
router.get('/', requireAuth, async (req, res) => {
  const rows = await db.all(`${SUMMARY_SQL} WHERE l.user_id = ? ORDER BY l.updated_at DESC`, [req.userId]);
  res.json({ lists: await withCovers(rows) });
});

// GET /api/custom-lists/user/:username  (that person's public lists, only if their profile is public)
router.get('/user/:username', async (req, res) => {
  const user = await db.get('SELECT id, username, is_public FROM users WHERE lower(username) = lower(?)', [String(req.params.username).slice(0, 60)]);
  // A private profile answers exactly like a missing one. A single public list can still be opened by its own link.
  if (!user || !user.is_public) return res.status(404).json({ error: 'User not found' });
  const rows = await db.all(`${SUMMARY_SQL} WHERE l.user_id = ? AND l.is_public ORDER BY l.updated_at DESC`, [user.id]);
  res.json({ username: user.username, lists: await withCovers(rows) });
});

// GET /api/custom-lists/discover?page=1  (public lists from public profiles with at least 3 titles, most saved first)
router.get('/discover', async (req, res) => {
  const { limit, offset } = parsePage(req.query.page);
  const rows = await db.all(
    `SELECT * FROM (
       SELECT l.id, l.title, l.description, l.ranked, l.is_public, l.updated_at, u.username,
              (SELECT COUNT(*) FROM custom_list_items i WHERE i.list_id = l.id) AS count,
              (SELECT COUNT(*) FROM custom_lists c WHERE c.copied_from = l.id) AS saves
       FROM custom_lists l JOIN users u ON u.id = l.user_id
       WHERE l.is_public AND u.is_public = 1  -- lists use true/false, but users.is_public holds 0 or 1
     ) t
     WHERE t.count >= 3
     ORDER BY t.saves DESC, t.updated_at DESC
     LIMIT ? OFFSET ?`,
    [limit + 1, offset] // one extra row tells us whether there is another page
  );
  res.json({ lists: await withCovers(rows.slice(0, limit)), has_more: rows.length > limit });
});

// POST /api/custom-lists  { title, description?, ranked?, is_public?, items? }
router.post('/', requireAuth, async (req, res) => {
  const { value, error } = cleanListInput(req.body);
  if (error) return res.status(400).json({ error });
  if (!value.title) return res.status(400).json({ error: 'Give the list a title of 1 to 80 characters' });

  const { n } = await db.get('SELECT COUNT(*) AS n FROM custom_lists WHERE user_id = ?', [req.userId]);
  if (n >= MAX_LISTS) return res.status(400).json({ error: `You can have at most ${MAX_LISTS} lists. Delete one to make room.` });

  const id = await db.tx(async (t) => {
    const made = await t.run(
      'INSERT INTO custom_lists (user_id, title, description, ranked, is_public) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [req.userId, value.title, value.description ?? null, value.ranked ?? false, value.is_public ?? false]
    );
    const newId = made.rows[0].id;
    if (value.items?.length) await replaceItems(t, newId, value.items);
    return newId;
  });
  res.status(201).json(await loadFull(id, req.userId));
});

// GET /api/custom-lists/:id  (public lists are open to everyone, private ones only to their owner)
router.get('/:id', optionalAuth, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'List not found' });
  const list = await loadFull(Number(req.params.id), req.userId);
  if (!list) return res.status(404).json({ error: 'List not found' });
  res.json(list);
});

// PUT /api/custom-lists/:id  (any of title, description, ranked, is_public, items; items replaces the whole list in order)
router.put('/:id', requireAuth, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'List not found' });
  const id = Number(req.params.id);
  const mine = await db.get('SELECT id FROM custom_lists WHERE id = ? AND user_id = ?', [id, req.userId]);
  if (!mine) return res.status(404).json({ error: 'List not found' });

  const { value, error } = cleanListInput(req.body);
  if (error) return res.status(400).json({ error });

  await db.tx(async (t) => {
    const sets = [];
    const params = [];
    for (const key of ['title', 'description', 'ranked', 'is_public']) {
      if (key in value) { sets.push(`${key} = ?`); params.push(value[key]); }
    }
    await t.run(`UPDATE custom_lists SET ${sets.length ? `${sets.join(', ')}, ` : ''}updated_at = now() WHERE id = ?`, [...params, id]);
    if (value.items) await replaceItems(t, id, value.items);
  });
  res.json(await loadFull(id, req.userId));
});

// POST /api/custom-lists/:id/items  { kind, mal_id, title, image_url?, note? }  (adds one title to the end, for "Add to list" buttons)
router.post('/:id/items', requireAuth, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'List not found' });
  const id = Number(req.params.id);
  const { value, error } = cleanListInput({ items: [req.body] });
  if (error) return res.status(400).json({ error });
  const item = value.items[0];

  const result = await db.tx(async (t) => {
    // Locking the list row makes two quick adds queue up instead of colliding on the same position
    const mine = await t.get('SELECT id FROM custom_lists WHERE id = ? AND user_id = ? FOR UPDATE', [id, req.userId]);
    if (!mine) return { status: 404, error: 'List not found' };
    const { n, next } = await t.get('SELECT COUNT(*) AS n, COALESCE(MAX(position) + 1, 0) AS next FROM custom_list_items WHERE list_id = ?', [id]);
    if (n >= MAX_ITEMS) return { status: 400, error: `That list is full (${MAX_ITEMS} titles)` };
    await t.run(
      'INSERT INTO custom_list_items (list_id, position, kind, mal_id, title, image_url, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, next, item.kind, item.mal_id, item.title, item.image_url, item.note]
    );
    await t.run('UPDATE custom_lists SET updated_at = now() WHERE id = ?', [id]);
    return { count: n + 1 };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json({ ok: true, count: result.count });
});

// POST /api/custom-lists/:id/copy  (save a copy of a public list, or duplicate your own; the copy is private)
router.post('/:id/copy', requireAuth, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'List not found' });
  const source = await loadFull(Number(req.params.id), req.userId); // null when it is private and not yours
  if (!source) return res.status(404).json({ error: 'List not found' });

  const { n } = await db.get('SELECT COUNT(*) AS n FROM custom_lists WHERE user_id = ?', [req.userId]);
  if (n >= MAX_LISTS) return res.status(400).json({ error: `You can have at most ${MAX_LISTS} lists. Delete one to make room.` });

  const newId = await db.tx(async (t) => {
    const made = await t.run(
      'INSERT INTO custom_lists (user_id, title, description, ranked, is_public, copied_from) VALUES (?, ?, ?, ?, FALSE, ?) RETURNING id',
      [req.userId, source.title, source.description, source.ranked, source.id]
    );
    const id = made.rows[0].id;
    // the explicit cast lets Postgres know what the first value is
    await t.run(
      'INSERT INTO custom_list_items (list_id, position, kind, mal_id, title, image_url, note) SELECT ?::integer, position, kind, mal_id, title, image_url, note FROM custom_list_items WHERE list_id = ?',
      [id, source.id]
    );
    return id;
  });
  res.status(201).json(await loadFull(newId, req.userId));
});

// DELETE /api/custom-lists/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'List not found' });
  const done = await db.run('DELETE FROM custom_lists WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  if (done.changes === 0) return res.status(404).json({ error: 'List not found' });
  res.json({ ok: true });
});

export default router;
