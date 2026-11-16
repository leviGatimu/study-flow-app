/**
 * Blocks the app withdraws (days after the term ends, a routine block moved to
 * another weekday) are written as lib/schedule-sync.ts WITHDRAWN: deleted and
 * detached from their routine slot. Routine blocks sync by template and day,
 * so a withdrawn copy that kept its slot would swallow the block made for that
 * slot later (the term extended again) and delete it on every device.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { applyRows, scrub } from '../../lib/sync/merge.ts';
import { WITHDRAWN } from '../../lib/schedule-sync.ts';

const fleet = await Fleet.create();
after(() => fleet.destroy());

const DAY = new Date('2026-12-07');

const routineBlock = (id) => ({
  id, userId: fleet.userId, templateId: 'tpl-java', date: DAY,
  startTime: '20:00', endTime: '21:00', subject: 'Java', type: 'HOMEWORK',
});

async function send(from, to, direction) {
  const found = await from.prisma.task.findMany({ where: { deletedAt: undefined } });
  const rows = found.map((row) => ({ model: 'task', data: scrub('task', row, direction) }));
  const stamp = new Date();
  return applyRows(to.prisma, rows, { stamp, localDevice: to.name, incomingDevice: from.name, now: stamp });
}

test('a withdrawn block and the block later made for the same slot are both kept', async () => {
  const a = fleet.device('A');
  for (const node of [a, fleet.server]) {
    await node.prisma.scheduleTemplate.create({
      data: { id: 'tpl-java', userId: fleet.userId, dayOfWeek: 1, subject: 'Java', startTime: '20:00', endTime: '21:00', deadlineDay: 'Monday', type: 'HOMEWORK' },
    });
  }

  await a.prisma.task.create({ data: routineBlock('first') });
  await send(a, fleet.server, 'up');

  // The term ends before that day: withdrawn. Then it is extended again and
  // the slot is made afresh.
  await a.prisma.task.update({ where: { id: 'first' }, data: WITHDRAWN });
  await a.prisma.task.create({ data: routineBlock('again') });

  const outcome = await send(a, fleet.server, 'up');
  assert.deepEqual(outcome.remapped, [], 'the new block was folded into the withdrawn one');

  const first = await fleet.server.prisma.task.findUnique({ where: { id: 'first' } });
  const again = await fleet.server.prisma.task.findUnique({ where: { id: 'again' } });
  assert.equal(first.isDeleted, true);
  assert.equal(first.templateId, null);
  assert.equal(again.isDeleted, false);
  assert.equal(again.deletedAt, null);
  assert.equal(again.templateId, 'tpl-java');
});

test('another device\'s copy of that slot merges into the live block, not a second one', async () => {
  const b = fleet.device('B');
  await b.prisma.scheduleTemplate.create({
    data: { id: 'tpl-java', userId: fleet.userId, dayOfWeek: 1, subject: 'Java', startTime: '20:00', endTime: '21:00', deadlineDay: 'Monday', type: 'HOMEWORK' },
  });
  await b.prisma.task.create({ data: routineBlock('b-copy') });

  await send(b, fleet.server, 'up');
  const live = await fleet.server.prisma.task.findMany({ where: { templateId: 'tpl-java', isDeleted: false } });
  assert.equal(live.length, 1, 'the slot has one live block on the server');
});
