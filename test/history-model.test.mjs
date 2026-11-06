import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestDay, changeLabel, groupByDay, subjectScores, taskMinutes } from '../app/history/history-model.ts';

const block = (subject, date, startTime, endTime, state = 'done') => ({
  id: `${subject}-${date}-${startTime}`,
  subject,
  date: `${date}T12:00:00Z`,
  startTime,
  endTime,
  isDone: state === 'done',
  isMissed: state === 'missed',
});
const dayKey = (d) => d.toISOString().slice(0, 10);

test('a block crossing midnight still has its real length', () => {
  assert.equal(taskMinutes({ startTime: '22:30', endTime: '00:00' }), 90);
});

test('subject scores join revision to its subject and count missed blocks', () => {
  const scores = subjectScores([
    block('Math', '2026-11-01', '19:00', '20:00'),
    block('Math (revision)', '2026-11-02', '19:00', '20:30'),
    block('Math', '2026-11-03', '19:00', '20:00', 'missed'),
    block('Java', '2026-11-03', '20:00', '21:00'),
  ]);
  assert.deepEqual(scores[0], { subject: 'Math', done: 2, missed: 1, minutes: 150, completion: 67 });
  assert.equal(scores[1].subject, 'Java');
});

test('blocks still to do are not counted against a subject', () => {
  assert.deepEqual(subjectScores([block('Math', '2026-11-01', '19:00', '20:00', 'open')]), []);
});

test('the log groups neighbouring days and totals only finished time', () => {
  const days = groupByDay(
    [block('Math', '2026-11-02', '19:00', '20:00'), block('Java', '2026-11-02', '20:00', '21:00', 'missed'), block('Web3', '2026-11-01', '19:00', '19:30')],
    dayKey
  );
  assert.deepEqual(days.map((d) => [d.key, d.tasks.length, d.minutes]), [['2026-11-02', 2, 60], ['2026-11-01', 1, 30]]);
});

test('the change is worded plainly, and stays quiet with nothing to compare', () => {
  assert.equal(changeLabel(5, 3), '+2 on the period before');
  assert.equal(changeLabel(3, 5), '-2 on the period before');
  assert.equal(changeLabel(4, 4), 'Same as the period before');
  assert.equal(changeLabel(0, 0), null);
});

test('the best day adds up a whole day', () => {
  const best = bestDay(
    [block('Math', '2026-11-01', '19:00', '20:00'), block('Java', '2026-11-02', '18:00', '19:00'), block('Web3', '2026-11-02', '19:00', '20:30')],
    dayKey
  );
  assert.equal(best.minutes, 150);
  assert.equal(dayKey(best.date), '2026-11-02');
  assert.equal(bestDay([], dayKey), null);
});
