/**
 * Model output is untrusted input.
 *
 * These validators sit between the model and the database. Before them,
 * uploadReportCard mapped raw model output straight into subjectGrade
 * .createMany with no check that the fields were even strings, so a
 * hallucinated or truncated response became a permanent academic record.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseJsonLoose,
  asString,
  asNumber,
  sanitizeGrades,
  sanitizeQuestions,
} from '../lib/ai-parse.ts';

describe('parseJsonLoose', () => {
  test('plain JSON', () => {
    assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  });

  test('fenced JSON, with and without the language tag', () => {
    assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(parseJsonLoose('```\n{"a":1}\n```'), { a: 1 });
  });

  test('JSON buried in prose - the case the old parsers could not handle', () => {
    const reply = 'Sure! Here is the report card you asked for:\n{"overallAverage": 85}\nHope that helps!';
    assert.deepEqual(parseJsonLoose(reply), { overallAverage: 85 });
  });

  test('a bare array, which the flashcard prompt actually asks for', () => {
    assert.deepEqual(parseJsonLoose('[{"front":"a","back":"b"}]'), [{ front: 'a', back: 'b' }]);
    assert.deepEqual(parseJsonLoose('```json\n[1,2,3]\n```'), [1, 2, 3]);
  });

  test('returns null rather than throwing', () => {
    // Truncated output is the realistic failure: the model hit a token limit.
    assert.equal(parseJsonLoose('{"grades": [{"subject": "Phys'), null);
    assert.equal(parseJsonLoose('I cannot read that document.'), null);
    assert.equal(parseJsonLoose(''), null);
  });
});

describe('asString / asNumber', () => {
  test('asString trims, rejects empties and non-strings', () => {
    assert.equal(asString('  hello  '), 'hello');
    assert.equal(asString('   '), null);
    assert.equal(asString(42), null);
    assert.equal(asString(null), null);
    assert.equal(asString(undefined), null);
    assert.equal(asString('abcdef', 3), 'abc');
  });

  test('asNumber accepts numeric strings, which models return constantly', () => {
    assert.equal(asNumber(85), 85);
    assert.equal(asNumber('85.5'), 85.5);
    assert.equal(asNumber(' 90 '), 90);
    assert.equal(asNumber('A'), null);
    assert.equal(asNumber(NaN), null);
    assert.equal(asNumber(Infinity), null);
  });

  test('asNumber enforces bounds', () => {
    assert.equal(asNumber(150, 0, 100), null, 'an average above 100 is nonsense');
    assert.equal(asNumber(-5, 0, 100), null);
    assert.equal(asNumber(0, 0, 100), 0);
    assert.equal(asNumber(100, 0, 100), 100);
  });
});

describe('sanitizeGrades', () => {
  test('keeps good rows and counts the ones it drops', () => {
    const { grades, dropped } = sanitizeGrades([
      { subject: 'Physics', grade: 'A', status: 'Excellent', aiFeedback: 'Keep going' },
      { subject: 'Math', grade: 78 },                    // numeric grade is fine
      { grade: 'B' },                                     // no subject - drop
      { subject: 'English' },                             // no grade - drop
      null,                                               // drop
      'not an object',                                    // drop
    ]);

    assert.equal(grades.length, 2);
    assert.equal(dropped, 4);
    assert.deepEqual(grades[0], {
      subject: 'Physics', grade: 'A', status: 'Excellent', aiFeedback: 'Keep going',
    });
    assert.equal(grades[1].grade, '78', 'numeric grades are normalised to strings');
  });

  test('aiFeedback is NOT NULL in the schema, so it is always a string', () => {
    const { grades } = sanitizeGrades([{ subject: 'Physics', grade: 'A' }]);
    assert.equal(grades[0].aiFeedback, '');
    assert.equal(grades[0].status, 'Recorded', 'status gets a sane default too');
  });

  test('non-arrays do not throw', () => {
    assert.deepEqual(sanitizeGrades(null), { grades: [], dropped: 0 });
    assert.deepEqual(sanitizeGrades('oops'), { grades: [], dropped: 0 });
    assert.deepEqual(sanitizeGrades(undefined), { grades: [], dropped: 0 });
  });
});

describe('sanitizeQuestions', () => {
  test('drops a multiple-choice question with no options', () => {
    // The specific bug: TutorHub renders `(q.options || [])`, so this used to
    // show a multiple-choice question with nothing to pick.
    const { questions, dropped } = sanitizeQuestions([
      { question: 'Pick one', type: 'MULTIPLE_CHOICE' },
      { question: 'Pick one', type: 'MULTIPLE_CHOICE', options: ['only one'] },
      { question: 'Pick one', type: 'MULTIPLE_CHOICE', options: ['a', 'b'], answer: 'a' },
    ]);
    assert.equal(questions.length, 1);
    assert.equal(dropped, 2);
  });

  test('normalises the type and falls back to SHORT_ANSWER', () => {
    const { questions } = sanitizeQuestions([
      { question: 'Explain', type: 'short answer' },
      { question: 'Explain', type: 'nonsense-type' },
      { question: 'Explain' },
    ]);
    assert.deepEqual(questions.map((q) => q.type), ['SHORT_ANSWER', 'SHORT_ANSWER', 'SHORT_ANSWER']);
  });

  test('accepts either a bare array or a {questions:[...]} wrapper', () => {
    const wrapped = sanitizeQuestions({ questions: [{ question: 'A' }] });
    const bare = sanitizeQuestions([{ question: 'A' }]);
    assert.equal(wrapped.questions.length, 1);
    assert.equal(bare.questions.length, 1);
  });

  test('a question with no text is dropped', () => {
    const { questions, dropped } = sanitizeQuestions([{ type: 'SHORT_ANSWER', answer: 'x' }]);
    assert.equal(questions.length, 0);
    assert.equal(dropped, 1);
  });
});
