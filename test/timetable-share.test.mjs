import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimetableFile,
  MAX_SHARED_LESSONS,
  parseTimetableData,
  parseTimetableFile,
  planReplace,
  routineKey,
  subjectsOf,
  timetableFileName,
} from '../lib/timetable-share.ts';

const lesson = (over = {}) => ({ dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subject: 'Math', isBreak: false, ...over });
const block = (over = {}) => ({ dayOfWeek: 4, subject: 'Physics', startTime: '22:30', endTime: '00:00', deadlineDay: 'Thursday', type: 'HOMEWORK', ...over });
const file = (over = {}) => ({ kind: 'study-flow-timetable', version: 1, exportedAt: '2026-11-20T10:00:00.000Z', from: 'Levi', ...over });

describe('timetable share file', () => {
  test('a built file reads back as the same timetable', () => {
    const built = buildTimetableFile({ from: ' Levi ', schoolLessons: [lesson()], studyRoutine: [block()], now: new Date('2026-11-20T10:00:00Z') });
    assert.deepEqual(built.subjects, ['Math', 'Physics']);
    const parsed = parseTimetableFile(JSON.stringify(built));
    assert.ok(parsed.ok);
    assert.equal(parsed.data.from, 'Levi');
    assert.deepEqual(parsed.data.schoolLessons, [lesson()]);
    assert.deepEqual(parsed.data.studyRoutine, [block()]);
  });

  test('a part left out of the file is null, so importing leaves it alone', () => {
    const parsed = parseTimetableData(file({ studyRoutine: [block()] }));
    assert.ok(parsed.ok);
    assert.equal(parsed.data.schoolLessons, null);
    assert.equal(parsed.data.studyRoutine.length, 1);
  });

  test('refuses what is not ours, and files from a newer app, with plain messages', () => {
    assert.match(parseTimetableFile('not json').error, /isn't a Study Flow timetable/);
    assert.match(parseTimetableData({ kind: 'other', version: 1 }).error, /isn't a Study Flow timetable/);
    assert.match(parseTimetableData(file({ version: 2, schoolLessons: [] })).error, /newer Study Flow/);
    assert.match(parseTimetableData(file()).error, /empty/);
  });

  test('bad times and days name the item', () => {
    assert.match(parseTimetableData(file({ schoolLessons: [lesson(), lesson({ startTime: '9:00' })] })).error, /School lesson 2: the start time/);
    assert.match(parseTimetableData(file({ schoolLessons: [lesson({ endTime: '07:00' })] })).error, /end after it starts/);
    assert.match(parseTimetableData(file({ schoolLessons: [lesson({ dayOfWeek: 7 })] })).error, /day is missing/);
    assert.match(parseTimetableData(file({ studyRoutine: [block({ endTime: '22:30' })] })).error, /different time/);
    assert.match(parseTimetableData(file({ studyRoutine: [block({ type: 'EXAM' })] })).error, /Homework or Revision/);
  });

  test('a study block may cross midnight; a school lesson may not', () => {
    assert.ok(parseTimetableData(file({ studyRoutine: [block({ startTime: '23:00', endTime: '00:30' })] })).ok);
    assert.equal(parseTimetableData(file({ schoolLessons: [lesson({ startTime: '23:00', endTime: '00:30' })] })).ok, false);
  });

  test('over the cap is refused', () => {
    const many = Array.from({ length: MAX_SHARED_LESSONS + 1 }, (_, i) => lesson({ startTime: `0${i % 10}:00`, endTime: `0${i % 10}:30` }));
    assert.match(parseTimetableData(file({ schoolLessons: many })).error, /more than 200/);
  });

  test('unknown fields are dropped, names tidied, deadline day normalised, duplicates kept once', () => {
    const parsed = parseTimetableData(
      file({
        schoolLessons: [lesson({ subject: '  Web   UI ', id: 'x', userId: 'someone-else' }), lesson({ subject: 'Other' })],
        studyRoutine: [block({ deadlineDay: 'friday' }), block({ deadlineDay: 'whenever' , dayOfWeek: 5, startTime: '20:00', endTime: '21:00' })],
      })
    );
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.data.schoolLessons, [lesson({ subject: 'Web UI' })]);
    assert.equal(parsed.data.studyRoutine[0].deadlineDay, 'Friday');
    assert.equal(parsed.data.studyRoutine[1].deadlineDay, 'Friday', 'unreadable falls back to the block day');
  });

  test('subjects skip breaks and case duplicates; file names are safe for Windows', () => {
    assert.deepEqual(subjectsOf({ schoolLessons: [lesson({ subject: 'Break', isBreak: true }), lesson()], studyRoutine: [block({ subject: 'math' })] }), ['Math']);
    assert.equal(timetableFileName('Le/vi: "A"', new Date('2026-11-20T10:00:00Z')), 'Levi A timetable 2026-11-20.studyflow');
    assert.equal(timetableFileName(null, new Date('2026-11-20T10:00:00Z')), 'timetable 2026-11-20.studyflow');
  });

  test('planReplace keeps rows on the same key, drops the rest and old duplicates', () => {
    const existing = [
      { id: 'a', dayOfWeek: 4, subject: 'Physics', startTime: '22:30' },
      { id: 'a2', dayOfWeek: 4, subject: 'physics', startTime: '22:30' },
      { id: 'b', dayOfWeek: 1, subject: 'Math', startTime: '19:00' },
    ];
    const plan = planReplace(existing, [block(), block({ dayOfWeek: 2, subject: 'PHP' })], routineKey, routineKey);
    assert.deepEqual(plan.update.map((u) => u.id), ['a']);
    assert.deepEqual(plan.create.map((c) => c.subject), ['PHP']);
    assert.deepEqual(plan.remove.sort(), ['a2', 'b']);
  });
});
