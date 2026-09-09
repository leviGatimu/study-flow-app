/**
 * Proves that a delete leaves a tombstone, and that nothing shows it to you.
 *
 * Both halves matter and they fail in opposite directions. If the write half
 * breaks, a deletion cannot travel between devices and the next sync brings it
 * back. If the read half breaks, deleted work reappears in the UI - which looks
 * far more like data corruption to the person using the app than a missing row
 * ever does.
 *
 * These run against real SQLite databases built from the real migrations, via
 * the same harness the sync hazards use.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SOFT_DELETE_CASCADES,
  softDelete,
  softDeleteExtension,
} from '../../lib/soft-delete.ts';
import { Fleet } from './harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { Prisma } = require(join(ROOT, 'node_modules', '.prisma', 'client-sqlite-test', 'index.js'));

const camel = (name) => name.charAt(0).toLowerCase() + name.slice(1);

describe('the cascade map', () => {
  test('matches every ON DELETE CASCADE relation in the schema', () => {
    // Re-derived from the client's own metadata rather than trusted: a foreign
    // key that gains or loses a cascade in the schema has to show up here, or
    // soft delete silently stops reproducing what the database used to do.
    const derived = {};
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields) {
        if (field.relationOnDelete !== 'Cascade') continue;
        const parent = camel(field.type);
        const fk = field.relationFromFields?.[0];
        if (!fk) continue;
        (derived[parent] ??= []).push({ model: camel(model.name), fk });
      }
    }

    const normalise = (map) =>
      Object.fromEntries(
        Object.entries(map)
          .map(([parent, kids]) => [
            parent,
            [...kids].sort((a, b) => `${a.model}.${a.fk}`.localeCompare(`${b.model}.${b.fk}`)),
          ])
          .sort(([a], [b]) => a.localeCompare(b))
      );

    assert.deepEqual(
      normalise(SOFT_DELETE_CASCADES),
      normalise(derived),
      'SOFT_DELETE_CASCADES has drifted from the schema'
    );
  });
});

describe('no call site quietly goes back to hard deleting', () => {
  // The read half of soft delete is enforced by the extension and cannot be
  // forgotten. The write half is a helper you have to remember to call, and a
  // forgotten one is invisible: the app behaves correctly and the deletion
  // simply never reaches the other device. So it is checked here instead.
  //
  // To add an entry to the allow-list, say why in the code AND here.
  const ALLOWED = new Map([
    [
      'lib/actions.ts',
      {
        count: 9,
        why: 'importUserData replaces an account wholesale from a backup file; ' +
          'tombstoning every row on every restore would keep every generation forever.',
      },
    ],
    [
      'lib/soft-delete.ts',
      { count: 1, why: 'purgeTombstones is the thing that does the real deleting.' },
    ],
  ]);

  test('every raw .delete()/.deleteMany() is accounted for', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');

    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) files.push(full);
      }
    };
    walk(join(ROOT, 'lib'));
    walk(join(ROOT, 'app'));

    const offenders = [];
    for (const file of files) {
      const rel = file.slice(ROOT.length + 1).replaceAll('\\', '/');
      // `prisma.x.delete(` or `tx.x.deleteMany(` - a Prisma model delete, not
      // cookieStore.delete() or a Map/Set delete. `delete(?:Many)?` and not
      // `deleteMany?` - the second reads the same and matches "deleteMan",
      // which let every single-row .delete() through unseen.
      const hits = [...readFileSync(file, 'utf8').matchAll(/\b(?:prisma|tx)\.\w+\.delete(?:Many)?\(/g)];
      if (hits.length === 0) continue;

      const allowed = ALLOWED.get(rel);
      if (!allowed) {
        offenders.push(`${rel}: ${hits.length} raw delete(s), none allowed`);
      } else if (hits.length !== allowed.count) {
        offenders.push(
          `${rel}: ${hits.length} raw delete(s), allow-list says ${allowed.count}`
        );
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'a raw delete cannot sync - use softDelete() from lib/soft-delete.ts, ' +
        'or add a justified entry to ALLOWED above'
    );
  });
});

describe('soft delete against a real database', () => {
  let fleet;
  let db;
  let userId;

  before(async () => {
    fleet = await Fleet.create({ devices: ['A'] });
    userId = fleet.userId;
    // The app's client carries the extension; the harness's does not, so it is
    // applied here to test the same thing the app runs.
    db = fleet.device('A').prisma.$extends(softDeleteExtension());
  });

  after(async () => {
    await fleet?.destroy();
  });

  test('a deleted row is tombstoned, not removed', async () => {
    const template = await db.scheduleTemplate.create({
      data: {
        userId,
        dayOfWeek: 1,
        subject: 'Networking',
        startTime: '20:00',
        endTime: '20:30',
        deadlineDay: 'Monday',
        type: 'HOMEWORK',
      },
    });

    const count = await softDelete(db, 'scheduleTemplate', { id: template.id });
    assert.equal(count, 1, 'softDelete reports how many rows it tombstoned');

    // Gone as far as the app is concerned...
    assert.equal(await db.scheduleTemplate.count({ where: { id: template.id } }), 0);
    assert.equal(await db.scheduleTemplate.findFirst({ where: { id: template.id } }), null);
    assert.equal(await db.scheduleTemplate.findUnique({ where: { id: template.id } }), null);

    // ...but still there, with a date on it, which is what lets a deletion sync.
    const raw = await fleet.device('A').prisma.scheduleTemplate.findUnique({
      where: { id: template.id },
    });
    assert.ok(raw, 'the row itself must survive as a tombstone');
    assert.ok(raw.deletedAt instanceof Date, 'deletedAt must be set');
  });

  test('a query that asks for deleted rows still gets them', async () => {
    // The archive views and the purge job depend on this: saying deletedAt
    // yourself must not be silently overwritten.
    const deleted = await db.scheduleTemplate.findMany({
      where: { userId, deletedAt: { not: null } },
    });
    assert.ok(deleted.length >= 1, 'an explicit deletedAt filter is honoured');
  });

  test('deleting a template tombstones its tasks instead of destroying them', async () => {
    // This is the hazard template-delete.test.mjs reproduces: ON DELETE CASCADE
    // took completed history with it. The cascade still has to happen - the
    // tasks must disappear from the UI - but the rows have to survive.
    const template = await db.scheduleTemplate.create({
      data: {
        userId,
        dayOfWeek: 2,
        subject: 'PHP',
        startTime: '20:00',
        endTime: '21:30',
        deadlineDay: 'Wednesday',
        type: 'HOMEWORK',
      },
    });
    const task = await db.task.create({
      data: {
        userId,
        templateId: template.id,
        date: new Date('2026-09-08T00:00:00Z'),
        subject: 'PHP',
        startTime: '20:00',
        endTime: '21:30',
        type: 'HOMEWORK',
        isDone: true,
      },
    });

    await softDelete(db, 'scheduleTemplate', { id: template.id });

    assert.equal(await db.task.findUnique({ where: { id: task.id } }), null, 'hidden from the app');

    const raw = await fleet.device('A').prisma.task.findUnique({ where: { id: task.id } });
    assert.ok(raw, 'the completed task must not be destroyed');
    assert.ok(raw.deletedAt instanceof Date, 'it is tombstoned, so the delete can sync');
    assert.equal(raw.isDone, true, 'and it still records that the work was done');
  });

  test('the cascade runs to the bottom of the tree', async () => {
    // Class -> Term -> Task is two hops. A one-level cascade would leave the
    // task visible under a year that no longer exists.
    const klass = await db.class.create({ data: { userId, label: 'Year 3' } });
    const term = await db.term.create({
      data: { userId, classId: klass.id, index: 1, name: 'Term 1' },
    });
    const task = await db.task.create({
      data: {
        userId,
        termId: term.id,
        date: new Date('2026-09-09T00:00:00Z'),
        subject: 'Math',
        startTime: '19:00',
        endTime: '21:30',
        type: 'REVISION',
      },
    });

    await softDelete(db, 'class', { id: klass.id });

    assert.equal(await db.term.findUnique({ where: { id: term.id } }), null);
    assert.equal(await db.task.findUnique({ where: { id: task.id } }), null);

    const rawTask = await fleet.device('A').prisma.task.findUnique({ where: { id: task.id } });
    assert.ok(rawTask.deletedAt instanceof Date, 'the grandchild is tombstoned too');
  });

  test('deleting the same row twice is a no-op, not a second tombstone', async () => {
    // Retrying a delete has to be safe: sync replays writes.
    const resource = await db.resource.create({
      data: { userId, subject: 'Physics', title: 'Notes', type: 'LINK', url: 'https://example.com' },
    });

    assert.equal(await softDelete(db, 'resource', { id: resource.id }), 1);
    const first = await fleet.device('A').prisma.resource.findUnique({ where: { id: resource.id } });

    assert.equal(await softDelete(db, 'resource', { id: resource.id }), 0, 'nothing left to delete');
    const second = await fleet.device('A').prisma.resource.findUnique({ where: { id: resource.id } });

    assert.deepEqual(second.deletedAt, first.deletedAt, 'the original time of death stands');
  });
});
