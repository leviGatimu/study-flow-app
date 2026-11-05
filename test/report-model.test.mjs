import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { dailyReports, hm, longDay, parseBreakdown, versusAverage, weeklyReports } from '../lib/report-model.ts';
import { renderReportPdf } from '../lib/report-pdf.ts';

const perf = (grade = 'B') => ({
  score: 72, grade, level: 'Solid', feedback: 'A steady day.', detail: 'Most blocks were done.',
  strengths: ['Finished Physics early.'], improvements: ['Start with Java tomorrow.'], theme: { hex: '#3b82f6' },
});

const day = (id, key, done, extra = {}) => ({
  id, key, performance: perf(), totalMinutes: 240, completedMinutes: done, subjectBreakdown: '{"Physics":120,"Math":90,"Bad":-5}',
  completedSessions: 2, totalSessions: 3, currentStreak: 4,
  tasks: [
    { subject: 'Math', startTime: '21:30', endTime: '23:00', isDone: true },
    { subject: 'Physics', startTime: '19:00', endTime: '21:00', isDone: true },
    { subject: 'Java', startTime: '23:00', endTime: '23:30', isDone: false },
  ],
  ...extra,
});

describe('report model', () => {
  test('dates read in full and short', () => {
    assert.equal(longDay('2026-11-05'), 'Thursday 5 November 2026');
  });

  test('a daily report lists blocks in time order, subjects largest first, bad entries dropped', () => {
    const [r] = dailyReports([day('a', '2026-11-05', 210)], new Map([['2026-11-05', [{ title: 'Ex 4', subject: 'Math' }]]]));
    assert.deepEqual(r.blocks.map((b) => b.subject), ['Physics', 'Math', 'Java']);
    assert.deepEqual(r.subjects.map((s) => s.label), ['Physics', 'Math']);
    assert.equal(r.fileName, 'Daily report 2026-11-05.pdf');
    assert.equal(r.homework.length, 1);
    assert.equal(r.averageMinutes, null);
  });

  test('each day is compared with up to 7 earlier report days', () => {
    const list = dailyReports([day('a', '2026-11-05', 200), day('b', '2026-11-04', 100), day('c', '2026-11-03', 50)]);
    assert.equal(list[0].averageMinutes, 75);
    assert.equal(list[2].averageMinutes, null);
    assert.match(versusAverage(list[0]).text, /^2h 5m more than/);
    assert.equal(versusAverage(list[0]).up, true);
  });

  test('a weekly report has Monday to Sunday and the range as its title', () => {
    const [w] = weeklyReports([{
      id: 'w', startKey: '2026-10-26', endKey: '2026-11-01', performance: perf('A'), totalMinutes: 900, completedMinutes: 800,
      subjectBreakdown: '{}', dailyMinutes: [60, 0, 120], completedSessions: 9, totalSessions: 10, currentStreak: 5,
    }]);
    assert.equal(w.title, '26 October – 1 November 2026');
    assert.equal(w.shortTitle, '26 Oct – 1 Nov');
    assert.deepEqual(w.days.map((d) => d.minutes), [60, 0, 120, 0, 0, 0, 0]);
  });

  test('helpers', () => {
    assert.equal(hm(100), '1h 40m');
    assert.equal(hm(60), '1h');
    assert.equal(hm(-3), '0m');
    assert.deepEqual(parseBreakdown('not json'), []);
  });

  test('the PDF renders, including a long list that needs a second page', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ subject: `Subject ${i}`, startTime: '08:00', endTime: '09:00', isDone: i % 2 === 0 }));
    const [r] = dailyReports([day('a', '2026-11-05', 200, { tasks: many })]);
    const bytes = renderReportPdf(r, new Date('2026-11-05T21:58:00Z'));
    const text = Buffer.from(bytes).toString('latin1');
    assert.ok(text.startsWith('%PDF-'));
    assert.match(text, /\/Count 2/);
  });
});
