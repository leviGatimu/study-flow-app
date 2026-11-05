/**
 * The Study chat turns "[[PRACTICE {...}]]" in a reply into a practice set and
 * saves "[[practice:<id>]]" instead. These are the pure parts of that.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePracticeRequest,
  practiceReference,
  practiceRefsForModel,
  splitPracticeRefs,
} from '../lib/practice-request.ts';

const SUBJECTS = ['Applied Physics II', 'Java', 'Advanced Database'];

describe('practice requests in a reply', () => {
  test('a reply without a request is left alone', () => {
    assert.deepEqual(parsePracticeRequest('Photosynthesis turns light into sugar.', SUBJECTS), { kind: 'none' });
  });

  test('a full request is read, and the text before it kept', () => {
    const reply = 'Making a 12-question set on loops.\n[[PRACTICE {"subject":"java","topic":"for and while loops","count":12,"style":"MULTIPLE_CHOICE"}]]';
    assert.deepEqual(parsePracticeRequest(reply, SUBJECTS), {
      kind: 'request',
      before: 'Making a 12-question set on loops.',
      subject: 'Java',
      topic: 'for and while loops',
      count: 12,
      style: 'MULTIPLE_CHOICE',
    });
  });

  test('the subject matches the student\'s own name loosely', () => {
    const r = parsePracticeRequest('[[PRACTICE {"subject":"Physics","topic":"Ohm\'s law"}]]', SUBJECTS);
    assert.equal(r.kind, 'request');
    assert.equal(r.subject, 'Applied Physics II');
  });

  test('an unknown subject is kept as given; none at all falls back to the topic', () => {
    assert.equal(parsePracticeRequest('[[PRACTICE {"subject":"Biology","topic":"cells"}]]', SUBJECTS).subject, 'Biology');
    assert.equal(parsePracticeRequest('[[PRACTICE {"topic":"World War I"}]]', SUBJECTS).subject, 'World War I');
  });

  test('count is clamped to 5-20 and defaults to 10; unknown styles become MIXED', () => {
    const big = parsePracticeRequest('[[PRACTICE {"topic":"x","count":500,"style":"ESSAY"}]]', SUBJECTS);
    assert.equal(big.count, 20);
    assert.equal(big.style, 'MIXED');
    assert.equal(parsePracticeRequest('[[PRACTICE {"topic":"x","count":1}]]', SUBJECTS).count, 5);
    assert.equal(parsePracticeRequest('[[PRACTICE {"topic":"x"}]]', SUBJECTS).count, 10);
  });

  test('broken JSON or a missing topic is reported, not thrown', () => {
    const broken = parsePracticeRequest('Sure.\n[[PRACTICE {"topic": oops}]]', SUBJECTS);
    assert.equal(broken.kind, 'invalid');
    assert.equal(broken.before, 'Sure.');
    assert.equal(parsePracticeRequest('[[PRACTICE {"subject":"Java"}]]', SUBJECTS).kind, 'invalid');
  });
});

describe('saved practice references', () => {
  test('references are lifted out of the text', () => {
    const saved = `Here you go.\n\n${practiceReference('cmset123')}`;
    assert.deepEqual(splitPracticeRefs(saved), { text: 'Here you go.', practiceIds: ['cmset123'] });
  });

  test('text without references is unchanged', () => {
    assert.deepEqual(splitPracticeRefs('Plain answer'), { text: 'Plain answer', practiceIds: [] });
  });

  test('the model sees plain words instead of the id', () => {
    assert.equal(practiceRefsForModel(`Done.\n${practiceReference('abc')}`), 'Done.\n(A practice set was made.)');
  });

  test('only safe ids are recognised', () => {
    assert.deepEqual(splitPracticeRefs('[[practice:../../etc]]').practiceIds, []);
  });
});
