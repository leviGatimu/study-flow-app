/**
 * The known sync hazards, written as tests BEFORE the sync engine exists.
 *
 * Each test drives two devices apart the way the real app does, then asserts
 * the damage that a naive last-writer-wins merge would cause. They are not
 * failing tests - they PASS today, because today they describe reality. When
 * the merge engine lands, the assertions marked FIXME flip to the merged
 * outcome, and these become the regression suite that proves it works.
 *
 * Every scenario here came out of reading the actual code paths, not from
 * imagination - the file:line references say where.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';

const DAY = '2026-09-07T00:00:00.000Z';

let fleet;

before(async () => {
  fleet = await Fleet.create({ devices: ['A', 'B'] });
});

after(async () => {
  await fleet?.destroy();
});

describe('harness', () => {
  test('builds an isolated database per node from the real migrations', async () => {
    for (const node of fleet.all) {
      // 29 tables exist and are queryable through the real Prisma client.
      assert.equal(await node.count('user'), 1, `${node.name} has the seeded user`);
      assert.equal(await node.count('task'), 0, `${node.name} starts empty`);
    }
    assert.equal(fleet.all.length, 3, 'server + 2 devices');
  });

  test('nodes are genuinely isolated - a write on A is invisible to B', async () => {
    await fleet.device('A').prisma.stickyNote.create({
      data: { userId: fleet.userId, title: 'only on A', content: 'x' },
    });

    assert.equal(await fleet.device('A').count('stickyNote'), 1);
    assert.equal(await fleet.device('B').count('stickyNote'), 0);
    assert.equal(await fleet.server.count('stickyNote'), 0);

    const diff = await fleet.diff('stickyNote');
    assert.ok(diff, 'diff() reports the divergence');
    assert.equal(diff.model, 'stickyNote');
  });
});

describe('hazard: generated tasks duplicate silently', () => {
  // ensureTasksGenerated (lib/actions.ts) dedupes on `templateId|dateKey` in
  // APPLICATION memory. There is no unique constraint on Task, so two devices
  // each generating the same day produce two rows and nothing errors.
  test('both devices generate the same block; nothing stops them', async () => {
    const templateId = 'tpl_monday_networking';

    for (const device of fleet.devices) {
      await device.prisma.scheduleTemplate.create({
        data: {
          id: templateId, // same template, already synced to both
          userId: fleet.userId,
          dayOfWeek: 1,
          subject: 'Networking',
          startTime: '20:00',
          endTime: '20:30',
          deadlineDay: 'Monday',
          type: 'HOMEWORK',
        },
      });

      // Each device's own generation pass: it looks for an existing task for
      // (templateId, date) IN ITS OWN DATABASE, finds none, and creates one.
      const existing = await device.prisma.task.findMany({
        where: { userId: fleet.userId, templateId, date: new Date(DAY) },
      });
      assert.equal(existing.length, 0, `${device.name} sees no existing block`);

      await device.prisma.task.create({
        data: {
          userId: fleet.userId,
          templateId,
          date: new Date(DAY),
          startTime: '20:00',
          endTime: '20:30',
          subject: 'Networking',
          type: 'HOMEWORK',
        },
      });
    }

    const [a, b] = fleet.devices;
    const taskA = (await a.rows('task'))[0];
    const taskB = (await b.rows('task'))[0];

    // Same logical block, different random ids. This is the whole problem.
    assert.notEqual(taskA.id, taskB.id, 'the two devices minted different ids');
    assert.equal(taskA.templateId, taskB.templateId);
    assert.deepEqual(taskA.date, taskB.date);

    // FIXME(sync): after the merge engine lands, merging A and B must yield
    // ONE task, matched on the natural key (userId, templateId, date).
    const naturalKey = (t) => `${t.userId}|${t.templateId}|${t.date.toISOString()}`;
    assert.equal(
      naturalKey(taskA),
      naturalKey(taskB),
      'natural key identifies them as the same block'
    );
  });
});

describe('hazard: subject auto-seeding collides on first sync', () => {
  // seedSubjectsIfEmpty (lib/subject-actions.ts) populates Subject from other
  // tables whenever the table is empty. A fresh desktop install does this
  // BEFORE it has ever synced, so it mints its own id for a subject the server
  // already has under the same (userId, name).
  test('same name, different ids, and the unique key proves they are one row', async () => {
    for (const device of fleet.devices) {
      await device.prisma.subject.create({
        data: { userId: fleet.userId, name: 'Physics' },
      });
    }

    const [a, b] = fleet.devices;
    const subjectA = (await a.rows('subject'))[0];
    const subjectB = (await b.rows('subject'))[0];

    assert.notEqual(subjectA.id, subjectB.id);
    assert.equal(subjectA.name, subjectB.name);

    // Inserting B's row into A's database - what a naive id-keyed push does -
    // violates @@unique([userId, name]).
    await assert.rejects(
      () => a.prisma.subject.create({ data: { id: subjectB.id, userId: fleet.userId, name: 'Physics' } }),
      /Unique constraint|UNIQUE/i,
      'an id-keyed insert hits the natural-key constraint'
    );
  });

  test('case variants defeat the unique constraint entirely', async () => {
    // normalizeSubject (lib/utils.ts) strips "(revision)" and apostrophes but
    // does NOT lowercase, and Postgres unique constraints are case-sensitive.
    const a = fleet.device('A');
    await a.prisma.subject.create({ data: { userId: fleet.userId, name: 'physics' } });

    const names = (await a.rows('subject')).map((s) => s.name).sort();
    assert.deepEqual(
      names,
      ['Physics', 'physics'],
      'two rows for one subject - the constraint does not see these as equal'
    );
  });
});

describe('hazard: cascade deletes destroy history', () => {
  // Class -> Term -> Task and ScheduleTemplate -> Task are onDelete: Cascade.
  // Any merge that resolves a duplicate by deleting the loser takes real work
  // with it. This proves the blast radius.
  test('deleting a duplicate template deletes its completed task history', async () => {
    const device = fleet.device('B');

    const template = await device.prisma.scheduleTemplate.create({
      data: {
        userId: fleet.userId,
        dayOfWeek: 3,
        subject: 'Physics',
        startTime: '19:00',
        endTime: '21:30',
        deadlineDay: 'Friday',
        type: 'HOMEWORK',
      },
    });

    await device.prisma.task.create({
      data: {
        userId: fleet.userId,
        templateId: template.id,
        date: new Date(DAY),
        startTime: '19:00',
        endTime: '21:30',
        subject: 'Physics',
        type: 'HOMEWORK',
        isDone: true,
        workDescription: 'Finished all 12 problems',
        proofPdfUrl: '/uploads/proof-123-physics.pdf',
      },
    });

    const before = await device.prisma.task.count({
      where: { templateId: template.id, isDone: true },
    });
    assert.equal(before, 1, 'the completed task exists');

    // The naive merge: "these two templates are duplicates, drop one".
    await device.prisma.scheduleTemplate.delete({ where: { id: template.id } });

    const after = await device.prisma.task.count({
      where: { templateId: template.id, isDone: true },
    });
    assert.equal(
      after,
      0,
      'CASCADE took the completed work, the description and the proof-of-work URL with it'
    );
  });
});

describe('hazard: XP is a running total with no ledger', () => {
  // lib/gamification.ts addXp() is read-modify-write on UserProgress.xp, and
  // no per-grant record exists anywhere. Last-writer-wins does not merely fail
  // to add the two devices' earnings - it erases one side's.
  test('two devices earning offline: LWW keeps one total and loses the other', async () => {
    for (const device of fleet.devices) {
      await device.prisma.userProgress.create({
        data: { userId: fleet.userId, name: 'Levi', xp: 1000, level: 5 },
      });
    }

    const [a, b] = fleet.devices;
    // A completes two tasks (+200). B completes three (+300).
    await a.prisma.userProgress.update({
      where: { userId: fleet.userId },
      data: { xp: 1200 },
    });
    await b.prisma.userProgress.update({
      where: { userId: fleet.userId },
      data: { xp: 1300 },
    });

    const xpA = (await a.rows('userProgress'))[0].xp;
    const xpB = (await b.rows('userProgress'))[0].xp;

    assert.equal(xpA, 1200);
    assert.equal(xpB, 1300);

    // The truthful merged total is 1000 + 200 + 300 = 1500. Whichever row LWW
    // picks, the answer is wrong and the difference is unrecoverable, because
    // nothing records WHERE the xp came from.
    const lwwWinner = Math.max(xpA, xpB);
    assert.equal(lwwWinner, 1300);
    assert.notEqual(lwwWinner, 1500, 'LWW silently destroys 200 XP');

    // FIXME(sync): with an append-only XP ledger, or delta-based merge, this
    // must come out at 1500.
  });
});
