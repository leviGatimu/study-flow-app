/**
 * Importing a shared timetable against a real SQLite database.
 *
 * Import replaces: the file's lessons and routine become this year's. Pinned
 * here: finished work survives as history, importing the same file twice is
 * a no-op rather than a second copy, a row on the same natural key is edited
 * in place (so sync sees an edit, not a delete plus a twin), other years are
 * untouched, and subjects are adopted rather than duplicated.
 *
 * Needs the harness client: npm run test:sync:setup
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './sync/harness.mjs';

const { applyTimetableImport } = await import('../lib/timetable-import.ts');
const { parseTimetableData } = await import('../lib/timetable-share.ts');

const Y1 = 'class_y1';
const Y2 = 'class_y2';

let fleet;
let db;
let userId;

const file = (over = {}) => {
  const parsed = parseTimetableData({ kind: 'study-flow-timetable', version: 1, from: 'Levi', ...over });
  assert.ok(parsed.ok, parsed.error);
  return parsed.data;
};
const routine = [
  { dayOfWeek: 1, subject: 'Networking', startTime: '20:00', endTime: '20:30', deadlineDay: 'Monday', type: 'HOMEWORK' },
  { dayOfWeek: 5, subject: 'Math (revision)', startTime: '20:00', endTime: '21:30', deadlineDay: 'Friday', type: 'REVISION' },
];
const lessons = [
  { dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subject: 'physics', isBreak: false },
  { dayOfWeek: 1, startTime: '10:00', endTime: '10:20', subject: 'Break', isBreak: true },
];
const live = (model, where = {}) => db[model].findMany({ where: { userId, deletedAt: null, ...where }, orderBy: { startTime: 'asc' } });

before(async () => {
  fleet = await Fleet.create({ devices: ['desktop'] });
  db = fleet.device('desktop').prisma;
  userId = fleet.userId;
  await db.class.create({ data: { id: Y1, userId, label: 'Year 1', status: 'COMPLETED' } });
  await db.class.create({ data: { id: Y2, userId, label: 'Year 2' } });
});

after(async () => {
  await fleet.destroy();
});

beforeEach(async () => {
  await db.task.deleteMany({ where: { userId } });
  await db.scheduleTemplate.deleteMany({ where: { userId } });
  await db.schoolLesson.deleteMany({ where: { userId } });
  await db.subject.deleteMany({ where: { userId } });
});

describe('timetable import', () => {
  test('replaces this year, keeps finished work, leaves other years alone', async () => {
    const old = await db.scheduleTemplate.create({
      data: { userId, classId: Y2, dayOfWeek: 3, subject: 'PHP', startTime: '20:00', endTime: '21:30', deadlineDay: 'Wednesday', type: 'HOMEWORK' },
    });
    const done = await db.task.create({
      data: { userId, templateId: old.id, date: new Date('2026-11-18T00:00:00Z'), startTime: '20:00', endTime: '21:30', subject: 'PHP', type: 'HOMEWORK', isDone: true },
    });
    const undone = await db.task.create({
      data: { userId, templateId: old.id, date: new Date('2026-11-25T00:00:00Z'), startTime: '20:00', endTime: '21:30', subject: 'PHP', type: 'HOMEWORK' },
    });
    const lastYear = await db.scheduleTemplate.create({
      data: { userId, classId: Y1, dayOfWeek: 3, subject: 'PHP', startTime: '20:00', endTime: '21:30', deadlineDay: 'Wednesday', type: 'HOMEWORK' },
    });

    const result = await applyTimetableImport(db, userId, { classId: Y2 }, file({ studyRoutine: routine }));
    assert.equal(result.blocks, 2);
    assert.equal(result.lessons, null);

    assert.deepEqual((await live('scheduleTemplate', { classId: Y2 })).map((t) => t.subject).sort(), ['Math (revision)', 'Networking']);
    const kept = await db.task.findUnique({ where: { id: done.id } });
    assert.equal(kept.deletedAt, null, 'finished block stays');
    assert.equal(kept.templateId, null, 'and is detached from the removed routine block');
    assert.notEqual((await db.task.findUnique({ where: { id: undone.id } })).deletedAt, null, 'undone block goes');
    assert.equal((await db.scheduleTemplate.findUnique({ where: { id: lastYear.id } })).deletedAt, null, 'Year 1 untouched');
  });

  test('importing the same file twice changes nothing the second time', async () => {
    const data = file({ studyRoutine: routine, schoolLessons: lessons });
    await applyTimetableImport(db, userId, { classId: Y2 }, data);
    const firstT = (await live('scheduleTemplate')).map((t) => t.id).sort();
    const firstL = (await live('schoolLesson')).map((l) => l.id).sort();
    await applyTimetableImport(db, userId, { classId: Y2 }, data);
    assert.deepEqual((await live('scheduleTemplate')).map((t) => t.id).sort(), firstT, 'same rows, edited in place');
    assert.deepEqual((await live('schoolLesson')).map((l) => l.id).sort(), firstL);
    assert.equal(await db.scheduleTemplate.count({ where: { userId, deletedAt: { not: null } } }), 0, 'no tombstones');
  });

  test('a block on the same slot is edited, not replaced', async () => {
    const mine = await db.scheduleTemplate.create({
      data: { userId, classId: Y2, dayOfWeek: 1, subject: 'networking', startTime: '20:00', endTime: '21:00', deadlineDay: 'Tuesday', type: 'REVISION' },
    });
    await applyTimetableImport(db, userId, { classId: Y2 }, file({ studyRoutine: routine }));
    const after = await db.scheduleTemplate.findUnique({ where: { id: mine.id } });
    assert.equal(after.deletedAt, null);
    assert.equal(after.subject, 'Networking');
    assert.equal(after.endTime, '20:30');
    assert.equal(after.type, 'HOMEWORK');
  });

  test('subjects: existing names absorb the file spelling, missing ones are added or adopted', async () => {
    await db.subject.create({ data: { userId, classId: Y2, name: 'Physics' } });
    await db.subject.create({ data: { userId, classId: Y1, name: 'Networking' } });
    await db.subject.create({ data: { userId, classId: Y2, name: 'Math (revision)', deletedAt: new Date() } });

    const result = await applyTimetableImport(db, userId, { classId: Y2 }, file({ studyRoutine: routine, schoolLessons: lessons }));

    assert.deepEqual(result.newSubjects.sort(), ['Math (revision)', 'Networking']);
    assert.equal((await live('schoolLesson', { isBreak: false }))[0].subject, 'Physics', 'lesson stored under the existing name');
    const subjects = await db.subject.findMany({ where: { userId, deletedAt: null }, orderBy: { name: 'asc' } });
    assert.deepEqual(subjects.map((s) => [s.name, s.classId]), [
      ['Math (revision)', Y2],
      ['Networking', Y2],
      ['Physics', Y2],
    ]);
    assert.equal(await db.subject.count({ where: { userId } }), 3, 'adopted and revived, never duplicated');
  });

  test('a part the file leaves out is not touched', async () => {
    await db.schoolLesson.create({ data: { userId, classId: Y2, dayOfWeek: 2, startTime: '09:00', endTime: '10:00', subject: 'English' } });
    await applyTimetableImport(db, userId, { classId: Y2 }, file({ studyRoutine: routine }));
    assert.equal((await live('schoolLesson')).length, 1);
  });
});
