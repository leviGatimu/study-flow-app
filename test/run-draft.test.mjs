/**
 * Saved practice runs (audit S05/S03): a draft keeps only what belongs to its
 * set, and the exam allowance is computed in one place.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { cleanSnapshot, readDraft, examMinutes, answeredCount } from '../lib/run-draft.ts';

const IDS = ['q1', 'q2', 'q3'];

describe('cleanSnapshot', () => {
  test('keeps answers and flags for this set only', () => {
    const s = cleanSnapshot(
      { answers: { q1: 'A', q9: 'stray', q2: '   ', q3: 42 }, flags: ['q2', 'q2', 'q8'], position: 1 },
      IDS
    );
    assert.deepEqual(s, { answers: { q1: 'A' }, flags: ['q2'], position: 1 });
  });

  test('a position outside the set is clamped', () => {
    assert.equal(cleanSnapshot({ position: 99 }, IDS).position, 2);
    assert.equal(cleanSnapshot({ position: -4 }, IDS).position, 0);
    assert.equal(cleanSnapshot({ position: 1.5 }, IDS).position, 0);
  });

  test('garbage is an empty run, not a crash', () => {
    for (const bad of [null, 'x', 5, [], { answers: [] }]) {
      assert.deepEqual(cleanSnapshot(bad, IDS), { answers: {}, flags: [], position: 0 });
    }
  });

  test('answers are capped', () => {
    assert.equal(cleanSnapshot({ answers: { q1: 'x'.repeat(9000) } }, IDS).answers.q1.length, 8000);
  });
});

test('readDraft survives corrupt stored JSON and keeps the deadline', () => {
  const deadline = new Date('2026-10-05T18:00:00Z');
  const d = readDraft({ answers: '{bad', flags: '["q3"]', position: 2, deadlineAt: deadline }, IDS);
  assert.deepEqual(d, { answers: {}, flags: ['q3'], position: 2, deadlineAt: deadline.toISOString() });
  assert.equal(answeredCount(d), 0);
});

test('exam allowance: two minutes a question, at least five', () => {
  assert.equal(examMinutes(1), 5);
  assert.equal(examMinutes(10), 20);
});
