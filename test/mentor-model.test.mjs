import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { blockMinutes, changeLabel, hoursMinutes, mentorStats, mondayOf } from '../lib/mentor-model.ts';

const task = (day, over = {}) => ({ subject: 'Math', startTime: '19:00', endTime: '20:00', day, isDone: true, isMissed: false, ...over });
const TODAY = '2026-11-25'; // a Wednesday

describe('mentor dashboard numbers', () => {
  test('weeks start on Monday; blocks crossing midnight count their real length', () => {
    assert.equal(mondayOf(TODAY), '2026-11-23');
    assert.equal(mondayOf('2026-11-29'), '2026-11-23'); // Sunday belongs to the week before it
    assert.equal(blockMinutes('22:30', '00:00'), 90);
  });

  test('this week: done time, blocks due so far, completion, change against last week', () => {
    const s = mentorStats(
      [
        task('2026-11-23'), // Mon done 60
        task('2026-11-24', { isDone: false, isMissed: true }), // Tue missed
        task('2026-11-25', { endTime: '21:30' }), // Wed done 150
        task('2026-11-26', { isDone: false }), // Thu: in the future, not due yet
        task('2026-11-17', { endTime: '19:30' }), // last week 30
      ],
      [],
      TODAY
    );
    assert.equal(s.week.doneMinutes, 210);
    assert.equal(s.week.blocksDone, 2);
    assert.equal(s.week.blocksDue, 3);
    assert.equal(s.week.completion, 67);
    assert.equal(s.week.changeMinutes, 180);
  });

  test('no blocks last week means no comparison, not "+everything"', () => {
    assert.equal(mentorStats([task(TODAY)], [], TODAY).week.changeMinutes, null);
    assert.equal(mentorStats([], [], TODAY).week.completion, null);
  });

  test('14 days end today, oldest first, zero on days without study', () => {
    const s = mentorStats([task(TODAY), task('2026-11-12')], [], TODAY);
    assert.equal(s.last14.length, 14);
    assert.equal(s.last14[0].day, '2026-11-12');
    assert.equal(s.last14[13].day, TODAY);
    assert.deepEqual(s.last14.map((d) => d.minutes).filter(Boolean), [60, 60]);
  });

  test('subjects over 30 days merge revision into the subject, most time first', () => {
    const s = mentorStats(
      [
        task(TODAY, { subject: 'Physics' }),
        task(TODAY, { subject: 'Math (revision)', endTime: '21:00' }),
        task('2026-11-20', { subject: 'Math', isDone: false, isMissed: true }),
        task('2026-10-01', { subject: 'Old subject' }), // older than 30 days
      ],
      [],
      TODAY
    );
    assert.deepEqual(
      s.subjects.map((x) => [x.subject, x.done, x.missed, x.minutes, x.completion]),
      [
        ['Math', 1, 1, 120, 50],
        ['Physics', 1, 0, 60, 100],
      ]
    );
  });

  test('marks: percentages averaged, unmarked and future exams ignored, newest first', () => {
    const s = mentorStats(
      [],
      [
        { title: 'Midterm', subject: 'Math', day: '2026-11-10', score: 41, maxScore: 50 },
        { title: 'Quiz', subject: 'PHP', day: '2026-11-20', score: 6, maxScore: 10 },
        { title: 'Final', subject: 'Math', day: '2026-12-10', score: 90, maxScore: 100 },
        { title: 'Not marked', subject: 'Physics', day: '2026-11-01', score: null, maxScore: 100 },
      ],
      TODAY
    );
    assert.equal(s.marks.count, 2);
    assert.equal(s.marks.average, 71); // (82 + 60) / 2
    assert.deepEqual(s.marks.recent.map((m) => m.title), ['Quiz', 'Midterm']);
  });

  test('labels', () => {
    assert.equal(hoursMinutes(580), '9h 40m');
    assert.equal(hoursMinutes(45), '45m');
    assert.equal(hoursMinutes(120), '2h');
    assert.equal(changeLabel(130), '+2h 10m vs last week');
    assert.equal(changeLabel(-45), '−45m vs last week');
    assert.equal(changeLabel(0), 'same as last week');
    assert.equal(changeLabel(null), null);
  });
});
