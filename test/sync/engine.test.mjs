/**
 * The merge engine, against three real databases.
 *
 * Every test here drives a server and two devices that diverge OFFLINE and then
 * reconnect, because that is the only situation in which a sync bug exists. A
 * merge rule that is only ever exercised in one process is a merge rule that has
 * not been tested.
 *
 * The push/pull HTTP layer is deliberately not mocked or spun up: it is thin,
 * and what it does is call applyRows with a stamp and a device id. That is
 * called directly here, which is what lets a two-device scenario run in four
 * milliseconds instead of needing two servers and a network.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Fleet } from './harness.mjs';
import { applyRows, markSynced, APPLY_ORDER, scrub } from '../../lib/sync/merge.ts';
import { SYNC_RULES, SYNCED_MODELS } from '../../lib/sync/identity.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { Prisma } = require(join(ROOT, 'node_modules', '.prisma', 'client-sqlite-test', 'index.js'));
const camel = (name) => name.charAt(0).toLowerCase() + name.slice(1);

/**
 * Everything one node holds for a model, as the wire would carry it DOWN.
 *
 * The direction matters and getting it wrong is silent: scrubbing a pull as if
 * it were a push strips passwordHash, and the User row then fails to insert on
 * the device because the column is NOT NULL - which showed up as "the account
 * never arrived" rather than as an error.
 */
async function dump(node, model) {
  const rows = await node.prisma[model].findMany({ where: { deletedAt: undefined } });
  return rows.map((row) => ({ model, data: scrub(model, row, 'down') }));
}

/** The device's dirty set: rows the server has not seen. */
async function dirty(node, model) {
  const rows = await node.prisma[model].findMany({
    where: { syncedAt: null, deletedAt: undefined },
  });
  return rows.map((row) => ({ model, data: scrub(model, row, 'up') }));
}

/** Push `device`'s changes into `server`, the way the route does. */
async function push(server, device, models) {
  const rows = [];
  for (const model of models) rows.push(...(await dirty(device, model)));
  const stamp = new Date();
  const outcome = await applyRows(server.prisma, rows, {
    stamp,
    localDevice: 'server',
    incomingDevice: device.name,
    now: stamp,
  });

  // What the client does with the response: adopt remaps, then mark clean.
  const remapped = new Set(outcome.remapped.map((r) => `${r.model}:${r.from}`));
  for (const { model, from } of outcome.remapped) {
    await device.prisma[model].deleteMany({ where: { id: from } });
  }
  for (const row of rows) {
    if (remapped.has(`${row.model}:${row.data.id}`)) continue;
    await markSynced(device.prisma, row.model, row.data.id, row.data.updatedAt, stamp);
  }
  return check(outcome, `push from ${device.name}`);
}

/** Pull everything the server has into `device`. */
async function pull(server, device, models) {
  const rows = [];
  for (const model of models) rows.push(...(await dump(server, model)));
  const stamp = new Date();
  const outcome = await applyRows(device.prisma, rows, {
    stamp,
    localDevice: device.name,
    incomingDevice: 'server',
    now: stamp,
  });
  return check(outcome, `pull into ${device.name}`);
}

/**
 * applyRows collects per-row failures instead of throwing, so one bad row
 * cannot abandon a whole batch halfway. That is right in production and wrong
 * in a test: a swallowed error reads as "nothing happened", which is how a
 * broken pull looked like an empty one for two runs.
 */
function check(outcome, what) {
  assert.deepEqual(
    outcome.errors,
    [],
    `${what} reported errors: ${outcome.errors.map((e) => `${e.model} ${e.id}: ${e.message}`).join('; ')}`
  );
  return outcome;
}

/** A full round for both devices, twice, so each sees the other's work. */
async function syncAll(fleet, models) {
  for (const device of fleet.devices) await push(fleet.server, device, models);
  for (const device of fleet.devices) await pull(fleet.server, device, models);
}

