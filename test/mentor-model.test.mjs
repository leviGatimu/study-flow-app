import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  blockStatus,
  changeLabel,
  dailySeries,
  heatmap,
  homeworkBuckets,
  hoursMinutes,
  marksSummary,
  mondayOf,
  periodSummary,
  relativeDay,
  subjectRows,
} from '../lib/mentor-model.ts';

const TODAY = '2026-11-26'; // a Thursday

let n = 0;
const task = (day, subject, { start = '18:00', end = '19:00', done = false, missed = false, focus = 0 } = {}) => ({
  id: `t${n++}`,
  subject,
  type: 'HOMEWORK',
  startTime: start,
  endTime: end,
  day,
  isDone: done,
  isMissed: missed,
  focusMinutes: focus,
});

const exam = (day, subject, score = null, maxScore = null, title = `${subject} test`) => ({
  id: `e${n++}`,
  title,
  subject,
  kind: 'TEST',
  category: null,
  day,
  startTime: null,
  score,
  maxScore,
});

describe('mentor model', () => {
  test('a past block nobody ticked counts as missed; today and later are still open', () => {
    assert.equal(blockStatus({ day: '2026-11-25', isDone: false, isMissed: false }, TODAY), 'missed');
    assert.equal(blockStatus({ day: TODAY, isDone: false, isMissed: false }, TODAY), 'today');
    assert.equal(blockStatus({ day: '2026-11-27', isDone: false, isMissed: false }, TODAY), 'upcoming');
    assert.equal(blockStatus({ day: '2026-11-20', isDone: true, isMissed: true }, TODAY), 'done');
  });

  test('a period counts only up to today, and completion is done over due', () => {
    const tasks = [
      task('2026-11-23', 'Math', { done: true, focus: 50 }),
      task('2026-11-24', 'Physics', { missed: true }),
      task('2026-11-25', 'Math'), // never ticked: missed
      task(TODAY, 'Math', { start: '20:00', end: '21:30' }), // still open today
      task('2026-11-28', 'Math', { done: true }), // future, ignored
    ];
    const s = periodSummary(tasks, mondayOf(TODAY), '2026-11-29', TODAY);
    assert.equal(s.blocksDone, 1);
    assert.equal(s.blocksMissed, 2);
    assert.equal(s.blocksDue, 3);
    assert.equal(s.completion, 33);
    assert.equal(s.doneMinutes, 60);
    assert.equal(s.plannedMinutes, 60 * 3 + 90);
    assert.equal(s.focusMinutes, 50);
    assert.equal(s.activeDays, 1);
    assert.equal(periodSummary([], '2026-11-23', TODAY, TODAY).completion, null);
  });

  test('daily series has every day, and a block past midnight wraps', () => {
    const series = dailySeries([task('2026-11-24', 'Math', { start: '23:00', end: '00:30', done: true })], '2026-11-23', '2026-11-25', TODAY);
    assert.deepEqual(series.map((p) => p.day), ['2026-11-23', '2026-11-24', '2026-11-25']);
    assert.equal(series[1].done, 90);
  });

  test('heatmap is whole weeks from Monday with fixed levels', () => {
    const grid = heatmap([task('2026-11-24', 'Math', { start: '17:00', end: '20:00', done: true })], TODAY, 4);
    assert.equal(grid.length, 4);
    assert.equal(grid[0][0].day, '2026-11-02');
    const tue = grid[3][1];
    assert.equal(tue.day, '2026-11-24');
    assert.equal(tue.level, 4);
    assert.equal(grid[3][4].future, true); // Friday
  });

  test('subjects merge revision, pick up marks and the next exam', () => {
    const rows = subjectRows(
      [
        task('2026-11-20', 'Math', { done: true }),
        task('2026-11-21', 'Math (revision)', { done: true, start: '10:00', end: '12:00' }),
        task('2026-11-22', 'Physics', { missed: true }),
      ],
      [exam('2026-11-10', 'Math', 18, 20), exam('2026-11-12', 'Math', 14, 20), exam('2026-12-03', 'Physics')],
      '2026-10-28',
      TODAY
    );
    assert.deepEqual(rows.map((r) => r.subject), ['Math', 'Physics']);
    const math = rows[0];
    assert.equal(math.doneMinutes, 180);
    assert.equal(math.completion, 100);
    assert.equal(math.average, 80);
    assert.equal(math.lastStudied, '2026-11-21');
    assert.equal(math.weekly.reduce((a, b) => a + b, 0), 180);
    assert.equal(math.weekly.length, 6);
    assert.equal(rows[1].completion, 0);
    assert.equal(rows[1].nextExam.day, '2026-12-03');
  });

  test('marks: average, trend of the latest three, upcoming and awaiting', () => {
    const m = marksSummary(
      [
        exam('2026-11-01', 'Math', 50, 100),
        exam('2026-11-02', 'Math', 60, 100),
        exam('2026-11-03', 'Math', 70, 100),
        exam('2026-11-04', 'Math', 80, 100),
        exam('2026-11-05', 'Math', 90, 100),
        exam('2026-11-06', 'Math', 100, 100),
        exam('2026-11-20', 'Physics'),
        exam('2026-12-01', 'Physics'),
        exam('2026-12-02', 'Math', 1, 0), // bad max: not a mark
      ],
      TODAY
    );
    assert.equal(m.marked.length, 6);
    assert.equal(m.marked[0].percent, 100);
    assert.equal(m.average, 75);
    assert.equal(m.trend, 30);
    assert.equal(m.best.percent, 100);
    assert.equal(m.lowest.percent, 50);
    assert.deepEqual(m.upcoming.map((e) => e.day), ['2026-12-01', '2026-12-02']);
    assert.deepEqual(m.awaiting.map((e) => e.day), ['2026-11-20']);
    assert.equal(marksSummary([], TODAY).trend, null);
  });

  test('homework buckets by due day, and on-time share of finished work', () => {
    const hw = (id, due, completed = null) => ({ id, title: id, subject: 'Math', due, isCompleted: !!completed, completed });
    const b = homeworkBuckets(
      [hw('late', '2026-11-20'), hw('soon', '2026-11-28'), hw('later', '2026-12-10'), hw('ok', '2026-11-20', '2026-11-19'), hw('slow', '2026-11-20', '2026-11-22')],
      TODAY
    );
    assert.deepEqual([b.late, b.soon, b.later].map((l) => l.map((h) => h.id)), [['late'], ['soon'], ['later']]);
    assert.deepEqual(b.done.map((h) => h.id), ['slow', 'ok']);
    assert.equal(b.onTime, 50);
  });

  test('words', () => {
    assert.equal(hoursMinutes(580), '9h 40m');
    assert.equal(hoursMinutes(120), '2h');
    assert.equal(hoursMinutes(-5), '0m');
    assert.deepEqual(changeLabel(130, 0), { text: '+2h 10m', up: true });
    assert.deepEqual(changeLabel(10, 55), { text: '−45m', up: false });
    assert.equal(changeLabel(10, null), null);
    assert.equal(relativeDay('2026-11-27', TODAY), 'Tomorrow');
    assert.equal(relativeDay('2026-11-23', TODAY), '3 days ago');
  });
});
