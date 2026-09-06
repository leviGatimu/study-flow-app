/**
 * The term start-date gate.
 *
 * Reported symptom: "I set the schedule for term 1 for tomorrow but when I
 * resume it starts clocking before tomorrow." getScheduleState computed
 * isRunning as `!isPaused` and never looked at the start date, so an ACTIVE
 * term dated in the future generated tasks and advanced the streak today.
 *
 * The boundary is the whole point: a term starting TODAY must run, one
 * starting TOMORROW must not. Off by one here either loses a day of the
 * schedule or starts it early, and both are invisible until it happens.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { termHasStarted, termHasEnded } from '../lib/term-dates.ts';

const at = (iso) => new Date(iso);
const TODAY = at('2026-09-06T14:23:00');

describe('termHasStarted', () => {
  test('a term starting today is running, at any time of day', () => {
    // The stored date carries whatever time it was saved with; that must not
    // decide whether today counts.
    assert.equal(termHasStarted(at('2026-09-06T00:00:00'), TODAY), true);
    assert.equal(termHasStarted(at('2026-09-06T23:59:59'), TODAY), true);
    assert.equal(termHasStarted(at('2026-09-06T09:00:00'), TODAY), true);
  });

  test('a term starting tomorrow is NOT running - the reported bug', () => {
    assert.equal(termHasStarted(at('2026-09-07T00:00:00'), TODAY), false);
    assert.equal(termHasStarted(at('2026-09-07T23:00:00'), TODAY), false);
  });

  test('a term that started in the past is running', () => {
    assert.equal(termHasStarted(at('2026-09-05T22:00:00'), TODAY), true);
    assert.equal(termHasStarted(at('2026-01-01T00:00:00'), TODAY), true);
  });

  test('no start date means running - absence of a date is not a delay', () => {
    assert.equal(termHasStarted(null, TODAY), true);
  });

  test('the day boundary either side of midnight', () => {
    const midnight = at('2026-09-06T00:00:00');
    assert.equal(termHasStarted(at('2026-09-05T23:59:59'), midnight), true, 'yesterday');
    assert.equal(termHasStarted(at('2026-09-06T00:00:00'), midnight), true, 'this instant');
    assert.equal(termHasStarted(at('2026-09-07T00:00:00'), midnight), false, 'tomorrow');
  });

  test('a far-future term stays off', () => {
    assert.equal(termHasStarted(at('2027-01-15T00:00:00'), TODAY), false);
  });
});
