/**
 * Exam categories group one sitting across subjects ("Midterm 1") and average
 * its results.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { categoryNames, inCategory, normaliseCategory, summariseCategories } from '../lib/exam-category.ts';
import { examCategoryPayload } from '../lib/sync/protocol.ts';

const exam = (id, category, subject, score, maxScore, date = '2026-10-10') => ({
  id, title: `${subject} paper`, date: new Date(`${date}T00:00:00Z`), category,
  score, maxScore, subject: subject ? { name: subject } : null,
});

describe('exam categories', () => {
  test('names are trimmed, spaces collapsed, empty becomes none', () => {
    assert.equal(normaliseCategory('  Midterm   1 '), 'Midterm 1');
    assert.equal(normaliseCategory('   '), null);
    assert.equal(normaliseCategory(null), null);
    assert.equal(normaliseCategory('x'.repeat(80)).length, 40);
  });

  test('the average gives every subject the same weight', () => {
    const [mid] = summariseCategories([
      exam('a', 'Midterm 1', 'Physics', 45, 50),   // 90%
      exam('b', 'midterm 1', 'Math', 30, 60),      // 50%
      exam('c', 'Midterm  1', 'Java', null, null), // pending
    ]);
    assert.equal(mid.name, 'Midterm 1');
    assert.equal(mid.exams.length, 3);
    assert.equal(mid.graded, 2);
    assert.equal(mid.average, 70);
    assert.equal(mid.best.subject, 'Physics');
    assert.equal(mid.lowest.subject, 'Math');
  });

  test('a category with no results has no average, and one result no best or lowest', () => {
    const [none] = summariseCategories([exam('a', 'Final', 'Physics', null, null)]);
    assert.equal(none.average, null);
    const [one] = summariseCategories([exam('a', 'Final', 'Physics', 8, 10)]);
    assert.equal(one.average, 80);
    assert.equal(one.best, null);
  });

  test('a zero or missing total is not a result', () => {
    const [c] = summariseCategories([exam('a', 'Quiz', 'Physics', 5, 0), exam('b', 'Quiz', 'Math', 5, null)]);
    assert.equal(c.graded, 0);
  });

  test('uncategorised exams are left out and the newest sitting comes first', () => {
    const groups = summariseCategories([
      exam('a', 'Midterm 1', 'Physics', 1, 2, '2026-03-01'),
      exam('b', null, 'Physics', 1, 2, '2026-12-01'),
      exam('c', 'Midterm 2', 'Physics', 1, 2, '2026-06-01'),
    ]);
    assert.deepEqual(groups.map((g) => g.name), ['Midterm 2', 'Midterm 1']);
  });

  test('suggestions are distinct and in natural order; matching ignores case', () => {
    assert.deepEqual(
      categoryNames([{ category: 'Midterm 10' }, { category: 'midterm 2' }, { category: 'Midterm 2' }, { category: null }]),
      ['midterm 2', 'Midterm 10'],
    );
    assert.equal(inCategory({ category: 'MIDTERM 1' }, ' midterm 1'), true);
    assert.equal(inCategory({ category: null }, 'Midterm 1'), false);
  });

  test('older desktop clients are not sent the column', () => {
    const row = { id: 'e', title: 'x', category: 'Midterm 1' };
    assert.equal('category' in examCategoryPayload('examEvent', row, false), false);
    assert.equal(examCategoryPayload('examEvent', row, true).category, 'Midterm 1');
    assert.equal(examCategoryPayload('task', { id: 't', category: 'keep' }, false).category, 'keep');
  });
});
