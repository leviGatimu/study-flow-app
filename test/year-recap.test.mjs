/**
 * The year recap's numbers: what the Year home page and the recap story show.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildYearRecap, longestRun, blockMinutes, studyTimeLabel, monthName } from '../lib/year-recap.ts';

const task = (day, subject, start, end, { done = true, missed = false, type = 'HOMEWORK' } = {}) => ({
  day, subject, startTime: start, endTime: end, type, isDone: done, isMissed: missed,
});

const base = {
  label: 'Year 2', startedAt: '2025-09-01', completedAt: '2026-07-01',
  tasks: [], focusSessions: [], homework: [], exams: [], practiceScores: [], xp: 0, terms: [], grade: null,
};

describe('year recap', () => {
  test('time studied counts only finished blocks, by subject, with shares', () => {
    const r = buildYearRecap({
      ...base,
      tasks: [
        task('2025-09-01', 'Java', '20:00', '22:00'),
        task('2025-09-02', 'Java (revision)', '20:00', '21:00', { type: 'REVISION' }),
        task('2025-09-03', 'Physics', '19:00', '20:00'),
        task('2025-09-04', 'Physics', '19:00', '20:00', { done: false, missed: true }),
      ],
    });
    assert.equal(r.minutes, 240);
    assert.deepEqual(r.subjects.map((s) => [s.subject, s.minutes, s.share]), [['Java', 180, 75], ['Physics', 60, 25]]);
    assert.equal(r.blocksDone, 3);
    assert.equal(r.blocksMissed, 1);
    assert.equal(r.completion, 75);
    assert.equal(r.homeworkBlocks, 2);
    assert.equal(r.revisionBlocks, 1);
  });

  test('months cover the whole year, empty ones included', () => {
    const r = buildYearRecap({
      ...base,
      tasks: [task('2025-09-10', 'A', '10:00', '11:00'), task('2025-12-01', 'A', '10:00', '13:00')],
    });
    assert.deepEqual(r.months, [
      { key: '2025-09', minutes: 60 }, { key: '2025-10', minutes: 0 },
      { key: '2025-11', minutes: 0 }, { key: '2025-12', minutes: 180 },
    ]);
    assert.deepEqual(r.busiestMonth, { key: '2025-12', minutes: 180 });
  });

  test('best day, busiest weekday and favourite hour', () => {
    const r = buildYearRecap({
      ...base,
      tasks: [
        task('2026-01-05', 'A', '21:00', '23:00'), // Monday
        task('2026-01-05', 'B', '21:30', '22:30'),
        task('2026-01-06', 'A', '08:00', '09:00'), // Tuesday
      ],
    });
    assert.deepEqual(r.bestDay, { day: '2026-01-05', minutes: 180 });
    assert.equal(r.busiestWeekday.weekday, 1);
    assert.equal(r.favouriteHour, 21);
  });

  test('longest run of days in a row, across a month end', () => {
    assert.equal(longestRun(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-03']), 3);
    assert.equal(longestRun([]), 0);
    const r = buildYearRecap({ ...base, tasks: [task('2026-03-01', 'A', '10:00', '11:00'), task('2026-03-02', 'A', '10:00', '11:00')] });
    assert.equal(r.activeDays, 2);
    assert.equal(r.longestRun, 2);
  });

  test('exams, homework, practice and focus', () => {
    const r = buildYearRecap({
      ...base,
      focusSessions: [1500, 3600, 600],
      homework: [{ isCompleted: true, onTime: true }, { isCompleted: true, onTime: false }, { isCompleted: false, onTime: false }],
      exams: [
        { title: 'Java final', subject: 'Java', category: 'Final', score: 46, maxScore: 50 },
        { title: 'Math midterm', subject: 'Math', category: 'Midterm 1', score: 30, maxScore: 50 },
        { title: 'Physics final', subject: 'Physics', category: 'Final', score: null, maxScore: null },
      ],
      practiceScores: [60, 80, 100],
    });
    assert.equal(r.focusMinutes, 95);
    assert.equal(r.focusSessions, 3);
    assert.equal(r.longestSessionMinutes, 60);
    assert.equal(r.homeworkDone, 2);
    assert.equal(r.homeworkOnTime, 1);
    assert.equal(r.examsTaken, 3);
    assert.equal(r.examsMarked, 2);
    assert.equal(r.examAverage, 76);
    assert.deepEqual(r.bestExam, { title: 'Java final', subject: 'Java', percent: 92 });
    assert.equal(r.practiceAverage, 80);
    assert.equal(r.practiceBest, 100);
  });

  test('an empty year has nothing to divide by', () => {
    const r = buildYearRecap(base);
    assert.equal(r.minutes, 0);
    assert.equal(r.completion, 0);
    assert.deepEqual(r.months, []);
    assert.equal(r.busiestMonth, null);
    assert.equal(r.favouriteHour, null);
    assert.equal(r.examAverage, null);
    assert.equal(r.longestSessionMinutes, 0);
  });

  test('blocks over midnight and bad times', () => {
    assert.equal(blockMinutes('23:30', '00:30'), 60);
    assert.equal(blockMinutes('xx', '10:00'), 0);
  });

  test('wording helpers', () => {
    assert.match(studyTimeLabel(22), /night owl/);
    assert.match(studyTimeLabel(7), /early riser/i);
    assert.equal(studyTimeLabel(null), null);
    assert.equal(monthName('2026-03'), 'March 2026');
    assert.equal(monthName('2026-03', false), 'March');
  });
});
