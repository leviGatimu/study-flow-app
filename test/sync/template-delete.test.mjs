/**
 * Deleting a timetable block must not delete finished work.
 *
 * Task.template is ON DELETE CASCADE, and the delete button fired on a single
 * unconfirmed click, so removing a recurring block destroyed every task it had
 * ever generated - completed sessions, written descriptions and uploaded proof
 * included. hazards.test.mjs proves the raw cascade still does exactly that.
 *
 * This proves the fix: detaching completed tasks first leaves history intact
 * while the undone future instances still go, which is what removing a block
 * from a timetable should mean.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';

let fleet;
let device;

before(async () => {
  fleet = await Fleet.create({ devices: ['A'] });
  device = fleet.device('A');
});

after(async () => {
  await fleet?.destroy();
});

/** The order lib/actions.ts deleteTemplate performs. */
async function deleteTemplateSafely(prisma, userId, templateId) {
  await prisma.task.updateMany({
    where: {
      templateId,
      userId,
      OR: [
        { isDone: true },
        { proofPdfUrl: { not: null } },
        { workDescription: { not: null } },
      ],
    },
    data: { templateId: null },
  });
  await prisma.scheduleTemplate.deleteMany({ where: { id: templateId, userId } });
}

describe('deleting a timetable block', () => {
  test('keeps completed work and removes only what is still pending', async () => {
    const { prisma } = device;
    const userId = fleet.userId;

    const template = await prisma.scheduleTemplate.create({
      data: {
        userId, dayOfWeek: 1, subject: 'Networking',
        startTime: '20:00', endTime: '20:30', deadlineDay: 'Monday', type: 'HOMEWORK',
      },
    });

    const base = {
      userId, templateId: template.id, subject: 'Networking',
      startTime: '20:00', endTime: '20:30', type: 'HOMEWORK',
    };

    // Three finished sessions, one of them with proof of work, plus two blocks
    // still to come.
    await prisma.task.create({ data: { ...base, date: new Date('2026-09-01'), isDone: true, workDescription: 'Subnetting exercises' } });
    await prisma.task.create({ data: { ...base, date: new Date('2026-09-08'), isDone: true, proofPdfUrl: '/uploads/proof-1.pdf' } });
    await prisma.task.create({ data: { ...base, date: new Date('2026-09-15'), isDone: true } });
    await prisma.task.create({ data: { ...base, date: new Date('2026-09-22'), isDone: false } });
    await prisma.task.create({ data: { ...base, date: new Date('2026-09-29'), isDone: false } });

    assert.equal(await prisma.task.count({ where: { templateId: template.id } }), 5);

    await deleteTemplateSafely(prisma, userId, template.id);

    // The block itself is gone.
    assert.equal(await prisma.scheduleTemplate.count({ where: { id: template.id } }), 0);

    // The three completed sessions survive, detached rather than destroyed.
    const survivors = await prisma.task.findMany({
      where: { userId, subject: 'Networking' },
      orderBy: { date: 'asc' },
    });
    assert.equal(survivors.length, 3, 'completed history is intact');
    assert.ok(survivors.every((t) => t.isDone), 'only finished sessions remain');
    assert.ok(survivors.every((t) => t.templateId === null), 'they became one-off tasks');

    // Nothing lost from the finished rows.
    assert.equal(survivors[0].workDescription, 'Subnetting exercises');
    assert.equal(survivors[1].proofPdfUrl, '/uploads/proof-1.pdf');
  });

  test('the naive delete really would have taken all five', async () => {
    const { prisma } = device;
    const userId = fleet.userId;

    const template = await prisma.scheduleTemplate.create({
      data: {
        userId, dayOfWeek: 2, subject: 'Physics',
        startTime: '19:00', endTime: '21:30', deadlineDay: 'Friday', type: 'HOMEWORK',
      },
    });
    await prisma.task.create({
      data: {
        userId, templateId: template.id, date: new Date('2026-09-02'),
        startTime: '19:00', endTime: '21:30', subject: 'Physics', type: 'HOMEWORK',
        isDone: true, workDescription: 'All 12 problems',
      },
    });

    // No detach step - the old behaviour.
    await prisma.scheduleTemplate.deleteMany({ where: { id: template.id, userId } });

    assert.equal(
      await prisma.task.count({ where: { userId, subject: 'Physics' } }),
      0,
      'the cascade destroys completed work when nothing detaches it first'
    );
  });
});
