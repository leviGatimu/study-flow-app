import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examStatus, examDaysAway, examTimeLabel, validateExamTimes } from '../lib/exam-time.ts';

const exam = { date: '2026-10-28T00:00:00Z', startTime: '09:00', endTime: '11:00' };
const status = (at, value = exam, timezone = 'Africa/Johannesburg') => examStatus(value, timezone, new Date(at));
test('exam changes state exactly at its start and end, without waiting for midnight', () => {
  assert.equal(status('2026-10-28T06:59:59Z'), 'UPCOMING');
  assert.equal(status('2026-10-28T07:00:00Z'), 'IN_PROGRESS');
  assert.equal(status('2026-10-28T08:59:59Z'), 'IN_PROGRESS');
  assert.equal(status('2026-10-28T09:00:00Z'), 'DONE');
  assert.equal(status('2026-10-28T12:00:00Z'), 'DONE');
});
test('times belong to the account timezone, including fractional offsets', () => {
  assert.equal(status('2026-10-28T05:30:00Z', exam, 'Asia/Kolkata'), 'DONE');
  assert.equal(status('2026-10-28T14:59:59Z', exam, 'America/New_York'), 'IN_PROGRESS');
  assert.equal(status('2026-10-28T15:00:00Z', exam, 'America/New_York'), 'DONE');
});
test('overnight exams finish on the following calendar day', () => {
  const overnight = { ...exam, startTime: '23:00', endTime: '01:00' };
  assert.equal(status('2026-10-28T22:30:00Z', overnight), 'IN_PROGRESS');
  assert.equal(status('2026-10-28T23:00:00Z', overnight), 'DONE');
  assert.equal(examTimeLabel(overnight), '23:00–01:00 (+1 day)');
});
test('date-only exams remain upcoming until the end of their local day', () => {
  const untimed = { date: exam.date };
  assert.equal(status('2026-10-28T21:59:59Z', untimed), 'UPCOMING');
  assert.equal(status('2026-10-28T22:00:00Z', untimed), 'DONE');
  assert.equal(examTimeLabel(untimed), 'Time not set');
});
test('legacy partial/malformed times degrade safely', () => {
  assert.equal(status('2026-10-28T09:00:00Z', { ...exam, startTime: null }), 'DONE');
  assert.equal(status('2026-10-28T09:00:00Z', { ...exam, endTime: null }), 'IN_PROGRESS');
  assert.equal(status('2026-10-28T09:00:00Z', { ...exam, startTime: 'bad', endTime: 'bad' }), 'UPCOMING');
});
test('date calculations ignore the server timezone', () => {
  assert.equal(examDaysAway(exam, 'Africa/Johannesburg', new Date('2026-10-27T22:30:00Z')), 0);
  assert.equal(examDaysAway(exam, 'America/New_York', new Date('2026-10-28T01:00:00Z')), 1);
});
test('saving rejects incomplete, malformed, or zero-duration times', () => {
  for (const [start, end] of [['09:00', ''], ['', '11:00'], ['25:00', '11:00'], ['9:00', '11:00'], ['09:60', '11:00'], ['09:00', '09:00']]) assert.ok(validateExamTimes(start, end));
  assert.equal(validateExamTimes(null, null), null);
  assert.equal(validateExamTimes('23:00', '01:00'), null);
});
