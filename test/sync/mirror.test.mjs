/**
 * "Make one side match the other", against real databases: a server and a device
 * that have drifted apart, with the network replaced by direct calls.
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { scrub } from '../../lib/sync/merge.ts';
import { applyMirrorRemovals, applyMirrorRows, chunkRows, MIRROR_MODELS, mirrorReadWhere, planMirror } from '../../lib/sync/mirror.ts';
import { previewMirror, readLocalSnapshot, runMirror, undoMirror } from '../../lib/sync/mirror-client.ts';
import { rowsAccepted } from '../../lib/sync/protocol.ts';

let fleet, device, server, userId;

function remoteFor(node) {
  return {
    async snapshot() {
      const rows = {};
      for (const model of MIRROR_MODELS) {
        const found = await node.prisma[model].findMany({ where: mirrorReadWhere(model, userId) });
        rows[model] = found.map((row) => JSON.parse(JSON.stringify(scrub(model, row, 'down'))));
      }
      return { rows, serverTime: new Date().toISOString() };
    },
    async upsert(rows) {
      return { errors: await applyMirrorRows(node.prisma, rows, new Date()) };
    },
    async remove(model, ids) {
      await applyMirrorRemovals(node.prisma, model, ids, userId, new Date());
    },
  };
}

const block = (id, subject, extra = {}) => ({
  id,
  userId,
  date: new Date('2026-11-09'),
  startTime: '19:00',
  endTime: '20:00',
  subject,
  type: 'HOMEWORK',
  ...extra,
});

const live = (node, model = 'task') => node.prisma[model].findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
const ids = (rows) => rows.map((row) => row.id);

async function mirror(direction) {
  const remote = remoteFor(server);
  const preview = await previewMirror(device.prisma, userId, remote, direction);
  const outcome = await runMirror(device.prisma, userId, remote, direction, preview);
  assert.deepEqual(outcome.errors, []);
  return { preview, outcome };
}

beforeEach(async () => {
  fleet = await Fleet.create({ devices: ['A'] });
  device = fleet.device('A');
  server = fleet.server;
  userId = fleet.userId;
});
afterEach(() => fleet.destroy());

describe('make the web match the desktop', () => {
  test('the web ends up with exactly what the desktop has', async () => {
    await device.prisma.task.create({ data: block('both', 'Desktop title') });
    await server.prisma.task.create({ data: block('both', 'Web title') });
    await device.prisma.task.create({ data: block('desktop-only', 'Math') });
    await server.prisma.task.create({ data: block('web-only', 'Physics') });

    const { preview } = await mirror('web-matches-desktop');
    assert.deepEqual(preview.plan.counts, [{ model: 'task', add: 1, change: 1, remove: 1 }]);

    assert.deepEqual(ids(await live(server)), ['both', 'desktop-only']);
    assert.equal((await server.prisma.task.findFirst({ where: { id: 'both' } })).subject, 'Desktop title');
  });

  test('it overrides what normal sync protects: finished blocks and deletions', async () => {
    await device.prisma.task.create({ data: block('undone', 'Math') });
    await server.prisma.task.create({ data: block('undone', 'Math', { isDone: true }) });
    await device.prisma.task.create({ data: block('revived', 'Java') });
    await server.prisma.task.create({ data: block('revived', 'Java', { deletedAt: new Date() }) });

    await mirror('web-matches-desktop');

    assert.equal((await server.prisma.task.findFirst({ where: { id: 'undone' } })).isDone, false);
    assert.equal((await server.prisma.task.findFirst({ where: { id: 'revived' } })).subject, 'Java');
  });

  test('removed rows are tombstones, so they can come back', async () => {
    await server.prisma.task.create({ data: block('web-only', 'Physics') });
    await mirror('web-matches-desktop');
    const row = await server.prisma.task.findFirst({ where: { id: 'web-only', deletedAt: undefined } });
    assert.ok(row.deletedAt);
  });

  test('nothing is left waiting to go up, and a second run does nothing', async () => {
    await device.prisma.task.create({ data: block('a', 'Math') });
    await mirror('web-matches-desktop');
    assert.equal(await device.prisma.task.count({ where: { syncedAt: null } }), 0);

    const { preview } = await mirror('web-matches-desktop');
    assert.deepEqual(preview.plan.counts, []);
    assert.deepEqual(preview.plan.upserts, []);
  });

  test('a subject under two ids becomes one, and what points at it follows', async () => {
    await device.prisma.subject.create({ data: { id: 'local-sub', userId, name: 'physics' } });
    await server.prisma.subject.create({ data: { id: 'server-sub', userId, name: 'Physics' } });
    await device.prisma.examEvent.create({
      data: { id: 'exam', userId, title: 'Midterm', date: new Date('2026-12-01'), subjectId: 'local-sub' },
    });

    await mirror('web-matches-desktop');

    assert.deepEqual(ids(await live(device, 'subject')), ['server-sub']);
    assert.equal((await device.prisma.examEvent.findFirst({ where: { id: 'exam' } })).subjectId, 'server-sub');
    assert.equal((await server.prisma.examEvent.findFirst({ where: { id: 'exam' } })).subjectId, 'server-sub');
    assert.equal((await server.prisma.subject.findFirst({ where: { id: 'server-sub' } })).name, 'physics');
  });
});

describe('make the desktop match the web', () => {
  test('the desktop ends up with exactly what the web has', async () => {
    await device.prisma.task.create({ data: block('both', 'Desktop title') });
    await server.prisma.task.create({ data: block('both', 'Web title') });
    await device.prisma.task.create({ data: block('desktop-only', 'Math') });
    await server.prisma.task.create({ data: block('web-only', 'Physics') });

    await mirror('desktop-matches-web');

    assert.deepEqual(ids(await live(device)), ['both', 'web-only']);
    assert.equal((await device.prisma.task.findFirst({ where: { id: 'both' } })).subject, 'Web title');
    assert.equal(await device.prisma.task.count({ where: { syncedAt: null } }), 0);
  });

  test('a homework and its block arrive linked', async () => {
    await server.prisma.task.create({ data: block('block', 'Math') });
    await server.prisma.homework.create({
      data: { id: 'hw', userId, subject: 'Math', title: 'Set 1', dueDate: new Date('2026-11-10'), taskId: 'block' },
    });
    await mirror('desktop-matches-web');
    assert.equal((await device.prisma.homework.findFirst({ where: { id: 'hw' } })).taskId, 'block');
  });

  test('a deleted parent a kept row still points at comes across too', async () => {
    await server.prisma.subject.create({ data: { id: 'old-sub', userId, name: 'Old', deletedAt: new Date() } });
    await server.prisma.examEvent.create({
      data: { id: 'exam', userId, title: 'Midterm', date: new Date('2026-12-01'), subjectId: 'old-sub' },
    });
    await mirror('desktop-matches-web');
    assert.equal((await device.prisma.examEvent.findFirst({ where: { id: 'exam' } })).subjectId, 'old-sub');
  });

  test('API keys typed on this machine are not wiped', async () => {
    await device.prisma.userProgress.create({ data: { id: 'p-local', userId, geminiApiKey: 'typed-here' } });
    await server.prisma.userProgress.create({ data: { id: 'p-server', userId, longestStreak: 50 } });
    await mirror('desktop-matches-web');
    const after = await device.prisma.userProgress.findFirst({ where: { userId } });
    assert.equal(after.geminiApiKey, 'typed-here');
    assert.equal(after.longestStreak, 50);
    assert.equal(after.id, 'p-server');
  });
});

describe('undo', () => {
  test('puts both sides back, with waiting changes still waiting', async () => {
    await device.prisma.task.create({ data: block('desktop-only', 'Math') });
    await server.prisma.task.create({ data: block('web-only', 'Physics') });

    const remote = remoteFor(server);
    const preview = await previewMirror(device.prisma, userId, remote, 'web-matches-desktop');
    const backup = {
      at: new Date().toISOString(),
      direction: 'web-matches-desktop',
      local: preview.local.rows,
      remote: preview.server.rows,
      dirty: preview.local.dirty,
      cursor: { at: null, id: null },
    };
    await runMirror(device.prisma, userId, remote, 'web-matches-desktop', preview);
    assert.deepEqual(ids(await live(server)), ['desktop-only']);

    const { errors } = await undoMirror(device.prisma, userId, remote, backup);
    assert.deepEqual(errors, []);

    assert.deepEqual(ids(await live(server)), ['web-only']);
    assert.deepEqual(ids(await live(device)), ['desktop-only']);
    assert.equal((await device.prisma.task.findFirst({ where: { id: 'desktop-only' } })).syncedAt, null);
  });
});

describe('the plan', () => {
  test('warns when copying from a side with almost nothing', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, subject: 'Math', deletedAt: null }));
    assert.equal(planMirror({ task: [] }, { task: many }, 'none').sourceLooksEmpty, true);
    assert.equal(planMirror({ task: many }, { task: many }, 'none').sourceLooksEmpty, false);
  });

  test('blocks added by hand are never paired by their date', () => {
    const date = '2026-11-09T00:00:00.000Z';
    const plan = planMirror(
      { task: [{ id: 'a', userId: 'u', templateId: null, examId: null, date, subject: 'Math', deletedAt: null }] },
      { task: [{ id: 'b', userId: 'u', templateId: null, examId: null, date, subject: 'Java', deletedAt: null }] },
      'source'
    );
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.removals[0].ids[0], 'b');
  });

  test('dates pair as instants however they were written', () => {
    const plan = planMirror(
      { task: [{ id: 'a', userId: 'u', templateId: 't', examId: null, date: '2026-11-09T00:00:00.000Z', deletedAt: null }] },
      { task: [{ id: 'b', userId: 'u', templateId: 't', examId: null, date: '2026-11-09T00:00:00Z', deletedAt: null }] },
      'source'
    );
    assert.deepEqual(plan.renames, [{ model: 'task', from: 'a', to: 'b' }]);
  });

  test('a preview writes nothing', async () => {
    await device.prisma.task.create({ data: block('a', 'Math') });
    await previewMirror(device.prisma, userId, remoteFor(server), 'web-matches-desktop');
    assert.equal(await server.prisma.task.count(), 0);
    assert.equal((await readLocalSnapshot(device.prisma, userId)).dirty.length, 1);
  });
});

describe('sending in pieces', () => {
  test('splits by count and by size, keeping order', () => {
    assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    const big = 'x'.repeat(60);
    assert.equal(chunkRows([big, big, big], 100, 130).length, 2);
    assert.deepEqual(chunkRows([]), []);
  });

  test('one row larger than the limit still goes, alone', () => {
    const huge = 'x'.repeat(500);
    assert.deepEqual(chunkRows(['a', huge, 'b'], 100, 100).map((c) => c.length), [1, 1, 1]);
  });

  test('a row the server refused stays waiting to be sent', () => {
    const rows = [{ model: 'task', data: { id: 'ok' } }, { model: 'task', data: { id: 'bad' } }, { model: 'task', data: { id: 'moved' } }];
    const accepted = rowsAccepted(rows, {
      errors: [{ model: 'task', id: 'bad', message: 'nope' }],
      remapped: [{ model: 'task', from: 'moved', to: 'other' }],
    });
    assert.deepEqual(accepted.map((r) => r.data.id), ['ok']);
  });
});
