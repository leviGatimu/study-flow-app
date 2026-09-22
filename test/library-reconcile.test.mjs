/**
 * The library reconciler against a real SQLite database and a real temp
 * directory - the same shape as the desktop.
 *
 * The folder is the truth on the desktop and the rows follow it. Each test
 * here is one thing a student can do in Windows Explorer, or one thing the
 * website can send down, and what the table must look like afterwards. The
 * two conservative rules matter most and are pinned: a folder row that has
 * never been on this disk is created, a folder that WAS here and is gone is
 * tombstoned, never resurrected.
 *
 * Needs the harness client: npm run test:sync:setup
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Fleet } from './sync/harness.mjs';

// The legacy-upload step reads UPLOAD_DIR at module load, so it is pointed at
// a temp directory BEFORE the reconciler is imported.
const uploads = mkdtempSync(join(tmpdir(), 'studyflow-uploads-'));
process.env.UPLOADS_DIR = uploads;
const { reconcileLibrary } = await import('../lib/library-reconcile.ts');

const SCOPE = { classId: 'class_y2', label: 'Year 2', termIds: [], isArchive: false };

let fleet;
let db;
let userId;
let dir;

const root = () => join(dir, 'Year 2');
const live = (where = {}) => db.resource.findMany({ where: { userId, deletedAt: null, ...where }, orderBy: { title: 'asc' } });
const run = (subjects = ['Physics']) => reconcileLibrary(db, userId, SCOPE, subjects, dir);

before(async () => {
  fleet = await Fleet.create({ devices: ['desktop'] });
  db = fleet.device('desktop').prisma;
  userId = fleet.userId;
  await db.class.create({ data: { id: SCOPE.classId, userId, label: SCOPE.label } });
});

after(async () => {
  await fleet.destroy();
  rmSync(uploads, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.resource.deleteMany({ where: { userId } });
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = mkdtempSync(join(tmpdir(), 'studyflow-library-'));
});

describe('library reconciler', () => {
  test('disabled off the desktop, and never writes into an archived year', async () => {
    assert.equal(await reconcileLibrary(db, userId, SCOPE, ['Physics'], null), null);
    assert.equal(await reconcileLibrary(db, userId, { ...SCOPE, isArchive: true }, ['Physics'], dir), null);
    assert.equal(existsSync(root()), false);
  });

  test('every known subject gets a directory under the year', async () => {
    const result = await run(['Physics', 'C programming', '2025/2026 Elective']);
    assert.deepEqual(readdirSync(root()).sort(), ['2025-2026 Elective', 'C programming', 'Physics']);
    assert.deepEqual(result.subjectsOnDisk.sort(), ['2025/2026 Elective', 'C programming', 'Physics']);
    assert.equal(result.created, 0);
  });

  test('files and folders dropped in from Explorer become rows, once', async () => {
    mkdirSync(join(root(), 'Physics', 'Chapter 1', 'Worksheets'), { recursive: true });
    writeFileSync(join(root(), 'Physics', 'syllabus.pdf'), 'x');
    writeFileSync(join(root(), 'Physics', 'Chapter 1', 'Worksheets', 'ws1.pdf'), 'x');
    writeFileSync(join(root(), 'Physics', 'Thumbs.db'), 'noise');
    writeFileSync(join(root(), 'Physics', '~$draft.docx'), 'noise');

    const first = await run();
    assert.equal(first.created, 4, 'two folders and two files; the noise is skipped');

    const rows = await live();
    assert.deepEqual(
      new Set(rows.map((r) => `${r.type}|${r.folder}|${r.title}`)),
      new Set(['FOLDER||Chapter 1', 'FOLDER|Chapter 1|Worksheets', 'FILE||syllabus.pdf', 'FILE|Chapter 1/Worksheets|ws1.pdf'])
    );
    assert.equal(rows.find((r) => r.title === 'ws1.pdf').url, '/library/Year%202/Physics/Chapter%201/Worksheets/ws1.pdf');
    assert.ok(rows.every((r) => r.classId === SCOPE.classId), 'stamped with the active class');

    const second = await run();
    assert.equal(second.created, 0, 'idempotent');
    assert.equal((await live()).length, 4);
  });

  test('a subject folder created in Explorer becomes a subject', async () => {
    mkdirSync(join(root(), 'Astronomy'), { recursive: true });
    writeFileSync(join(root(), 'Astronomy', 'stars.pdf'), 'x');
    const result = await run(['Physics']);
    assert.ok(result.subjectsOnDisk.includes('Astronomy'));
    assert.equal((await live({ subject: 'Astronomy' })).length, 1);
  });

  test('a file deleted in Explorer is tombstoned; a folder too', async () => {
    mkdirSync(join(root(), 'Physics', 'Old'), { recursive: true });
    writeFileSync(join(root(), 'Physics', 'Old', 'gone.pdf'), 'x');
    writeFileSync(join(root(), 'Physics', 'kept.pdf'), 'x');
    await run();
    assert.equal((await live()).length, 3);

    rmSync(join(root(), 'Physics', 'Old'), { recursive: true });
    const result = await run();
    assert.equal(result.removed, 2);
    const rows = await live();
    assert.deepEqual(rows.map((r) => r.title), ['kept.pdf']);

    const tombstones = await db.resource.findMany({ where: { userId, deletedAt: { not: null } } });
    assert.equal(tombstones.length, 2, 'soft-deleted, so the deletion can sync');
  });

  test('a folder row from the website is created on disk, then left alone once the student deletes it', async () => {
    // What a pull from the server leaves behind: a FOLDER row with no url.
    await db.resource.create({
      data: { userId, subject: 'Physics', title: 'From the web', type: 'FOLDER', url: '', folder: '', classId: SCOPE.classId },
    });
    await run();
    assert.ok(existsSync(join(root(), 'Physics', 'From the web')));
    const [row] = await live({ type: 'FOLDER' });
    assert.equal(row.url, '/library/Year%202/Physics/From%20the%20web');

    // Now the student removes it in Explorer.
    rmSync(join(root(), 'Physics', 'From the web'), { recursive: true });
    await run();
    assert.equal(existsSync(join(root(), 'Physics', 'From the web')), false, 'not resurrected');
    assert.equal((await live({ type: 'FOLDER' })).length, 0);
  });

  test('a tombstoned folder row is not brought back as a directory', async () => {
    await db.resource.create({
      data: {
        userId, subject: 'Physics', title: 'Deleted long ago', type: 'FOLDER', url: '', folder: '',
        classId: SCOPE.classId, deletedAt: new Date(),
      },
    });
    await run();
    assert.equal(existsSync(join(root(), 'Physics', 'Deleted long ago')), false);
  });

  test('legacy flat uploads move into the subject folder and keep their row', async () => {
    writeFileSync(join(uploads, 'resource-1700000000-ch1.pdf'), 'bytes');
    const legacy = await db.resource.create({
      data: {
        userId, subject: 'Physics', title: 'Chapter 1 Notes', type: 'FILE',
        url: '/uploads/resource-1700000000-ch1.pdf', folder: '', classId: SCOPE.classId,
      },
    });
    // And one whose bytes never arrived on this machine.
    await db.resource.create({
      data: {
        userId, subject: 'Physics', title: 'Never fetched', type: 'FILE',
        url: '/uploads/resource-1700000001-missing.pdf', folder: '', classId: SCOPE.classId,
      },
    });

    const result = await run();
    assert.equal(result.migrated, 1);

    const moved = await db.resource.findUnique({ where: { id: legacy.id } });
    assert.equal(moved.title, 'Chapter 1 Notes.pdf');
    assert.equal(moved.url, '/library/Year%202/Physics/Chapter%201%20Notes.pdf');
    assert.ok(existsSync(join(root(), 'Physics', 'Chapter 1 Notes.pdf')));
    assert.equal(existsSync(join(uploads, 'resource-1700000000-ch1.pdf')), false, 'moved, not copied');
    assert.equal(result.created, 0, 'the moved file is recognised by its new url, not re-indexed');

    const untouched = await live({ title: 'Never fetched' });
    assert.equal(untouched[0].url, '/uploads/resource-1700000001-missing.pdf');
    assert.equal(untouched[0].deletedAt, null, 'a row with no local bytes is left exactly as it was');
  });

  test('another user’s rows are never read or written', async () => {
    await db.user.create({ data: { id: 'user_other', username: 'other', passwordHash: 'x', currentTerm: 'Term 1' } });
    await db.resource.create({
      data: { userId: 'user_other', subject: 'Physics', title: 'Theirs', type: 'FOLDER', url: '', folder: '', classId: null },
    });
    mkdirSync(join(root(), 'Physics'), { recursive: true });
    writeFileSync(join(root(), 'Physics', 'mine.pdf'), 'x');
    await run();
    assert.equal(existsSync(join(root(), 'Physics', 'Theirs')), false);
    const theirs = await db.resource.findMany({ where: { userId: 'user_other' } });
    assert.equal(theirs.length, 1);
    assert.equal(theirs[0].url, '');
  });
});
