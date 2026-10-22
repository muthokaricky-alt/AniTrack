import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBreaker } from '../src/breaker.js';

function clock() {
  let t = 1000;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

test('stays closed until the threshold of failures in a row', () => {
  const c = clock();
  const b = makeBreaker({ threshold: 3, pauseMs: 30000, now: c.now });
  b.failure(); b.failure();
  assert.equal(b.isOpen(), false);
  b.failure();
  assert.equal(b.isOpen(), true);
});

test('a success in between resets the count', () => {
  const c = clock();
  const b = makeBreaker({ threshold: 3, now: c.now });
  b.failure(); b.failure(); b.success(); b.failure(); b.failure();
  assert.equal(b.isOpen(), false);
});

test('reopens for another pause if the next try after the pause also fails', () => {
  const c = clock();
  const b = makeBreaker({ threshold: 3, pauseMs: 30000, now: c.now });
  b.failure(); b.failure(); b.failure();
  c.tick(29999);
  assert.equal(b.isOpen(), true);
  c.tick(2);
  assert.equal(b.isOpen(), false); // one request may go through to check on the service
  b.failure();
  assert.equal(b.isOpen(), true); // still down: pause again
});

test('closes for good once a request succeeds', () => {
  const c = clock();
  const b = makeBreaker({ threshold: 2, pauseMs: 1000, now: c.now });
  b.failure(); b.failure();
  c.tick(1001);
  b.success();
  b.failure();
  assert.equal(b.isOpen(), false);
});
