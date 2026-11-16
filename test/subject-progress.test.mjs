/**
 * Exam results feed each subject's standing against its target, and the
 * Focus list ranks the subjects that need attention.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildSubjectProgress, neededOnRest, rankFocus, progressKey } from '../lib/subject-progress.ts';

const NOW = new Date('2026-11-16T09:00:00Z');

let n = 0;
const exam = (subject, { score = null, maxScore = 100, date = '2026-11-01', weight = null, done, title, category = null } = {}) => ({
  id: `e${++n}`,
  title: title ?? `${subject} exam`,
  date: new Date(`${date}T00:00:00Z`),
  kind: 'EXAM',
  category,
  weight,
  score,
  maxScore: score === null ? null : maxScore,
  subject: subject ? { name: subject } : null,
  done: done ?? new Date(`${date}T00:00:00Z`) < NOW,
});

const card = (term, createdAt, grades) => ({ term, createdAt: new Date(createdAt), grades });

const build = (over) =>
  buildSubjectProgress({ subjects: [], goals: [], exams: [], reportCards: [], now: NOW, ...over });

describe('subject progress', () => {
  test('a marked midterm decides where you are, against the goal', () => {
    const [physics] = build({
      goals: [{ subject: 'Physics', targetGrade: 75 }],
      exams: [exam('Physics', { score: 31, maxScore: 50, title: 'Physics midterm', category: 'Midterm 1' })],
      reportCards: [card('Term 1', '2026-08-01', [{ subject: 'Physics', grade: '82' }])],
    });
    assert.equal(physics.current, 62);
    assert.equal(physics.source, 'exams');
    assert.equal(physics.gap, -13);
    assert.equal(physics.reportMark, 82);
    assert.equal(physics.results[0].category, 'Midterm 1');
  });

  test('with no exam marks, the newest report card is the fallback', () => {
    const [math] = build({
      goals: [{ subject: 'Math', targetGrade: 70 }],
      reportCards: [
        card('Term 1', '2026-04-01', [{ subject: 'Math', grade: '50' }]),
        card('Term 2', '2026-08-01', [{ subject: 'math', grade: '18/20' }]),
      ],
    });
    assert.equal(math.current, 90);
    assert.equal(math.source, 'report');
    assert.equal(math.reportTerm, 'Term 2');
    assert.equal(math.needed, null);
  });

  test('exams average by weight only when every result has one', () => {
    const [weighted] = build({
      exams: [exam('C', { score: 50, weight: 10 }), exam('C', { score: 80, weight: 30, date: '2026-11-05' })],
    });
    assert.equal(weighted.examAverage, 72.5);
    assert.equal(weighted.weighted, true);

    const [plain] = build({
      exams: [exam('C', { score: 50, weight: 10 }), exam('C', { score: 80, date: '2026-11-05' })],
    });
    assert.equal(plain.examAverage, 65);
    assert.equal(plain.weighted, false);
  });

  test('coming exams, pending marks and trend are split out', () => {
    const [p] = build({
      exams: [
        exam('PHP', { score: 80, date: '2026-10-01' }),
        exam('PHP', { score: 68, date: '2026-11-01' }),
        exam('PHP', { date: '2026-11-10' }),
        exam('PHP', { date: '2026-11-20', title: 'PHP final' }),
      ],
    });
    assert.equal(p.results.length, 2);
    assert.equal(p.pending, 1);
    assert.equal(p.coming.length, 1);
    assert.equal(p.coming[0].daysAway, 4);
    assert.equal(p.trend, -12);
  });

  test('the mark needed on what is left', () => {
    // Equal weight: (75 * 2 - 60) / 1 = 90.
    assert.equal(neededOnRest(75, [{ percent: 60, weight: null }], [{ weight: null }]), 90);
    // Weighted: midterm 40%, final 60%. (75 * 100 - 60 * 40) / 60 = 85.
    assert.equal(neededOnRest(75, [{ percent: 60, weight: 40 }], [{ weight: 60 }]), 85);
    assert.equal(neededOnRest(75, [{ percent: 60, weight: 40 }], []), null);
  });

  test('subjects match across "(revision)", case and spacing', () => {
    assert.equal(progressKey('Math (revision)'), progressKey(' math'));
    const list = build({
      subjects: ['Math (revision)', 'Math', 'English'],
      goals: [{ subject: 'math', targetGrade: 60 }],
      exams: [exam('MATH', { score: 70 })],
    });
    assert.deepEqual(list.map((p) => p.subject), ['English', 'Math']);
    assert.equal(list[1].target, 60);
    assert.equal(list[1].current, 70);
  });

  test('exams with no subject linked are ignored', () => {
    assert.deepEqual(build({ exams: [exam(null, { score: 10 })] }), []);
  });
});

describe('focus ranking', () => {
  test('the subject furthest behind with an exam soon comes first', () => {
    const progress = build({
      goals: [
        { subject: 'Physics', targetGrade: 75 },
        { subject: 'Math', targetGrade: 70 },
        { subject: 'English', targetGrade: 60 },
      ],
      exams: [
        exam('Physics', { score: 55 }),
        exam('Physics', { date: '2026-11-19', title: 'Physics final' }),
        exam('Math', { score: 66 }),
        exam('English', { score: 85 }),
      ],
    });
    const focus = rankFocus(progress);
    assert.deepEqual(focus.map((f) => f.progress.subject), ['Physics', 'Math']);
    assert.equal(focus[0].level, 'high');
    assert.match(focus[0].reasons[0].text, /20 points under your 75% target/);
    assert.ok(focus[0].reasons.some((r) => r.text === 'Physics final in 3 days'));
    assert.ok(focus[0].reasons.some((r) => r.text === 'Needs 95% on what is left'));
  });

  test('without targets, a subject well below your own average is flagged', () => {
    const focus = rankFocus(build({
      exams: [exam('A', { score: 90 }), exam('B', { score: 88 }), exam('C', { score: 50 })],
    }));
    assert.deepEqual(focus.map((f) => f.progress.subject), ['C']);
    assert.match(focus[0].reasons[0].text, /Below your average/);
  });

  test('on-track subjects and subjects with nothing to judge are left out', () => {
    const focus = rankFocus(build({
      subjects: ['Art'],
      goals: [{ subject: 'Math', targetGrade: 60 }],
      exams: [exam('Math', { score: 80 })],
    }));
    assert.deepEqual(focus, []);
  });

  test('an unmarked subject with an exam close by still shows', () => {
    const focus = rankFocus(build({ exams: [exam('Biology', { date: '2026-11-18' })] }));
    assert.equal(focus.length, 1);
    assert.ok(focus[0].reasons.some((r) => r.text === 'No mark yet to judge it by'));
  });
});