describe('the apply order', () => {
  test('every foreign key points at a model applied earlier', () => {
    const position = new Map(APPLY_ORDER.map((m, i) => [m, i]));
    const problems = [];

    for (const model of Prisma.dmmf.datamodel.models) {
      const child = camel(model.name);
      if (!position.has(child)) continue;

      for (const field of model.fields) {
        // The side that HOLDS the foreign key is the child.
        if (field.kind !== 'object' || field.isList) continue;
        if (!field.relationFromFields?.length) continue;
        const parent = camel(field.type);
        if (!position.has(parent) || parent === child) continue;
        if (position.get(parent) > position.get(child)) {
          problems.push(`${child}.${field.name} -> ${parent} (parent applied later)`);
        }
      }
    }

    assert.deepEqual(
      problems,
      [],
      'APPLY_ORDER in lib/sync/merge.ts must list a parent before anything that references it'
    );
  });

  test('covers exactly the synced models', () => {
    assert.deepEqual([...APPLY_ORDER].sort(), [...SYNCED_MODELS].sort());
  });
});

describe('the file columns', () => {
  test('every column named actually exists on its model', async () => {
    const { FILE_COLUMNS } = await import('../../lib/sync/file-columns.ts');
    const fields = new Map(
      Prisma.dmmf.datamodel.models.map((m) => [camel(m.name), new Set(m.fields.map((f) => f.name))])
    );

    const problems = [];
    for (const [model, columns] of Object.entries(FILE_COLUMNS)) {
      if (!fields.has(model)) {
        problems.push(`${model} is not a model`);
        continue;
      }
      for (const column of columns) {
        if (!fields.get(model).has(column)) problems.push(`${model}.${column}`);
      }
      // The scoping in files.ts assumes this, and an unscoped file query would
      // hand one student another's report cards.
      if (!fields.get(model).has('userId')) problems.push(`${model} has no userId to scope by`);
    }

    assert.deepEqual(problems, [], `lib/sync/file-columns.ts names columns that do not exist: ${problems.join(', ')}`);
  });
});

