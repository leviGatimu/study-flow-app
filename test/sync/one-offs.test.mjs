/**
 * Blocks added by hand have no natural key: two on one day are two blocks.
 * Homework adds one per assignment, so this is an everyday case, not an edge.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { applyRows, scrub } from '../../lib/sync/merge.ts';

const fleet = await Fleet.create();
after(() => fleet.destroy());

const oneOff = (id, subject, startTime, endTime) => ({
  id,
  userId: fleet.userId,
  date: new Date('2026-11-09'),
  startTime,
  endTime,
  subject,
  type: 'HOMEWORK',
});

async function send(from, to, direction, where = {}) {
  const found = await from.prisma.task.findMany({ where: { ...where, deletedAt: undefined } });
  const rows = found.map((row) => ({ model: 'task', data: scrub('task', row, direction) }));
  const stamp = new Date();
  return applyRows(to.prisma, rows, { stamp, localDevice: to.name, incomingDevice: from.name, now: stamp });
}

test('two blocks added by hand on one day stay two blocks across devices', async () => {
  const a = fleet.device('A');
  await a.prisma.task.create({ data: oneOff('math', 'Math', '19:00', '20:00') });
  await a.prisma.task.create({ data: oneOff('physics', 'Physics', '20:00', '21:00') });

  const outcome = await send(a, fleet.server, 'up');
  assert.deepEqual(outcome.remapped, [], 'a block was folded into another one');

  const onServer = await fleet.server.prisma.task.findMany({ orderBy: { startTime: 'asc' } });
  assert.deepEqual(onServer.map((t) => t.subject), ['Math', 'Physics']);
});

test('blocks made separately on two devices for one day are both kept', async () => {
  const b = fleet.device('B');
  await b.prisma.task.create({ data: oneOff('java', 'Java', '21:00', '22:00') });

  const outcome = await send(b, fleet.server, 'up');
  assert.deepEqual(outcome.remapped, []);
  assert.equal(await fleet.server.prisma.task.count(), 3);
});
