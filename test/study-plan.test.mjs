import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../lib/study-plan.ts';

const ctx = {
  subjects: ['Physics', 'Mathematics', 'Database'],
  days: [1, 2, 3],
  start: '18:00',
  end: '22:00',
  busy: [{ dayOfWeek: 2, startTime: '17:00', endTime: '19:00' }],
};

test('valid blocks are kept, tidied and ordered Monday first', () => {
  const { blocks, dropped } = validatePlan([
    { day: 'Wednesday', subject: 'database', start: '19:00', end: '20:00', type: 'revision' },
    { day: 'Monday', subject: 'Physics', start: '18:00', end: '19:30', type: 'HOMEWORK' },
  ], ctx);
  assert.equal(dropped, 0);
  assert.deepEqual(blocks.map((b) => [b.dayOfWeek, b.subject, b.type]), [[1, 'Physics', 'HOMEWORK'], [3, 'Database', 'REVISION']]);
});

test('unknown subjects, wrong days, out-of-window and malformed times are dropped', () => {
  const { blocks, dropped } = validatePlan([
    { day: 'Monday', subject: 'Chemistry', start: '18:00', end: '19:00' },
    { day: 'Friday', subject: 'Physics', start: '18:00', end: '19:00' },
    { day: 'Monday', subject: 'Physics', start: '21:30', end: '22:30' },
    { day: 'Monday', subject: 'Physics', start: '7pm', end: '8pm' },
    { day: 'Monday', subject: 'Physics', start: '20:00', end: '19:00' },
  ], ctx);
  assert.equal(blocks.length, 0);
  assert.equal(dropped, 5);
});

test('blocks that clash with a lesson or each other are dropped', () => {
  const { blocks, dropped } = validatePlan([
    { day: 'Tuesday', subject: 'Physics', start: '18:30', end: '19:30' },
    { day: 'Monday', subject: 'Physics', start: '18:00', end: '19:00' },
    { day: 'Monday', subject: 'Mathematics', start: '18:30', end: '19:30' },
  ], ctx);
  assert.equal(blocks.length, 1);
  assert.equal(dropped, 2);
});

test('garbage input is safe', () => {
  assert.deepEqual(validatePlan(null, ctx), { blocks: [], dropped: 0 });
  assert.deepEqual(validatePlan([null, 3, 'x'], ctx).blocks, []);
});
