import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// users.is_public is an INTEGER (0 or 1) while custom_lists.is_public is a BOOLEAN. Using the integer on its own
// as a condition (WHERE u.is_public) makes Postgres reject the query, and the SQL routes are not run in tests.
// This scans the route files for that mistake so it cannot slip back in unnoticed.
const dir = new URL('../src/routes/', import.meta.url).pathname;

test('users.is_public is always compared to a number, never used as a bare condition', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(join(dir, file), 'utf8');
    // only WHERE / AND / OR matter: reading the column in a SELECT list is fine
    const offenders = code.match(/\b(WHERE|AND|OR)\s+u\.is_public\b(?!\s*(=|<>|!=|>|<))/g) || [];
    assert.equal(offenders.length, 0, `${file} uses u.is_public as a plain condition: ${offenders.join(' | ')}`);
  }
});
