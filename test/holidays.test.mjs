/**
 * Public holidays switch the study routine off.
 *
 * Reported: "I don't study on Christmas, or New Year's" - the routine kept
 * generating blocks on public holidays and then marking them missed.
 * Expected dates are Rwanda's published 2026 list.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { holidaysForYear, holidaysBetween, holidayOn } from '../lib/holidays.ts';

const dates = (year) => holidaysForYear('RW', year).map((h) => h.date);

describe('Rwanda holidays', () => {
  test('2026 matches the published list, in-lieu days included', () => {
    assert.deepEqual(dates(2026), [
      '2026-01-01', '2026-01-02', '2026-02-01', '2026-02-02',
      '2026-03-20', '2026-04-03', '2026-04-06', '2026-04-07',
      '2026-05-01', '2026-05-27', '2026-07-01', '2026-07-04',
      '2026-07-06', '2026-08-07', '2026-08-15', '2026-08-17',
      '2026-12-25', '2026-12-26', '2026-12-28',
    ]);
  });

  test('Easter moves Good Friday and Easter Monday', () => {
    assert.ok(dates(2027).includes('2027-03-26'));
    assert.ok(dates(2027).includes('2027-03-29'));
  });

  test('Umuganura is the first Friday of August', () => {
    assert.ok(dates(2027).includes('2027-08-06'));
    assert.ok(dates(2028).includes('2028-08-04'));
  });

  test('a weekend Christmas and Boxing Day take two separate weekdays', () => {
    // 2027: Christmas is a Saturday, Boxing Day a Sunday.
    const lieu = holidaysForYear('RW', 2027).filter((h) => h.inLieu).map((h) => h.date);
    assert.ok(lieu.includes('2027-12-27'));
    assert.ok(lieu.includes('2027-12-28'));
  });

  test('Memorial Day on a weekend gives no day in lieu', () => {
    // 7 April 2029 is a Saturday.
    const lieu = holidaysForYear('RW', 2029).filter((h) => h.inLieu);
    assert.ok(!lieu.some((h) => h.name.startsWith('Genocide')));
  });
});

describe('lookups', () => {
  test('a range spanning New Year covers both years', () => {
    const found = holidaysBetween('Africa/Kigali', '2026-12-24', '2027-01-03');
    assert.deepEqual([...found.keys()], [
      '2026-12-25', '2026-12-26', '2026-12-28', '2027-01-01', '2027-01-02',
    ]);
  });

  test('an ordinary day is not a holiday', () => {
    assert.equal(holidayOn('Africa/Kigali', '2026-10-05'), null);
    assert.equal(holidayOn('Africa/Kigali', '2026-12-25').name, 'Christmas Day');
  });

  test('a timezone with no known country gets no holidays', () => {
    assert.equal(holidaysBetween('Europe/London', '2026-01-01', '2026-12-31').size, 0);
  });
});
