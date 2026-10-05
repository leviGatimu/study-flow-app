/**
 * Ask AI's retrieval: the right records for the question, labelled so the
 * model cannot confuse official marks with practice, and citations that link
 * back to real records.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectIntent, buildEvidence, evidencePrompt, citedSources } from '../lib/copilot-retrieval.ts';

const SUBJECTS = ['Physics', 'Math', 'PHP', 'C', 'Web UI'];

const ROWS = {
  homework: [{ id: 'h1', subject: 'PHP', title: 'Login form', due: 'Wed 7 Oct', daysLeft: 2 }],
  exams: [{ id: 'e1', title: 'Physics Paper 1', subject: 'Physics', date: 'Mon 12 Oct', daysLeft: 7, time: '08:00' }],
  grades: [
    { subject: 'Math', grade: '18/20', term: 'Term 1' },
    { subject: 'Physics', grade: 'B-', term: 'Term 1' },
    { subject: 'Physics', grade: 'absent', term: 'Term 2' },
  ],
  goals: [{ subject: 'Math', targetGrade: 95 }],
  resources: [{ subject: 'Physics', title: 'Forces chapter.pdf' }],
  attempts: [
    { setId: 'set1', title: 'Forces', subject: 'Physics', score: 70, markingStatus: 'FINAL', when: 'yesterday', wrong: [{ question: 'Unit of force?', given: 'Joule', expected: 'Newton' }] },
  ],
  lessons: [{ day: 'Monday', subject: 'Math', startTime: '08:00', endTime: '09:00' }],
  focus: { minutes: 300, sessions: 6 },
};

describe('detectIntent', () => {
  test('marks and the subject are found', () => {
    const i = detectIntent('My Maths result was 18/20. How am I progressing toward my goal?', [], SUBJECTS);
    assert.equal(i.marks, true);
    assert.deepEqual(i.subjects, ['Math']);
    const j = detectIntent('How is my Math going?', [], SUBJECTS);
    assert.deepEqual(j.subjects, ['Math']);
  });

  test('a one-letter subject like "C" does not match every sentence', () => {
    assert.deepEqual(detectIntent('Can you check this?', [], SUBJECTS).subjects, []);
  });

  test('earlier turns keep the subject in focus', () => {
    assert.deepEqual(detectIntent('and the next topic?', ['Explain Physics forces'], SUBJECTS).subjects, ['Physics']);
  });

  test('practice, resources, lessons', () => {
    assert.equal(detectIntent('Take me back to the questions I got wrong yesterday', [], SUBJECTS).practice, true);
    assert.equal(detectIntent('Use the PDF in my resources', [], SUBJECTS).resources, true);
    assert.equal(detectIntent('Plan revision around my lessons', [], SUBJECTS).lessons, true);
  });
});

describe('buildEvidence', () => {
  test('deadlines always; marks only when asked or a subject is in focus', () => {
    const none = buildEvidence(detectIntent('hello', [], SUBJECTS), ROWS);
    assert.deepEqual(none.map((e) => e.kind), ['HOMEWORK', 'EXAM']);
    assert.equal(none[1].href, '/exams/e1');
  });

  test('18/20 reads as 90%; an unreadable grade says so, never 0', () => {
    const ev = buildEvidence(detectIntent('what are my marks', [], SUBJECTS), ROWS);
    const marks = ev.filter((e) => e.kind === 'MARK').map((e) => e.text);
    assert.ok(marks.some((t) => t.includes('18/20 = 90%')));
    assert.ok(marks.some((t) => t.includes('absent (could not be read as a percentage)')));
  });

  test('a subject narrows marks, resources and practice to it', () => {
    const ev = buildEvidence(detectIntent('Help with Physics', [], SUBJECTS), ROWS);
    assert.ok(ev.filter((e) => e.kind === 'MARK').every((e) => e.label.startsWith('Physics')));
    assert.ok(ev.some((e) => e.kind === 'RESOURCE' && e.href === '/resources/Physics'));
    assert.ok(ev.some((e) => e.kind === 'PRACTICE' && e.text.startsWith('PRACTICE (not an official mark)')));
  });

  test('mistakes are included only when practice is the question', () => {
    const asked = buildEvidence(detectIntent('which questions did I get wrong in Physics', [], SUBJECTS), ROWS);
    assert.ok(asked.find((e) => e.kind === 'PRACTICE').text.includes('missed: "Unit of force?"'));
    const not = buildEvidence(detectIntent('Physics marks?', [], SUBJECTS), ROWS);
    assert.ok(!not.find((e) => e.kind === 'PRACTICE').text.includes('missed'));
  });

  test('focus totals are honest about per-session history', () => {
    const ev = buildEvidence(detectIntent('how many hours have i studied in focus', [], SUBJECTS), ROWS);
    assert.match(ev.find((e) => e.kind === 'FOCUS').text, /Per-session history is not recorded/);
  });

  test('ids are sequential', () => {
    const ev = buildEvidence(detectIntent('Physics marks and notes', [], SUBJECTS), ROWS);
    assert.deepEqual(ev.map((e) => e.id), ev.map((_, i) => `S${i + 1}`));
  });
});

test('missing data is declared, not zeroed', () => {
  const intent = detectIntent('What are my Web UI marks?', [], SUBJECTS);
  const prompt = evidencePrompt(buildEvidence(intent, ROWS), intent);
  assert.match(prompt, /MISSING: no official marks recorded for Web UI/);
});

test('citedSources keeps cited records once, in order, and ignores invented ids', () => {
  const ev = buildEvidence(detectIntent('Physics marks', [], SUBJECTS), ROWS);
  const sources = citedSources('You got B- [S3]. Exam soon [S2, S3]. Also [S99].', ev);
  assert.deepEqual(sources.map((s) => s.label), [ev[2].label, ev[1].label]);
});

import { linkCitations } from '../lib/copilot-citations.ts';

test('citations become numbered links; invented ids vanish; code is untouched', () => {
  const sources = [{ id: 'S3', href: '/marks' }, { id: 'S1', href: '/homeworks' }];
  assert.equal(linkCitations('B- [S3]. Due [S1, S3]. Made up [S9].', sources), 'B- [1](/marks). Due [2](/homeworks) [1](/marks). Made up.');
  assert.equal(linkCitations('```\narr[S3]\n```', sources), '```\narr[S3]\n```');
});
