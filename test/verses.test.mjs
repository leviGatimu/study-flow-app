import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FALLBACK_VERSES, VERSE_REFS, fallbackVerseForHour, isVerseRef, tidyVerseText, verseRefForHour } from '../lib/verses.ts';

test('a long list of verses, each once, in the form bible-api.com reads', () => {
  assert.ok(VERSE_REFS.length >= 150, `only ${VERSE_REFS.length} verses`);
  assert.equal(new Set(VERSE_REFS).size, VERSE_REFS.length, 'a verse is listed twice');
  for (const ref of VERSE_REFS) assert.match(ref, /^([123] )?[A-Z][a-z]+ \d+:\d+(-\d+)?$/, ref);
});

test('every hour has a verse from the list, and the next hour a different one', () => {
  for (const hour of [0, 1, 493_000, 493_001, -5]) assert.ok(isVerseRef(verseRefForHour(hour)));
  assert.notEqual(verseRefForHour(493_000), verseRefForHour(493_001));
  assert.ok(FALLBACK_VERSES.includes(fallbackVerseForHour(493_000)));
});

test('only listed references are accepted, so the server fetches nothing else', () => {
  assert.equal(isVerseRef('John 3:16'), true);
  assert.equal(isVerseRef('../../etc/passwd'), false);
  assert.equal(isVerseRef('john 3:16'), false);
});

test('poetry line breaks become one paragraph', () => {
  assert.equal(tidyVerseText('Trust in the LORD with all your heart,\nand don’t lean  on it.\n'), 'Trust in the LORD with all your heart, and don’t lean on it.');
});
