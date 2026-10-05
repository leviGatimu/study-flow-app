/**
 * Quick Add stores exactly what was entered, and the server validates it
 * (audit D09: 20:00 was saved as 20:03, 23:57 as "24:00").
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateQuickTask, isDateKey } from '../lib/task-input.ts';

const base = { subject: 'Physics', startTime: '20:00', endTime: '21:30', type: 'HOMEWORK', date: '2026-10-07' };

describe('validateQuickTask', () => {
  test('times are kept exactly as entered', () => {
    for (const startTime of ['20:00', '23:57', '23:59']) {
      const r = validateQuickTask({ ...base, startTime, endTime: '00:30' });
      assert.equal(r.ok, true);
      assert.equal(r.value.startTime, startTime);
      assert.equal(r.value.endTime, '00:30');
    }
  });

  test('an overnight block is allowed, a zero-length one is not', () => {
    assert.equal(validateQuickTask({ ...base, startTime: '22:00', endTime: '01:00' }).ok, true);
    assert.equal(validateQuickTask({ ...base, startTime: '20:00', endTime: '20:00' }).ok, false);
  });

  test('malformed values are refused at the boundary', () => {
    const bad = [
      { startTime: '24:00' }, { startTime: '9:00' }, { endTime: '20:60' }, { startTime: 2000 },
      { subject: '   ' }, { subject: 'x'.repeat(121) }, { type: 'PARTY' },
      { date: '2026-02-30' }, { date: '07/10/2026' },
    ];
    for (const patch of bad) assert.equal(validateQuickTask({ ...base, ...patch }).ok, false, JSON.stringify(patch));
  });

  test('no date means today, chosen by the caller', () => {
    const r = validateQuickTask({ ...base, date: undefined });
    assert.equal(r.ok, true);
    assert.equal(r.value.dateKey, null);
  });

  test('type is case-insensitive', () => {
    assert.equal(validateQuickTask({ ...base, type: 'revision' }).value.type, 'REVISION');
  });
});

test('isDateKey accepts only real dates', () => {
  assert.ok(isDateKey('2028-02-29'));
  assert.ok(!isDateKey('2027-02-29'));
});
