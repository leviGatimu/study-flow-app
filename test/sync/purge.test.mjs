/**
 * The tombstone purge, against a real SQLite database (audit D16).
 *
 * The purge swept EVERY model, including SyncState, which has no deletedAt
 * column. Prisma rejected that query with "Unknown argument `deletedAt`"
 * part-way through the sweep, after the models before it had already been
 * purged. The dry-run script had the same bug.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { purgeTombstones, tombstoneModels } from '../../lib/soft-delete.ts';
import { Fleet } from './harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { Prisma } = require(join(ROOT, 'node_modules', '.prisma', 'client-sqlite-test', 'index.js'));

const ALL = Prisma.dmmf.datamodel.models.map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1));
const SWEEPABLE = tombstoneModels(Prisma.dmmf.datamodel.models);

describe('purgeTombstones', () => {
  let fleet;
  let db;

  before(async () => {
    fleet = await Fleet.create({ devices: ['A'] });
    db = fleet.device('A').prisma;
  });

  after(async () => {
    await fleet?.destroy();
  });

  test('the sweepable list excludes models without deletedAt', () => {
    assert.ok(ALL.includes('syncState'));
    assert.ok(!SWEEPABLE.includes('syncState'));
    assert.ok(SWEEPABLE.includes('task'));
  });

  test('sweeping every model fails, as the audit found', async () => {
    await assert.rejects(() => purgeTombstones(db, ALL, 0), /deletedAt/);
  });

  test('sweeping the tombstone models removes old tombstones and keeps live rows', async () => {
    const userId = fleet.userId;
    const base = { userId, dayOfWeek: 1, startTime: '20:00', endTime: '20:30', deadlineDay: 'Monday', type: 'HOMEWORK' };
    const old = await db.scheduleTemplate.create({ data: { ...base, subject: 'Old', deletedAt: new Date('2020-01-01') } });
    const live = await db.scheduleTemplate.create({ data: { ...base, subject: 'Live' } });

    const removed = await purgeTombstones(db, SWEEPABLE);

    assert.equal(removed.scheduleTemplate, 1);
    assert.equal(await db.scheduleTemplate.findUnique({ where: { id: old.id } }), null);
    assert.ok(await db.scheduleTemplate.findUnique({ where: { id: live.id } }));
  });

  test('every sweepable model accepts the dry-run count query', async () => {
    for (const model of SWEEPABLE) {
      await db[model].count({ where: { deletedAt: { lt: new Date() } } });
    }
  });
});
