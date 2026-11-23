import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ageOn,
  birthdayKeysBetween,
  formatBirthday,
  isBirthdayOn,
  ordinal,
  parseBirthday,
} from '../lib/birthday.ts';

test('birthdays parse with or without a year, and nonsense does not', () => {
  assert.deepEqual(parseBirthday('03-14'), { month: 3, day: 14, year: null });
  assert.deepEqual(parseBirthday('2007-03-14'), { month: 3, day: 14, year: 2007 });
  assert.equal(parseBirthday('02-30'), null);
  assert.equal(parseBirthday('13-01'), null);
  assert.equal(parseBirthday('2007-02-29'), null); // not a leap year
  assert.deepEqual(parseBirthday('02-29'), { month: 2, day: 29, year: null });
  assert.equal(parseBirthday(''), null);
  assert.equal(parseBirthday(null), null);
  assert.equal(parseBirthday('14/03/2007'), null);
});

test('the stored form is built from the chosen parts', () => {
  assert.deepEqual(formatBirthday(3, 14), { value: '03-14' });
  assert.deepEqual(formatBirthday(3, 14, 2007), { value: '2007-03-14' });
  assert.ok('error' in formatBirthday(4, 31));
});

test('the birthday is found on its day every year, and 29 February falls back to the 28th', () => {
  const b = parseBirthday('2007-03-14');
  assert.equal(isBirthdayOn(b, '2026-03-14'), true);
  assert.equal(isBirthdayOn(b, '2026-03-15'), false);
  const leap = parseBirthday('2008-02-29');
  assert.equal(isBirthdayOn(leap, '2027-02-28'), true);
  assert.equal(isBirthdayOn(leap, '2028-02-29'), true);
  assert.equal(isBirthdayOn(leap, '2028-02-28'), false);
  assert.equal(isBirthdayOn(null, '2026-03-14'), false);
});

test('which birthday it is, only when the year is known', () => {
  assert.equal(ageOn(parseBirthday('2007-03-14'), '2026-03-14'), 19);
  assert.equal(ageOn(parseBirthday('03-14'), '2026-03-14'), null);
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(19), '19th');
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(22), '22nd');
});

test('a calendar view across a new year shows the right birthday', () => {
  const b = parseBirthday('01-02');
  assert.deepEqual(birthdayKeysBetween(b, '2026-12-28', '2027-01-31'), ['2027-01-02']);
  assert.deepEqual(birthdayKeysBetween(b, '2026-03-01', '2026-03-31'), []);
});
