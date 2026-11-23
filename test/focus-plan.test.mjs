import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockLength, blockTiming, formatMinutes, toMinutes } from '../lib/focus-plan.ts';

test('toMinutes reads HH:MM and rejects junk', () => {
  assert.equal(toMinutes('21:30'), 1290);
  assert.equal(toMinutes('0:05'), 5);
  assert.equal(toMinutes('25:00'), null);
  assert.equal(toMinutes('21:61'), null);
  assert.equal(toMinutes('later'), null);
});

test('blockLength wraps past midnight', () => {
  assert.equal(blockLength('21:00', '22:00'), 60);
  assert.equal(blockLength('23:00', '00:00'), 60);
  assert.equal(blockLength('22:30', '00:15'), 105);
  assert.equal(blockLength('x', '22:00'), 0);
});

test('blockTiming places a block against the clock', () => {
  assert.deepEqual(blockTiming('21:00', '22:00', 21 * 60 + 15), { state: 'now', minutesLeft: 45 });
  assert.deepEqual(blockTiming('21:00', '22:00', 20 * 60 + 35), { state: 'soon', minutesUntil: 25 });
  assert.deepEqual(blockTiming('21:00', '22:00', 18 * 60), { state: 'later', minutesUntil: 180 });
  assert.deepEqual(blockTiming('21:00', '22:00', 22 * 60 + 10), { state: 'past', minutesSinceEnd: 10 });
  // Edges: the start minute is "now", the end minute is over.
  assert.equal(blockTiming('21:00', '22:00', 21 * 60).state, 'now');
  assert.equal(blockTiming('21:00', '22:00', 22 * 60).state, 'past');
  // A block that ends at midnight is still running at 23:59.
  assert.deepEqual(blockTiming('23:00', '00:00', 23 * 60 + 59), { state: 'now', minutesLeft: 1 });
  assert.equal(blockTiming('??', '22:00', 600), null);
});

test('formatMinutes', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(80), '1 h 20 min');
  assert.equal(formatMinutes(-3), '0 min');
});
