/**
 * Ask AI's view of the student.
 *
 * The point of the feature is that "what is my most urgent deadline?" gets
 * answered from the student's real data - so the prompt must carry it, flag
 * what is overdue, and the suggestions must come from their own subjects.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildCopilotPrompt, suggestPrompts, titleFromQuestion } from '../lib/copilot-context.ts';

const EMPTY = {
  today: 'Monday 5 October 2026',
  now: '18:40',
  holidayToday: null,
  todayBlocks: [],
  tomorrowBlocks: [],
  homework: [],
  exams: [],
  weakSubjects: [],
  routine: [],
  upcomingHolidays: [],
};

const BUSY = {
  ...EMPTY,
  todayBlocks: [
    { subject: 'Networking', start: '20:00', end: '20:30', type: 'HOMEWORK', status: 'done' },
    { subject: 'Javascript', start: '20:30', end: '21:30', type: 'HOMEWORK', status: 'pending' },
  ],
  homework: [
    { subject: 'Physics', title: 'Lab report', due: 'Sat 3 Oct', daysLeft: -2 },
    { subject: 'PHP', title: 'Login form', due: 'Wed 7 Oct', daysLeft: 2 },
  ],
  exams: [{ title: 'Math CAT', subject: 'Math', date: 'Mon 12 Oct', daysLeft: 7, time: '08:00' }],
  weakSubjects: [{ subject: 'Physics', reason: 'Mostly low quiz scores' }],
  routine: [{ day: 'Monday', blocks: ['20:00-20:30 Networking'] }],
  upcomingHolidays: [{ date: 'Fri 25 Dec', name: 'Christmas Day' }],
};

describe('buildCopilotPrompt', () => {
  test('carries the date, deadlines and weak subjects', () => {
    const prompt = buildCopilotPrompt(BUSY);
    assert.match(prompt, /Today is Monday 5 October 2026, and it is 18:40/);
    assert.match(prompt, /Physics: Lab report - Sat 3 Oct \(OVERDUE by 2 days\)/);
    assert.match(prompt, /PHP: Login form - Wed 7 Oct \(in 2 days\)/);
    assert.match(prompt, /Math CAT \(Math\) - Mon 12 Oct at 08:00 \(in 7 days\)/);
    assert.match(prompt, /Physics: Mostly low quiz scores/);
    assert.match(prompt, /20:00-20:30 Networking \(homework\) \[done\]/);
    assert.match(prompt, /Fri 25 Dec: Christmas Day/);
  });

  test('says plainly when there is nothing, so the model does not invent', () => {
    const prompt = buildCopilotPrompt(EMPTY);
    assert.match(prompt, /\(no unfinished homework\)/);
    assert.match(prompt, /\(no upcoming exams\)/);
    assert.match(prompt, /Never invent homework/);
    assert.doesNotMatch(prompt, /PUBLIC HOLIDAYS/);
  });

  test('a holiday today is stated', () => {
    assert.match(buildCopilotPrompt({ ...EMPTY, holidayToday: 'Christmas Day' }), /public holiday \(Christmas Day\)/);
  });
});

describe('suggestPrompts', () => {
  test('come from the student\'s own data, at most four', () => {
    const labels = suggestPrompts(BUSY).map((s) => s.label);
    assert.deepEqual(labels, [
      'Prep for Javascript',
      'Start: Lab report',
      'Plan for Math CAT',
      'Quiz me on Physics',
    ]);
  });

  test('an empty account still gets a useful starter', () => {
    assert.deepEqual(suggestPrompts(EMPTY).map((s) => s.label), ['What is most urgent?']);
  });
});

describe('titleFromQuestion', () => {
  test('short questions are kept whole', () => {
    assert.equal(titleFromQuestion('  Explain   TCP/IP  '), 'Explain TCP/IP');
  });

  test('long questions are cut at a word', () => {
    const title = titleFromQuestion('I am struggling with the Networking homework due tomorrow, can you explain TCP/IP simply?');
    assert.ok(title.length <= 61);
    assert.ok(title.endsWith('…'));
    assert.ok(!title.includes('  '));
  });
});
