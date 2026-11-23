import { test } from 'node:test';
import assert from 'node:assert/strict';

import { categoryFromSlug, categoryHref, categoryLook, NO_CATEGORY_SLUG } from '../lib/exam-category.ts';

test('categoryHref and categoryFromSlug round-trip a name', () => {
  const href = categoryHref('  Midterm   1 ');
  assert.equal(href, '/exams/sitting/Midterm%201');
  assert.deepEqual(categoryFromSlug(href.split('/').pop()), { none: false, name: 'Midterm 1' });
  assert.deepEqual(categoryFromSlug(encodeURIComponent('End / Term & Co')), { none: false, name: 'End / Term & Co' });
});

test('no category has its own slug; junk slugs are rejected', () => {
  assert.equal(categoryHref(null), `/exams/sitting/${NO_CATEGORY_SLUG}`);
  assert.equal(categoryHref('   '), `/exams/sitting/${NO_CATEGORY_SLUG}`);
  assert.deepEqual(categoryFromSlug(NO_CATEGORY_SLUG), { none: true });
  assert.equal(categoryFromSlug('%E0%A4%A'), null);
  assert.equal(categoryFromSlug('%20%20'), null);
});

test('categoryLook reads the kind of sitting from its name', () => {
  assert.equal(categoryLook('Midterm 1'), 'midterm');
  assert.equal(categoryLook('Mid-term exams'), 'midterm');
  assert.equal(categoryLook('End Of Term Exam'), 'final');
  assert.equal(categoryLook('Finals'), 'final');
  assert.equal(categoryLook('Midterm mock'), 'mock');
  assert.equal(categoryLook('CAT 2'), 'quiz');
  assert.equal(categoryLook('Weekly quizzes'), 'quiz');
  assert.equal(categoryLook('Group project'), 'coursework');
  assert.equal(categoryLook('National exams'), 'national');
  assert.equal(categoryLook('Something else'), 'other');
  assert.equal(categoryLook(null), 'other');
});
