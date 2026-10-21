import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/middleware/rateLimit.js';

function fakeRes() {
  return {
    code: 200, headers: {}, body: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

test('allows requests up to the limit, then answers 429 with Retry-After', () => {
  const limit = rateLimit({ windowMs: 60000, max: 3, message: 'slow down' });
  let passed = 0;
  const next = () => { passed += 1; };
  for (let i = 0; i < 3; i += 1) limit({ ip: '1.1.1.1' }, fakeRes(), next);
  assert.equal(passed, 3);

  const res = fakeRes();
  limit({ ip: '1.1.1.1' }, res, next);
  assert.equal(passed, 3);
  assert.equal(res.code, 429);
  assert.equal(res.body.error, 'slow down');
  assert.ok(Number(res.headers['Retry-After']) > 0);
});

test('each IP address has its own allowance', () => {
  const limit = rateLimit({ windowMs: 60000, max: 1 });
  let passed = 0;
  const next = () => { passed += 1; };
  limit({ ip: 'a' }, fakeRes(), next);
  limit({ ip: 'b' }, fakeRes(), next);
  assert.equal(passed, 2);
});
