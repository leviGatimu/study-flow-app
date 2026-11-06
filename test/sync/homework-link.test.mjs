/**
 * A homework and its schedule block have to travel together: Homework.taskId is
 * a foreign key, so the block must be applied first on every side.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { applyRows, markSynced, scrub } from '../../lib/sync/merge.ts';

const MODELS = ['task', 'homework'];

async function send(from, to, direction) {
  const rows = [];
  for (const model of MODELS) {
    const found = await from.prisma[model].findMany({
      where: { ...(direction === 'up' ? { syncedAt: null } : {}), deletedAt: undefined },
    });
    rows.push(...found.map((row) => ({ model, data: scrub(model, row, direction) })));
  }
  const stamp = new Date();
  const outcome = await applyRows(to.prisma, rows, { stamp, localDevice: to.name, incomingDevice: from.name, now: stamp });
  assert.deepEqual(outcome.errors, []);
  if (direction === 'up') {
    for (const row of rows) await markSynced(from.prisma, row.model, row.data.id, row.data.updatedAt, stamp);
  }
}

let fleet;
before(async () => {
  fleet = await Fleet.create();
  const userId = fleet.userId;
  const a = fleet.device('A').prisma;
  await a.task.create({
    data: { id: 'block_1', userId, date: new Date('2026-11-09'), startTime: '19:00', endTime: '20:00', subject: 'Math', type: 'HOMEWORK' },
  });
  await a.homework.create({
    data: { id: 'hw_1', userId, subject: 'Math', title: 'Set 4', dueDate: new Date('2026-11-10'), plannedDate: new Date('2026-11-09'), taskId: 'block_1' },
  });
});
after(() => fleet.destroy?.());

test('homework arrives on another device still linked to its block', async () => {
  await send(fleet.device('A'), fleet.server, 'up');
  await send(fleet.server, fleet.device('B'), 'down');

  const onB = await fleet.device('B').prisma.homework.findFirst({ where: { id: 'hw_1' }, include: { task: true } });
  assert.equal(onB.taskId, 'block_1');
  assert.equal(onB.task.startTime, '19:00');
});

test('moving the block on one device reaches the other through the link', async () => {
  const b = fleet.device('B').prisma;
  await b.task.update({ where: { id: 'block_1' }, data: { startTime: '21:00', endTime: '22:00', syncedAt: null } });

  await send(fleet.device('B'), fleet.server, 'up');
  await send(fleet.server, fleet.device('A'), 'down');

  const onA = await fleet.device('A').prisma.homework.findFirst({ where: { id: 'hw_1' }, include: { task: true } });
  assert.equal(onA.task.startTime, '21:00');
});
