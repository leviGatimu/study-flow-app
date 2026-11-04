import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSubject, unifyTimetableSubjects } from '../lib/subject-match.ts';

const known = ['Physics', 'Computer Science', 'Mathematics'];

test('typed variants collapse onto the existing subject', () => {
  assert.equal(canonicalSubject('physics', known), 'Physics');
  assert.equal(canonicalSubject('  computer   science ', known), 'Computer Science');
  assert.equal(canonicalSubject('MATHEMATICS', known), 'Mathematics');
});

test('a genuinely new subject is kept, tidied', () => {
  assert.equal(canonicalSubject('  Kinyarwanda  ', known), 'Kinyarwanda');
  assert.equal(canonicalSubject('Maths', known), 'Maths', 'different words are not guessed at');
});

const lesson = (subject, isBreak = false) => ({ dayOfWeek: 1, startTime: '08:00', endTime: '09:00', subject, isBreak });

test('a subject repeated across the week is one subject', () => {
  const { subjects, lessons } = unifyTimetableSubjects(
    [lesson('Math II'), lesson('math ii'), lesson('MATH II '), lesson('Lunch', true), lesson('Physics')],
    ['Math II', 'Physics'],
    ['Physics']
  );
  assert.deepEqual(subjects, [{ name: 'Math II', isNew: true }, { name: 'Physics', isNew: false }]);
  assert.deepEqual(lessons.map((l) => l.subject), ['Math II', 'Math II', 'Math II', 'Lunch', 'Physics']);
});

test('existing subjects win over the model’s spelling, and missing model lists are tolerated', () => {
  const { subjects, lessons } = unifyTimetableSubjects([lesson('computer science'), lesson('Geography')], null, ['Computer Science']);
  assert.deepEqual(lessons.map((l) => l.subject), ['Computer Science', 'Geography']);
  assert.deepEqual(subjects, [{ name: 'Computer Science', isNew: false }, { name: 'Geography', isNew: true }]);
});

test('Math I and Math II stay separate', () => {
  const { subjects } = unifyTimetableSubjects([lesson('Math I'), lesson('Math II')], ['Math I', 'Math II'], []);
  assert.equal(subjects.length, 2);
});