describe('two devices, one server', () => {
  let fleet;
  let userId;
  const MODELS = ['user', 'class', 'term', 'scheduleTemplate', 'task', 'subject'];

  before(async () => {
    // Seeded on the SERVER only, then pulled down - which is how a real device
    // gets an account, and the reason Stage 4 says the first sign-in has to be
    // online. Creating the same rows independently on each node would give them
    // three different createdAt values and test a situation that cannot happen.
    fleet = await Fleet.create({ devices: ['A', 'B'], seedUser: false });
    userId = 'user_test_levi';
    fleet.userId = userId;

    await fleet.server.prisma.user.create({
      data: { id: userId, username: 'levi', passwordHash: 'not-a-real-hash', currentTerm: 'Term 1' },
    });
    await fleet.server.prisma.class.create({
      data: { id: 'class_1', userId, label: 'Year 1', status: 'ACTIVE' },
    });
    await fleet.server.prisma.term.create({
      data: { id: 'term_1', classId: 'class_1', userId, index: 1, name: 'Term 1', status: 'ACTIVE' },
    });

    for (const device of fleet.devices) await pull(fleet.server, device, MODELS);
  });

  after(async () => {
    await fleet?.destroy();
  });

  test('a row made on A reaches B', async () => {
    await fleet.device('A').prisma.task.create({
      data: {
        id: 'task_travel',
        userId,
        termId: 'term_1',
        date: new Date('2026-09-10'),
        startTime: '20:00',
        endTime: '21:00',
        subject: 'Networking',
        type: 'HOMEWORK',
      },
    });

    await syncAll(fleet, MODELS);

    const onB = await fleet.device('B').prisma.task.findFirst({ where: { id: 'task_travel' } });
    assert.ok(onB, 'the task never arrived on B');
    assert.equal(onB.subject, 'Networking');
  });

  test('the same edit twice changes nothing the second time', async () => {
    const before = await fleet.device('B').prisma.task.count();
    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);
    assert.equal(await fleet.device('B').prisma.task.count(), before);
  });

  test('a deletion on A does not come back from B', async () => {
    // The failure this whole stage exists to prevent: B still has the row, so
    // without a tombstone its next push looks like a creation.
    await fleet.device('A').prisma.task.updateMany({
      where: { id: 'task_travel' },
      data: { deletedAt: new Date(), syncedAt: null },
    });

    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);

    for (const node of fleet.all) {
      const row = await node.prisma.task.findFirst({
        where: { id: 'task_travel', deletedAt: undefined },
      });
      assert.ok(row?.deletedAt, `${node.name} resurrected the deleted task`);
    }
  });

  test('a completed task is not un-completed by a stale device', async () => {
    const base = {
      userId,
      termId: 'term_1',
      date: new Date('2026-09-11'),
      startTime: '19:00',
      endTime: '20:00',
      subject: 'Physics',
      type: 'HOMEWORK',
    };
    for (const node of fleet.all) {
      await node.prisma.task.create({ data: { ...base, id: 'task_done', isDone: false } });
    }

    // A ticks it. B, offline and unaware, saves something else on the row LATER,
    // so plain last-writer-wins would hand B the win and lose the completion.
    await fleet.device('A').prisma.task.updateMany({
      where: { id: 'task_done' },
      data: { isDone: true, updatedAt: new Date('2026-09-11T10:00:00Z'), syncedAt: null },
    });
    await fleet.device('B').prisma.task.updateMany({
      where: { id: 'task_done' },
      data: { workDescription: 'started it', updatedAt: new Date('2026-09-11T12:00:00Z'), syncedAt: null },
    });

    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);

    for (const node of fleet.all) {
      const row = await node.prisma.task.findFirst({ where: { id: 'task_done' } });
      assert.equal(row.isDone, true, `${node.name} lost the completion`);
    }
  });

  test('both devices creating the same subject end up with one', async () => {
    // The certain collision: seedSubjectsIfEmpty runs before a device has ever
    // synced, so each mints its own cuid for the same subject.
    await fleet.device('A').prisma.subject.create({
      data: { id: 'subj_a', userId, classId: 'class_1', name: 'Physics' },
    });
    await fleet.device('B').prisma.subject.create({
      data: { id: 'subj_b', userId, classId: 'class_1', name: 'physics' },
    });

    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);

    for (const node of fleet.all) {
      const rows = await node.prisma.subject.findMany({
        where: { name: { in: ['Physics', 'physics'] } },
      });
      assert.equal(rows.length, 1, `${node.name} has ${rows.length} copies of Physics`);
    }
  });

  test('reconciling a duplicate template keeps the work under it', async () => {
    // ScheduleTemplate -> Task is ON DELETE CASCADE, so resolving the collision
    // by dropping the loser would destroy a completed task.
    for (const [device, id] of [['A', 'tpl_a'], ['B', 'tpl_b']]) {
      await fleet.device(device).prisma.scheduleTemplate.create({
        data: {
          id,
          userId,
          classId: 'class_1',
          dayOfWeek: 1,
          subject: 'Maths',
          startTime: '20:00',
          endTime: '21:00',
          deadlineDay: 'Monday',
          type: 'HOMEWORK',
        },
      });
    }
    await fleet.device('B').prisma.task.create({
      data: {
        id: 'task_under_tpl',
        userId,
        termId: 'term_1',
        templateId: 'tpl_b',
        date: new Date('2026-09-12'),
        startTime: '20:00',
        endTime: '21:00',
        subject: 'Maths',
        type: 'HOMEWORK',
        isDone: true,
        workDescription: 'three past papers',
      },
    });

    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);

    for (const node of fleet.all) {
      const templates = await node.prisma.scheduleTemplate.findMany({
        where: { subject: 'Maths' },
      });
      assert.equal(templates.length, 1, `${node.name} kept ${templates.length} Maths templates`);

      const work = await node.prisma.task.findFirst({ where: { id: 'task_under_tpl' } });
      assert.ok(work, `${node.name} destroyed the completed task with the duplicate`);
      assert.equal(work.isDone, true);
      assert.equal(work.workDescription, 'three past papers');
      assert.equal(work.templateId, templates[0].id, 'the task was not re-parented');
    }
  });

  test('the three nodes agree at the end', async () => {
    await syncAll(fleet, MODELS);
    await syncAll(fleet, MODELS);

    for (const model of MODELS) {
      const difference = await fleet.diff(model, { ignore: ['updatedAt', 'syncedAt'] });
      assert.equal(
        difference,
        null,
        difference &&
          `${model}: ${difference.left} has ${difference.leftCount}, ${difference.right} has ${difference.rightCount}`
      );
    }
  });
});

