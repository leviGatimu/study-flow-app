/**
 * One grade parser for every page (audit D02): "A-" was stored as 0 and
 * "18/20" as 1820 in report-card averages.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { averageGrades, parseGradeToPercentage } from '../lib/grades.ts';

describe('parseGradeToPercentage', () => {
  test('fractions, percentages and plain numbers', () => {
    assert.equal(parseGradeToPercentage('18/20'), 90);
    assert.equal(parseGradeToPercentage(' 18 / 20 '), 90);
    assert.equal(parseGradeToPercentage('78%'), 78);
    assert.equal(parseGradeToPercentage('78.5 %'), 78.5);
    assert.equal(parseGradeToPercentage('64'), 64);
  });

  test('letters on one scale', () => {
    assert.equal(parseGradeToPercentage('A'), 93);
    assert.equal(parseGradeToPercentage('A-'), 90);
    assert.equal(parseGradeToPercentage('b+'), 87);
  });

  test('impossible or unreadable grades are null, never 0', () => {
    for (const bad of ['', '   ', 'absent', '25/20', '10/0', '120', '120%', 'A++', 'G', null, undefined]) {
      assert.equal(parseGradeToPercentage(bad), null, String(bad));
    }
  });
});

describe('averageGrades', () => {
  test('the audit case: A- and 18/20 average to 90, not 910', () => {
    assert.equal(averageGrades(['A-', '18/20']), 90);
  });

  test('unreadable grades are left out, not counted as zero', () => {
    assert.equal(averageGrades(['80', 'absent']), 80);
  });

  test('nothing readable means no average', () => {
    assert.equal(averageGrades([]), null);
    assert.equal(averageGrades(['absent']), null);
  });
});
