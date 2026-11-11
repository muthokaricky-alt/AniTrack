// Tests for lib/listCard.js: text wrapping, caption order and file names for list cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, listText, cardFileName, labels } from './listCard.js';

// a fake canvas context where every character is 10px wide
const ctx = { measureText: (t) => ({ width: t.length * 10 }) };

test('wrapLines wraps on words and keeps within the width', () => {
  assert.deepEqual(wrapLines(ctx, 'one two three four', 80, 3), ['one two', 'three', 'four']);
  assert.deepEqual(wrapLines(ctx, 'short', 200, 2), ['short']);
});

test('wrapLines cuts with an ellipsis when it runs past the line limit', () => {
  const out = wrapLines(ctx, 'alpha beta gamma delta epsilon zeta', 100, 2);
  assert.equal(out.length, 2);
  assert.ok(out[1].endsWith('…'));
  assert.ok(out.every((l) => l.length * 10 <= 100));
});

test('wrapLines cuts a single word that is too wide, and copes with empty input', () => {
  const [line] = wrapLines(ctx, 'Supercalifragilisticexpialidocious', 100, 1);
  assert.ok(line.endsWith('…') && line.length * 10 <= 100);
  assert.deepEqual(wrapLines(ctx, '', 100, 2), []);
  assert.deepEqual(wrapLines(ctx, null, 100, 2), []);
});

test('the text list puts the note first and the show in brackets', () => {
  const text = listText({ title: 'Top 10 anime arcs', items: [
    { title: 'One Piece', note: 'Marineford' }, { title: 'One Piece', note: 'Impel Down' }, { title: 'Cowboy Bebop', note: null }
  ] });
  assert.equal(text, 'Top 10 anime arcs\n\n1. Marineford (One Piece)\n2. Impel Down (One Piece)\n3. Cowboy Bebop\n');
});

test('file names are safe and never empty', () => {
  assert.equal(cardFileName('Top 10 anime arcs!', 'png'), 'anitrack-top-10-anime-arcs.png');
  assert.equal(cardFileName('../../etc/passwd', 'txt'), 'anitrack-etc-passwd.txt');
  assert.equal(cardFileName('???', 'png'), 'anitrack-list.png');
  assert.equal(cardFileName(undefined, 'png'), 'anitrack-list.png');
  assert.ok(cardFileName('x'.repeat(200), 'png').length < 60);
});

test('anime and manga lead with the note, characters lead with the name', () => {
  assert.deepEqual(labels({ kind: 'anime', title: 'One Piece', note: 'Marineford' }), ['Marineford', 'One Piece']);
  assert.deepEqual(labels({ kind: 'anime', title: 'One Piece', note: null }), ['One Piece', '']);
  assert.deepEqual(labels({ kind: 'character', title: 'Lelouch Lamperouge', note: 'Code Geass' }), ['Lelouch Lamperouge', 'Code Geass']);
  assert.deepEqual(labels({ kind: 'character', title: 'Johan Liebert', note: null }), ['Johan Liebert', '']);
});

test('the text list handles characters too', () => {
  const text = listText({ title: 'Top 10 villains', items: [
    { kind: 'character', title: 'Johan Liebert', note: 'Monster' }, { kind: 'character', title: 'Light Yagami', note: null }
  ] });
  assert.equal(text, 'Top 10 villains\n\n1. Johan Liebert (Monster)\n2. Light Yagami\n');
});
