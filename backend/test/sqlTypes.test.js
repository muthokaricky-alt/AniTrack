// users.is_public is an INTEGER (0 or 1) while custom_lists.is_public is a BOOLEAN. Using the integer on its own
// as a condition (WHERE u.is_public) makes Postgres reject the query, and the SQL routes are not run in tests.
// This scans the route files for that mistake so it cannot slip back in unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/routes/', import.meta.url).pathname;

test('users.is_public is always compared to a number, never used as a bare condition', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(join(dir, file), 'utf8');
    const offenders = code.match(/\b(WHERE|AND|OR)\s+u\.is_public\b(?!\s*(=|<>|!=|>|<))/g) || [];
    assert.equal(offenders.length, 0, `${file} uses u.is_public as a plain condition: ${offenders.join(' | ')}`);
  }
});

// New accounts are public unless they choose otherwise (existing profiles are never changed by this).
test('new accounts default to a public profile', () => {
  const db = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
  assert.match(db, /is_public INTEGER NOT NULL DEFAULT 1/);
  assert.match(db, /ALTER TABLE users ALTER COLUMN is_public SET DEFAULT 1/);
});
