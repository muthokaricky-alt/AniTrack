import test from 'node:test';
import assert from 'node:assert/strict';
import { isHorizontal, swipeAction } from './swipe.js';

test('only clearly sideways drags take over from scrolling', () => {
  assert.equal(isHorizontal(40, 5), true);
  assert.equal(isHorizontal(-40, 10), true);
  assert.equal(isHorizontal(6, 0), false);   // too small to tell
  assert.equal(isHorizontal(30, 30), false); // diagonal
  assert.equal(isHorizontal(20, 60), false); // a scroll
});

test('a long sideways drag is a swipe, in the direction it went', () => {
  assert.equal(swipeAction(120, 10), 'right');
  assert.equal(swipeAction(-120, -10), 'left');
  assert.equal(swipeAction(80, 0), 'right'); // exactly the threshold counts
});

test('short or mostly vertical drags do nothing', () => {
  assert.equal(swipeAction(60, 0), null);
  assert.equal(swipeAction(-79, 0), null);
  assert.equal(swipeAction(100, 90), null);
  assert.equal(swipeAction(0, 0), null);
});

test('the threshold can be changed', () => {
  assert.equal(swipeAction(50, 0, 40), 'right');
  assert.equal(swipeAction(50, 0, 60), null);
});
