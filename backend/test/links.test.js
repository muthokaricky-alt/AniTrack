// Tests for src/links.js: cleaning AniList external links into official watch and read links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toOfficialLinks } from '../src/links.js';

const L = (over) => ({ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/x', type: 'STREAMING', language: 'English', isDisabled: false, ...over });

test('keeps live https streaming links and drops everything else', () => {
  const out = toOfficialLinks([
    L(),
    L({ site: 'Official Site', type: 'INFO', url: 'https://example.com' }),
    L({ site: 'Twitter', type: 'SOCIAL', url: 'https://twitter.com/x' }),
    L({ site: 'Old', url: 'http://insecure.example.com' }),
    L({ site: 'Gone', url: 'https://gone.example.com', isDisabled: true }),
    L({ site: '', url: 'https://nosite.example.com' }),
    L({ site: 'Script', url: 'javascript:alert(1)' }),
    null
  ]);
  assert.deepEqual(out, [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/x', language: 'English' }]);
});

test('removes duplicates, caps the list and tolerates bad input', () => {
  assert.equal(toOfficialLinks([L(), L()]).length, 1);
  const many = Array.from({ length: 20 }, (_, i) => L({ url: `https://site${i}.example.com` }));
  assert.equal(toOfficialLinks(many).length, 8);
  assert.deepEqual(toOfficialLinks(undefined), []);
  assert.deepEqual(toOfficialLinks('nope'), []);
});

test('missing language becomes null and long site names are trimmed', () => {
  const [item] = toOfficialLinks([L({ language: undefined, site: 'x'.repeat(100) })]);
  assert.equal(item.language, null);
  assert.equal(item.site.length, 40);
});
