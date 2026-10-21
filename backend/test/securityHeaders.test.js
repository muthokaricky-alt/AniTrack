import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp, securityHeaders } from '../src/securityHeaders.js';

test('the policy allows the places the site really loads from', () => {
  const csp = buildCsp();
  assert.match(csp, /frame-src [^;]*https:\/\/w\.soundcloud\.com/); // music player
  assert.match(csp, /frame-src [^;]*https:\/\/www\.youtube-nocookie\.com/); // trailers
  assert.match(csp, /script-src [^;]*https:\/\/w\.soundcloud\.com/); // player API
  assert.match(csp, /style-src [^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src [^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /img-src [^;]*data:/); // profile photos
});

test('the policy blocks plugins and framing by other sites', () => {
  const csp = buildCsp();
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /script-src [^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src [^;]*'unsafe-eval'/);
});

test('it starts in report-only mode and only enforces when asked', () => {
  assert.ok('Content-Security-Policy-Report-Only' in securityHeaders({}));
  assert.ok(!('Content-Security-Policy' in securityHeaders({})));
  assert.ok('Content-Security-Policy' in securityHeaders({ CSP_ENFORCE: '1' }));
  assert.ok(!('Content-Security-Policy-Report-Only' in securityHeaders({ CSP_ENFORCE: '1' })));
});

test('HSTS is only sent in production', () => {
  assert.ok(!('Strict-Transport-Security' in securityHeaders({})));
  assert.ok('Strict-Transport-Security' in securityHeaders({ NODE_ENV: 'production' }));
});
