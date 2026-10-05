/**
 * Objective marking - audit findings S01 and S09.
 *
 * S01: substring matching gave full marks for "a" against "database" and for
 *      "not mitochondrion" against "mitochondrion".
 * S09: answers were joined with human-readable delimiters, so the options
 *      "1,000" and "2,000" split into the same fragments as "1", "000", "2".
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { markObjective, encodeAnswer, decodeSelection, decodeOrder, decodePairs, previewVerdict } from '../lib/marking.ts';

const blank = (answer) => ({ type: 'FILL_IN_THE_BLANK', question: '', options: [], items: [], answer, explanation: '' });

describe('fill in the blank (S01)', () => {
  test('a fragment of the answer is not the answer', () => {
    assert.deepEqual(markObjective(blank('database'), 'a'), { score: 0, status: 'UNCERTAIN' });
    assert.deepEqual(markObjective(blank('database'), 'data'), { score: 0, status: 'UNCERTAIN' });
  });

  test('a negated answer is not the answer', () => {
    assert.equal(markObjective(blank('mitochondrion'), 'not mitochondrion').score, 0);
  });

  test('exact answers, case, punctuation and a leading article are accepted', () => {
    assert.deepEqual(markObjective(blank('Mitochondrion'), 'the mitochondrion.'), { score: 100, status: 'MARKED' });
    assert.equal(markObjective(blank('the CPU'), 'cpu').score, 100);
  });

  test('a miss is uncertain, not wrong - synonyms go to the written marker', () => {
    assert.equal(markObjective(blank('mitochondrion'), 'mitochondria').status, 'UNCERTAIN');
  });

  test('blank stays unanswered', () => {
    assert.deepEqual(markObjective(blank('database'), '   '), { score: 0, status: 'MARKED' });
  });
});

const multi = { type: 'MULTIPLE_SELECT', question: '', options: ['1,000', '2,000', '1', '000'], items: [], answer: '1,000, 2,000', explanation: '' };

describe('multiple select (S09)', () => {
  test('legacy expected answers are read against the real options', () => {
    assert.deepEqual(decodeSelection(multi, multi.answer), ['1,000', '2,000']);
  });

  test('picking the fragment options is wrong', () => {
    assert.equal(markObjective(multi, encodeAnswer(['1', '000', '2,000'])).score, 0);
    assert.equal(markObjective(multi, '1, 000, 2').score, 0);
  });

  test('picking exactly the right options is right, in any order', () => {
    assert.equal(markObjective(multi, encodeAnswer(['2,000', '1,000'])).score, 100);
  });

  test('a structured expected answer is honoured', () => {
    const item = { ...multi, answer: JSON.stringify(['1', '000']) };
    assert.equal(markObjective(item, encodeAnswer(['000', '1'])).score, 100);
  });
});

describe('ordering and matching (S09)', () => {
  const order = { type: 'ORDERING', question: '', options: [], items: ['Plan | draft', 'Write', 'Review'], answer: 'Plan | draft | Write | Review', explanation: '' };

  test('a pipe inside an item does not break the order', () => {
    assert.deepEqual(decodeOrder(order, order.answer), ['Plan | draft', 'Write', 'Review']);
    assert.equal(markObjective(order, encodeAnswer(['Plan | draft', 'Write', 'Review'])).score, 100);
    assert.equal(markObjective(order, encodeAnswer(['Write', 'Plan | draft', 'Review'])).score, 33);
  });

  test('an order the student never set is unanswered (S10)', () => {
    assert.deepEqual(markObjective(order, ''), { score: 0, status: 'MARKED' });
  });

  const match = {
    type: 'MATCHING', question: '', items: ['Ratio: a:b', 'Rate'], options: ['Compares parts; e.g. 2:3', 'Per unit of time'],
    answer: 'Ratio: a:b: Compares parts; e.g. 2:3; Rate: Per unit of time', explanation: '',
  };

  test('colons and semicolons inside terms survive', () => {
    assert.deepEqual(decodePairs(match, match.answer), { 'Ratio: a:b': 'Compares parts; e.g. 2:3', Rate: 'Per unit of time' });
    assert.equal(markObjective(match, encodeAnswer({ 'Ratio: a:b': 'Compares parts; e.g. 2:3', Rate: 'Per unit of time' })).score, 100);
    assert.equal(markObjective(match, encodeAnswer({ 'Ratio: a:b': 'Per unit of time' })).score, 0);
  });
});

describe('previewVerdict agrees with the marker', () => {
  test('never claims right where the server would not', () => {
    assert.equal(previewVerdict(blank('database'), 'a'), null);
    assert.equal(previewVerdict(blank('database'), 'Database'), true);
    assert.equal(previewVerdict(multi, encodeAnswer(['1', '000'])), false);
  });

  test('single choice is exact', () => {
    const mc = { type: 'MULTIPLE_CHOICE', question: '', options: ['A', 'B'], items: [], answer: 'B', explanation: '' };
    assert.equal(previewVerdict(mc, 'b'), true);
    assert.equal(previewVerdict(mc, 'A'), false);
  });
});

import { summariseAttempt, applyWrittenMarks, formatAnswer } from '../lib/marking.ts';

describe('unmarked written answers are not zero (S02)', () => {
  const objectiveRight = () => ({ id: 'q1', score: 100, isCorrect: true, feedback: '', status: 'MARKED' });
  const writtenWaiting = () => ({ id: 'q2', score: 0, isCorrect: false, feedback: '', status: 'UNMARKED' });

  test('the audit case: one right objective + one unmarked written was saved as 50%', () => {
    const s = summariseAttempt([objectiveRight(), writtenWaiting()]);
    assert.equal(s.score, 100);
    assert.equal(s.status, 'PARTIAL');
    assert.equal(s.unmarked, 1);
  });

  test('an all-written attempt with no marker is pending, not 0% final', () => {
    const s = summariseAttempt([writtenWaiting(), { ...writtenWaiting(), id: 'q3' }]);
    assert.equal(s.status, 'PENDING');
  });

  test('a marker reply with no numeric score leaves the answer unmarked', () => {
    const pending = [writtenWaiting(), { ...writtenWaiting(), id: 'q3' }];
    applyWrittenMarks(pending, [{ id: 'q2', score: 'n/a' }, { id: 'q3' }, { id: 'zzz', score: 90 }]);
    assert.deepEqual(pending.map((p) => p.status), ['UNMARKED', 'UNMARKED']);
  });

  test('a real mark finalises, clamps and keeps feedback', () => {
    const pending = [writtenWaiting()];
    applyWrittenMarks(pending, [{ id: 'q2', score: 140, feedback: 'Good.' }]);
    assert.equal(pending[0].status, 'MARKED');
    assert.equal(pending[0].score, 100);
    assert.equal(summariseAttempt([objectiveRight(), ...pending]).status, 'FINAL');
  });

  test('older attempts without a status count as marked', () => {
    assert.equal(summariseAttempt([{ id: 'x', score: 40, isCorrect: false, feedback: '' }]).status, 'FINAL');
  });
});

test('structured answers read naturally in results', () => {
  assert.equal(formatAnswer(JSON.stringify(['1,000', '2,000'])), '1,000, 2,000');
  assert.equal(formatAnswer(JSON.stringify({ Rate: 'Per unit of time' })), 'Rate → Per unit of time');
  assert.equal(formatAnswer('plain text'), 'plain text');
});
