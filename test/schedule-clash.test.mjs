import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clashMessage, clashesWithin, decideSlot, findClashes, firstFreeSlot, nextFreeSlot, storedDayKey } from '../lib/schedule-clash.ts';

const block = (id, startTime, endTime, subject = id) => ({ id, subject, startTime, endTime });
const slot = (startTime, endTime) => ({ startTime, endTime });

describe('finding clashes', () => {
  const day = { today: [block('Math', '19:00', '20:00')] };

  test('a block starting inside another clashes', () => {
    assert.deepEqual(findClashes(slot('19:30', '20:30'), day).map((b) => b.id), ['Math']);
  });

  test('back-to-back blocks do not clash', () => {
    assert.equal(findClashes(slot('20:00', '21:00'), day).length, 0);
    assert.equal(findClashes(slot('18:00', '19:00'), day).length, 0);
  });

  test('a block wrapped around another clashes', () => {
    assert.equal(findClashes(slot('18:00', '21:00'), day).length, 1);
  });

  test('a block ending at midnight is not a block ending at 00:00 that morning', () => {
    const late = { today: [block('Physics', '22:30', '00:00')] };
    assert.equal(findClashes(slot('23:00', '23:30'), late).length, 1);
    assert.equal(findClashes(slot('08:00', '09:00'), late).length, 0);
  });

  test('last night running past midnight takes the start of today', () => {
    const spill = { today: [], yesterday: [block('Late', '23:00', '01:00')] };
    assert.equal(findClashes(slot('00:30', '02:00'), spill).length, 1);
    assert.equal(findClashes(slot('01:00', '02:00'), spill).length, 0);
  });

  test('a block running past midnight meets tomorrow morning', () => {
    const next = { today: [], tomorrow: [block('Early', '00:30', '01:30')] };
    assert.equal(findClashes(slot('23:00', '01:00'), next).length, 1);
    assert.equal(findClashes(slot('22:00', '23:30'), next).length, 0);
  });
});

describe('finding a free time', () => {
  const day = { today: [block('Math', '19:00', '20:00'), block('Java', '20:00', '21:00')] };

  test('skips over every block in the way and keeps the length', () => {
    assert.deepEqual(nextFreeSlot(slot('19:30', '20:00'), day), slot('21:00', '21:30'));
  });

  test('uses a gap that fits and steps over one that does not', () => {
    const gaps = { today: [block('A', '18:00', '18:30'), block('B', '18:45', '19:00')] };
    assert.deepEqual(firstFreeSlot(30, 18 * 60, gaps), slot('19:00', '19:30'));
    assert.deepEqual(firstFreeSlot(15, 18 * 60, gaps), slot('18:30', '18:45'));
  });

  test('can finish exactly at midnight, shown as 00:00', () => {
    assert.deepEqual(firstFreeSlot(60, 23 * 60, { today: [] }), slot('23:00', '00:00'));
  });

  test('gives up rather than running into the next day', () => {
    const full = { today: [block('Late', '22:00', '00:00')] };
    assert.equal(nextFreeSlot(slot('22:30', '23:30'), full), null);
  });
});

describe('deciding what happens', () => {
  const day = { today: [block('Math', '19:00', '20:00')] };
  const physics = slot('19:30', '20:30');

  test('a free time saves as asked', () => {
    assert.deepEqual(decideSlot(slot('21:00', '22:00'), day), { slot: slot('21:00', '22:00'), clear: [] });
  });

  test('a clash saves nothing until the student has chosen', () => {
    const result = decideSlot(physics, day);
    assert.deepEqual(result, {
      clash: {
        blocks: [{ subject: 'Math', startTime: '19:00', endTime: '20:00' }],
        suggestion: slot('20:00', '21:00'),
      },
    });
  });

  test('choosing the next free time moves the new block and leaves the old one', () => {
    assert.deepEqual(decideSlot(physics, day, 'next-free'), { slot: slot('20:00', '21:00'), clear: [] });
  });

  test('choosing replace keeps the asked time and clears what was there', () => {
    const result = decideSlot(physics, day, 'replace');
    assert.deepEqual(result.slot, physics);
    assert.deepEqual(result.clear.map((b) => b.id), ['Math']);
  });

  test('no free time left is an error, never a stacked block', () => {
    const full = { today: [block('Late', '22:00', '00:00')] };
    assert.ok('error' in decideSlot(slot('22:30', '23:30'), full, 'next-free'));
  });

  test('a choice with no clash changes nothing', () => {
    const free = slot('21:00', '22:00');
    assert.deepEqual(decideSlot(free, day, 'replace'), { slot: free, clear: [] });
  });
});

test('a stored date means the same day however it was stored', () => {
  const utcMidnight = new Date('2026-11-07T00:00:00Z');
  // Kigali, UTC+2: the desktop stores midnight as 22:00 UTC the day before.
  assert.equal(storedDayKey(utcMidnight, 120), '2026-11-07');
  assert.equal(storedDayKey(new Date('2026-11-06T22:00:00Z'), 120), '2026-11-07');
  // New York, UTC-5: midnight there is 05:00 UTC the same day.
  assert.equal(storedDayKey(utcMidnight, -300), '2026-11-07');
  assert.equal(storedDayKey(new Date('2026-11-07T05:00:00Z'), -300), '2026-11-07');
});

test('the short message names the block and the next free time', () => {
  const message = clashMessage({ blocks: [{ subject: 'Math', startTime: '19:00', endTime: '20:00' }], suggestion: slot('20:00', '21:00') });
  assert.equal(message, 'Math (19:00–20:00) is already at that time. The next free time is 20:00–21:00.');
});

test('existing overlaps are found both ways round, and only those', () => {
  const found = clashesWithin([block('a', '20:00', '20:30'), block('b', '20:00', '20:30'), block('c', '20:30', '21:30')]);
  assert.deepEqual(found.get('a').map((b) => b.id), ['b']);
  assert.deepEqual(found.get('b').map((b) => b.id), ['a']);
  assert.equal(found.has('c'), false);
});
