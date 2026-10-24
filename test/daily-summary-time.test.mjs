import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DAILY_SUMMARY_TIME, dailySummaryTime, isDailySummaryDue } from '../lib/daily-summary-time.ts';

test('daily reports default to 23:58, including missing or invalid saved values', () => {
  assert.equal(DEFAULT_DAILY_SUMMARY_TIME, '23:58');
  for (const value of [undefined, null, '', '24:00', '23:60', '9:00']) {
    assert.equal(dailySummaryTime(value), '23:58');
  }
});

test('today becomes eligible at 23:58, never at the old 21:00 cutoff', () => {
  for (const time of ['00:00:00', '21:00:00', '23:57:59']) {
    assert.equal(isDailySummaryDue(new Date(`2026-10-25T${time}`)), false, time);
  }
  for (const time of ['23:58:00', '23:58:59', '23:59:59']) {
    assert.equal(isDailySummaryDue(new Date(`2026-10-25T${time}`)), true, time);
  }
  assert.equal(isDailySummaryDue(new Date('2026-10-26T00:00:00')), false);
});

test('saved custom times remain effective', () => {
  assert.equal(dailySummaryTime('22:30'), '22:30');
  assert.equal(isDailySummaryDue(new Date('2026-10-25T22:29:59'), '22:30'), false);
  assert.equal(isDailySummaryDue(new Date('2026-10-25T22:30:00'), '22:30'), true);
  assert.equal(isDailySummaryDue(new Date('2026-10-25T00:00:00'), '00:00'), true);
});

test('the cutoff uses account wall-clock fields, even across a UTC day boundary', () => {
  for (const zone of ['Africa/Kigali', 'America/New_York', 'Asia/Tokyo']) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date('2026-10-25T21:58:00Z'));
    const part = (name) => Number(parts.find(p => p.type === name).value);
    const localNow = new Date(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
    assert.equal(isDailySummaryDue(localNow), zone === 'Africa/Kigali', zone);
  }
});
