/**
 * When a block ends, for the missed-task sweep.
 *
 * Reported symptom: "I set a revision from Monday 10pm to 1am the next day and
 * immediately it counts it as not done." The sweep pinned the end time "01:00"
 * to the block's own date, so the block "ended" at 01:00 Monday - before it
 * started - and was marked missed on the next page load.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { taskEndsAt } from '../lib/task-times.ts';

const MONDAY = new Date('2026-09-28T00:00:00');

describe('taskEndsAt', () => {
  test('a block within one day ends that day', () => {
    assert.deepEqual(taskEndsAt(MONDAY, '20:00', '21:30'), new Date('2026-09-28T21:30:00'));
  });

  test('a block past midnight ends the next morning', () => {
    assert.deepEqual(taskEndsAt(MONDAY, '22:00', '01:00'), new Date('2026-09-29T01:00:00'));
  });

  test('a block ending exactly at midnight ends at the start of the next day', () => {
    assert.deepEqual(taskEndsAt(MONDAY, '22:30', '00:00'), new Date('2026-09-29T00:00:00'));
  });

  test('Monday 22:00 - 01:00 is not over at 23:00 Monday, and is over at 01:01 Tuesday', () => {
    const end = taskEndsAt(MONDAY, '22:00', '01:00');
    assert.equal(new Date('2026-09-28T23:00:00') > end, false);
    assert.equal(new Date('2026-09-29T00:30:00') > end, false);
    assert.equal(new Date('2026-09-29T01:01:00') > end, true);
  });

  test('the month boundary rolls over', () => {
    assert.deepEqual(
      taskEndsAt(new Date('2026-09-30T00:00:00'), '23:00', '02:00'),
      new Date('2026-10-01T02:00:00')
    );
  });
});
