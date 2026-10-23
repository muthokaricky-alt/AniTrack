import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_MAX, MAX_PER_HOUR, MAX_PER_RECIPIENT_PER_DAY, parseKind, cleanNote, limitMessage } from '../src/recommend.js';

test('only anime and manga can be recommended', () => {
  assert.equal(parseKind('anime'), 'anime');
  assert.equal(parseKind('manga'), 'manga');
  for (const bad of ['character', 'ANIME', '', null, undefined, 5, ['anime']]) assert.equal(parseKind(bad), null);
});

test('a note is plain text: trimmed, spaces collapsed, line breaks and control characters flattened', () => {
  assert.equal(cleanNote('  watch   this\n\nbefore\tthe finale  '), 'watch this before the finale');
  assert.equal(cleanNote('a\u0000b\u001fc\u007fd'), 'a b c d');
  assert.equal(cleanNote('<b>hi</b> & "quotes"'), '<b>hi</b> & "quotes"'); // kept as text; React escapes it when shown
});

test('no note means null, whatever was sent', () => {
  for (const empty of [undefined, null, '', '   ', '\n\t', false, 0, 42, {}, ['a']]) assert.equal(cleanNote(empty), null);
});

test('a note is cut to 140 characters, counted as whole characters', () => {
  assert.equal(NOTE_MAX, 140);
  assert.equal(cleanNote('x'.repeat(500)).length, 140);
  const emoji = cleanNote('😀'.repeat(200));
  assert.equal(Array.from(emoji).length, 140); // never a half emoji
  assert.ok(!emoji.includes('\ufffd'));
  assert.equal(cleanNote('abcdef', 3), 'abc');
});

test('sending limits: per hour and per friend per day', () => {
  assert.equal(limitMessage({ lastHour: 0, toRecipientToday: 0 }), null);
  assert.equal(limitMessage({ lastHour: MAX_PER_HOUR - 1, toRecipientToday: MAX_PER_RECIPIENT_PER_DAY - 1 }), null);
  assert.match(limitMessage({ lastHour: MAX_PER_HOUR, toRecipientToday: 0 }), /hour/);
  assert.match(limitMessage({ lastHour: 0, toRecipientToday: MAX_PER_RECIPIENT_PER_DAY }), /today/);
  assert.match(limitMessage({ lastHour: 99, toRecipientToday: 99 }), /hour/); // the hourly limit is reported first
});