describe('what must never cross the wire', () => {
  test('a device cannot push a password hash or make itself an admin', () => {
    const up = scrub('user', {
      id: 'u1',
      username: 'levi',
      passwordHash: 'secret',
      isAdmin: true,
    }, 'up');
    assert.equal(up.passwordHash, undefined);
    assert.equal(up.isAdmin, undefined);
  });

  test('but a device DOES receive the hash, or it could never log in offline', () => {
    const down = scrub('user', { id: 'u1', passwordHash: 'secret' }, 'down');
    assert.equal(down.passwordHash, 'secret');
  });

  test('AI keys stay on the machine they were typed on', () => {
    for (const direction of ['up', 'down']) {
      const row = scrub('userProgress', {
        id: 'p1',
        geminiApiKey: 'k1',
        openaiApiKey: 'k2',
        xp: 10,
      }, direction);
      assert.equal(row.geminiApiKey, undefined, direction);
      assert.equal(row.openaiApiKey, undefined, direction);
      assert.equal(row.xp, 10);
    }
  });

  test('syncedAt is never sent - it means different things on each side', () => {
    const row = scrub('task', { id: 't1', syncedAt: new Date() }, 'up');
    assert.equal(row.syncedAt, undefined);
  });
});

describe('XP survives two devices earning offline', () => {
  let fleet;
  let userId;

  before(async () => {
    fleet = await Fleet.create({ devices: ['A', 'B'], seedUser: false });
    userId = 'user_test_levi';
    fleet.userId = userId;
    await fleet.server.prisma.user.create({
      data: { id: userId, username: 'levi', passwordHash: 'not-a-real-hash', currentTerm: 'Term 1' },
    });
    for (const device of fleet.devices) await pull(fleet.server, device, ['user']);
  });
  after(async () => await fleet?.destroy());

  test('a union of the ledgers, not the larger of two totals', async () => {
    await fleet.device('A').prisma.xpEvent.create({
      data: { id: 'xp_a', userId, amount: 100, source: 'TASK', sourceKey: 'task:1' },
    });
    await fleet.device('B').prisma.xpEvent.create({
      data: { id: 'xp_b', userId, amount: 250, source: 'QUIZ', sourceKey: 'quiz:1' },
    });

    await syncAll(fleet, ['user', 'xpEvent']);
    await syncAll(fleet, ['user', 'xpEvent']);

    for (const node of fleet.all) {
      const total = await node.prisma.xpEvent.aggregate({
        where: { userId },
        _sum: { amount: true },
      });
      assert.equal(total._sum.amount, 350, `${node.name} did not end on 350 XP`);
    }
  });

  test('replaying the same grant is a no-op, not a double payment', async () => {
    await syncAll(fleet, ['user', 'xpEvent']);
    const total = await fleet.server.prisma.xpEvent.aggregate({ _sum: { amount: true } });
    assert.equal(total._sum.amount, 350);
  });
});
