/**
 * The home card treats a double lesson as one lesson: the countdown runs to
 * the end of the whole lesson (lib/school.ts joinDoubleLessons).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { joinDoubleLessons, lessonAt, nextLessonAfter } from '../lib/school.ts';

const lesson = (id, subject, startTime, endTime, over = {}) => ({ id, dayOfWeek: 1, subject, startTime, endTime, isBreak: false, ...over });
const span = (l) => l && `${l.subject} ${l.startTime}-${l.endTime}`;

test('back-to-back lessons of the same subject read as one', () => {
  const joined = joinDoubleLessons([
    lesson('b', 'Database', '09:00', '10:00'),
    lesson('a', 'Database', '08:00', '09:00'),
    lesson('c', 'Physics', '10:00', '11:00'),
  ]);
  assert.deepEqual(joined.map(span), ['Database 08:00-10:00', 'Physics 10:00-11:00']);
  // At 08:30 the lesson ends at 10:00, and Physics is next, not Database again.
  assert.equal(span(lessonAt(joined, 1, 8 * 60 + 30)), 'Database 08:00-10:00');
  assert.equal(span(nextLessonAfter(joined, 1, 8 * 60 + 30)), 'Physics 10:00-11:00');
});

test('a short changeover still joins; spelling and spacing of the subject do not matter', () => {
  const joined = joinDoubleLessons([lesson('a', 'Database', '08:00', '09:00'), lesson('b', ' database ', '09:05', '10:00')]);
  assert.deepEqual(joined.map(span), ['Database 08:00-10:00']);
});

test('kept apart: a real gap, a break between, another day, and breaks themselves', () => {
  const joined = joinDoubleLessons([
    lesson('a', 'Maths', '08:00', '09:00'),
    lesson('b', 'Maths', '10:00', '11:00'),
    lesson('c', 'Break', '11:00', '11:20', { isBreak: true }),
    lesson('d', 'Break', '11:20', '11:40', { isBreak: true }),
    lesson('e', 'Maths', '08:00', '09:00', { dayOfWeek: 2 }),
    lesson('f', 'Maths', '09:00', '10:00', { dayOfWeek: 2 }),
  ]);
  assert.deepEqual(joined.map(span), ['Maths 08:00-09:00', 'Maths 10:00-11:00', 'Break 11:00-11:20', 'Break 11:20-11:40', 'Maths 08:00-10:00']);
});

test('the timetable passed in is left as it was', () => {
  const input = [lesson('a', 'Database', '08:00', '09:00'), lesson('b', 'Database', '09:00', '10:00')];
  joinDoubleLessons(input);
  assert.equal(input[0].endTime, '09:00');
});
