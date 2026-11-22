/**
 * Subject icons and colours come from the name alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUBJECT_TONES, subjectLook } from '../lib/subject-look.ts';

const cases = {
  Networking: 'network',
  Javascript: 'code',
  'Embedded system': 'chip',
  PHP: 'code',
  Entrepreneurship: 'business',
  English: 'english',
  Physics: 'physics',
  Database: 'database',
  'C programming': 'code',
  C: 'code',
  Math: 'math',
  'Applied Mathematics II': 'math',
  'Web UI': 'web',
  'Math (revision)': 'math',
  'Physics (Revision)': 'physics',
  Chemistry: 'chemistry',
  Kinyarwanda: 'language',
  History: 'history',
  'Religious Education': 'religion',
  Economics: 'economics',
  'Something new': 'book',
  Reports: 'report',
};

for (const [name, icon] of Object.entries(cases)) {
  test(`${name} -> ${icon}`, () => assert.equal(subjectLook(name).icon, icon));
}

test('revision blocks share their subject colour', () => {
  assert.deepEqual(subjectLook('Physics (revision)'), subjectLook('Physics'));
});

test('unknown subjects still get a stable colour', () => {
  const a = subjectLook('Underwater basket weaving');
  assert.equal(a.icon, 'book');
  assert.ok(SUBJECT_TONES.includes(a.tone));
  assert.deepEqual(subjectLook('Underwater basket weaving'), a);
});

test('words inside other words do not match ("c" in "music", "it" in "literature")', () => {
  assert.equal(subjectLook('Music').icon, 'music');
  assert.equal(subjectLook('Literature').icon, 'literature');
});
