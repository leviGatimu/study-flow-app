/**
 * After a mock exam, the results point at the next routine block for that
 * subject - so a knowledge gap gets a time to be fixed, not just a score.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { nextRoutineSlot, sameSubject } from '../lib/routine.ts';

// 2026-10-05 is a Monday.
const MONDAY = '2026-10-05';
const ROUTINE = [
  { dayOfWeek: 1, subject: 'Networking', startTime: '20:00', endTime: '20:30', type: 'HOMEWORK' },
  { dayOfWeek: 3, subject: 'Physics', startTime: '19:00', endTime: '21:30', type: 'HOMEWORK' },
  { dayOfWeek: 5, subject: 'Physics (Revision)', startTime: '22:30', endTime: '00:00', type: 'REVISION' },
];

describe('nextRoutineSlot', () => {
  test('later today, when the block has not started', () => {
    const slot = nextRoutineSlot(ROUTINE, 'Networking', MONDAY, 18 * 60);
    assert.equal(slot.date, MONDAY);
    assert.equal(slot.daysAway, 0);
  });

  test('a block that already started today rolls to next week', () => {
    const slot = nextRoutineSlot(ROUTINE, 'Networking', MONDAY, 20 * 60 + 10);
    assert.equal(slot.date, '2026-10-12');
    assert.equal(slot.daysAway, 7);
  });

  test('revision blocks count for the same subject', () => {
    const slot = nextRoutineSlot(ROUTINE, 'physics', MONDAY, 0);
    assert.equal(slot.date, '2026-10-07');
    assert.equal(slot.startTime, '19:00');
  });

  test('holidays are skipped', () => {
    const slot = nextRoutineSlot(ROUTINE, 'Physics', MONDAY, 0, (d) => d === '2026-10-07');
    assert.equal(slot.date, '2026-10-09');
    assert.equal(slot.type, 'REVISION');
  });

  test('a subject with no routine block gives nothing', () => {
    assert.equal(nextRoutineSlot(ROUTINE, 'Chemistry', MONDAY, 0), null);
  });
});

test('sameSubject ignores case and the revision suffix, never matches blank', () => {
  assert.ok(sameSubject('Math (revision)', 'math'));
  assert.ok(!sameSubject('', ''));
  assert.ok(!sameSubject('C programming', 'C'));
});
