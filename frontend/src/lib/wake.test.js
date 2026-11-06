import test from 'node:test';
import assert from 'node:assert/strict';
import { isRead, looksAsleep, createWakeTracker } from './wake.js';

test('only reads are retried', () => {
  assert.equal(isRead(), true);
  assert.equal(isRead({ method: 'get' }), true);
  assert.equal(isRead({ method: 'POST' }), false);
  assert.equal(isRead({ method: 'DELETE' }), false);
});

test('proxy errors count as asleep, our own JSON errors do not', () => {
  assert.equal(looksAsleep(503, {}), true);
  assert.equal(looksAsleep(502, {}), true);
  assert.equal(looksAsleep(502, { error: 'Anime catalogue is unavailable' }), false);
  assert.equal(looksAsleep(404, {}), false);
  assert.equal(looksAsleep(200, {}), false);
});

test('fast requests never announce waking', async () => {
  const events = [];
  const track = createWakeTracker((n) => events.push(n), 40);
  const done = track();
  done();
  await new Promise((r) => setTimeout(r, 70));
  assert.deepEqual(events, []);
});

test('slow requests announce waking once, and awake when all finish', async () => {
  const events = [];
  const track = createWakeTracker((n) => events.push(n), 30);
  const a = track();
  const b = track();
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(events, ['anitrack:waking']);
  a();
  assert.deepEqual(events, ['anitrack:waking']);
  b();
  assert.deepEqual(events, ['anitrack:waking', 'anitrack:awake']);
});
