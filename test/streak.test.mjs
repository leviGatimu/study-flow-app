import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStreak, plannedDays } from '../lib/streak.ts';

const TODAY = '2026-11-06'; // a Friday
const everyDay = () => true;
const nothing = () => false;
const streak = (studied, planned = everyDay, today = TODAY) => computeStreak({ studied, planned, today });

describe('the streak', () => {
  test('opening the app counts for nothing: no study, no streak', () => {
    assert.deepEqual(streak([]), { current: 0, longest: 0 });
  });

  test('the owner\'s week: Tuesday and Thursday only is a streak of one, not six', () => {
    assert.equal(streak(['2026-11-03', '2026-11-05']).current, 1);
  });

  test('days in a row count', () => {
    assert.equal(streak(['2026-11-03', '2026-11-04', '2026-11-05']).current, 3);
  });

  test('today not finished yet does not break it', () => {
    assert.equal(streak(['2026-11-04', '2026-11-05']).current, 2);
  });

  test('finishing a block today adds to it', () => {
    assert.equal(streak(['2026-11-04', '2026-11-05', TODAY]).current, 3);
  });

  test('a planned day with nothing finished ends it', () => {
    assert.equal(streak(['2026-11-03']).current, 0);
  });

  test('a day with nothing planned does not end it', () => {
    const planned = (day) => day !== '2026-11-04';
    assert.equal(streak(['2026-11-03', '2026-11-05'], planned).current, 2);
  });

  test('a free day adds nothing to the count', () => {
    assert.equal(streak(['2026-11-05'], nothing).current, 1);
  });

  test('the best run is kept from earlier, and is the real one', () => {
    const result = streak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-05']);
    assert.deepEqual(result, { current: 1, longest: 3 });
  });

  test('runs across month and year ends', () => {
    assert.equal(streak(['2026-12-31', '2027-01-01'], everyDay, '2027-01-01').current, 2);
  });

  test('a day finished twice is one day', () => {
    assert.equal(streak(['2026-11-05', '2026-11-05']).current, 1);
  });
});

describe('what counts as planned', () => {
  const base = {
    taskDays: ['2026-11-02'],
    routineWeekdays: [1, 3], // Monday, Wednesday
    termWindows: [{ from: '2026-09-01', to: '2026-12-01' }],
    holidays: new Set(),
  };

  test('a day holding a block is planned', () => {
    assert.equal(plannedDays(base)('2026-11-02'), true);
  });

  test('skipping the app does not make a routine day free', () => {
    assert.equal(plannedDays(base)('2026-11-04'), true);
  });

  test('a weekday with no routine is free', () => {
    assert.equal(plannedDays(base)('2026-11-05'), false);
  });

  test('a routine day outside any term is free', () => {
    assert.equal(plannedDays(base)('2026-12-02'), false);
  });

  test('a holiday is free, even with a block on it', () => {
    assert.equal(plannedDays({ ...base, holidays: new Set(['2026-11-02']) })('2026-11-02'), false);
  });

  test('the routine says nothing about the time before the first block', () => {
    assert.equal(plannedDays(base)('2026-09-02'), false);
  });

  test('skipping the app breaks a streak', () => {
    const planned = plannedDays({ ...base, taskDays: ['2026-11-02'] });
    assert.equal(computeStreak({ studied: ['2026-11-02'], planned, today: TODAY }).current, 0);
  });
});
