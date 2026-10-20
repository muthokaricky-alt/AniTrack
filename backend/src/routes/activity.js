import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/activity  -> progress events from the last 400 days: [{ ts, kind, delta }]
// The browser groups them by the user's own local day, so streaks follow their clock, not the server's.
router.get('/', async (req, res) => {
  const rows = (
    await db.all(`SELECT created_at AS ts, kind, delta FROM activity WHERE user_id = ? AND created_at >= now() - interval '400 days' ORDER BY created_at DESC LIMIT 6000`, [req.userId])
  ).map((r) => ({ ...r, ts: new Date(r.ts).toISOString() }));
  res.json({ events: rows });
});

export default router;
