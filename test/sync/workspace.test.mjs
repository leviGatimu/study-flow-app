/**
 * Chats, branches and practice sync between devices (owner decision D-2,
 * docs/STUDY_WORKSPACE_PLAN.md), and a pushed row owned through a parent can
 * never land in another account.
 *
 * Real SQLite databases built from the real migrations, via the harness.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { applyRows, markSynced, scrub } from '../../lib/sync/merge.ts';
import { keepOwnedRows } from '../../lib/sync/ownership.ts';

const MODELS = ['tutorModule', 'quizAttempt', 'chatSession', 'chatMessage', 'attemptDraft', 'aiAction'];

async function dirty(node, model) {
  const rows = await node.prisma[model].findMany({ where: { syncedAt: null } });
  return rows.map((row) => ({ model, data: scrub(model, row, 'up') }));
}

async function push(server, device, userId) {
  const rows = [];
  for (const model of MODELS) rows.push(...(await dirty(device, model)));
  // What the route does: owner overwrite, then the parent-ownership filter.
  for (const row of rows) if ('userId' in row.data) row.data.userId = userId;
  const owned = await keepOwnedRows(server.prisma, rows, userId);
  const stamp = new Date();
  const outcome = await applyRows(server.prisma, owned.rows, {
    stamp, localDevice: 'server', incomingDevice: device.name, now: stamp,
  });
  assert.deepEqual(outcome.errors, []);
  const remapped = new Set(outcome.remapped.map((r) => `${r.model}:${r.from}`));
  for (const { model, from } of outcome.remapped) await device.prisma[model].deleteMany({ where: { id: from } });
  for (const row of owned.rows) {
    if (remapped.has(`${row.model}:${row.data.id}`)) continue;
    await markSynced(device.prisma, row.model, row.data.id, row.data.updatedAt, stamp);
  }
  return { outcome, dropped: owned.dropped };
}

async function pull(server, device) {
  const rows = [];
  for (const model of MODELS) {
    for (const row of await server.prisma[model].findMany()) rows.push({ model, data: scrub(model, row, 'down') });
  }
  const stamp = new Date();
  const outcome = await applyRows(device.prisma, rows, {
    stamp, localDevice: device.name, incomingDevice: 'server', now: stamp,
  });
  assert.deepEqual(outcome.errors, []);
}

describe('study workspace sync', () => {
  let fleet;
  let userId;

  before(async () => {
    fleet = await Fleet.create({ devices: ['A', 'B'] });
    userId = fleet.userId;
  });

  after(async () => {
    await fleet?.destroy();
  });

  test('a chat, its branch, a set, an attempt and a draft travel A -> server -> B', async () => {
    const A = fleet.device('A').prisma;
    const set = await A.tutorModule.create({ data: { userId, subject: 'Physics', title: 'Forces', questions: '[]' } });
    const chat = await A.chatSession.create({ data: { userId, title: 'Forces', mode: 'ASK' } });
    const first = await A.chatMessage.create({ data: { sessionId: chat.id, role: 'user', content: 'Explain forces', requestId: 'r1' } });
    const branch = await A.chatSession.create({
      data: { userId, title: 'Quiz: forces', parentSessionId: chat.id, parentMessageId: first.id, branchKind: 'QUIZ', artifactId: set.id },
    });
    await A.quizAttempt.create({ data: { moduleId: set.id, score: 70, feedback: '[]', markingStatus: 'PARTIAL' } });
    await A.attemptDraft.create({ data: { userId, moduleId: set.id, mode: 'EXAM', answers: '{"q1":"x"}' } });
    await A.aiAction.create({ data: { userId, sessionId: chat.id, tool: 'createStudyBlock', input: '{}', idempotencyKey: `${userId}:k1` } });

    await push(fleet.server, fleet.device('A'), userId);
    await pull(fleet.server, fleet.device('B'));

    const B = fleet.device('B').prisma;
    const got = await B.chatSession.findUnique({ where: { id: branch.id } });
    assert.equal(got.parentSessionId, chat.id);
    assert.equal(got.parentMessageId, first.id);
    assert.equal(got.branchKind, 'QUIZ');
    assert.equal((await B.chatMessage.findUnique({ where: { id: first.id } })).requestId, 'r1');
    assert.equal((await B.quizAttempt.findFirst({ where: { moduleId: set.id } })).markingStatus, 'PARTIAL');
    assert.equal((await B.attemptDraft.findFirst({ where: { moduleId: set.id } })).answers, '{"q1":"x"}');
    assert.equal(await B.aiAction.count(), 1);
  });

  test('the same set started on two devices merges into one draft', async () => {
    const A = fleet.device('A').prisma;
    const B = fleet.device('B').prisma;
    const set = await A.tutorModule.create({ data: { userId, subject: 'Maths', title: 'Ratios', questions: '[]' } });
    await push(fleet.server, fleet.device('A'), userId);
    await pull(fleet.server, fleet.device('B'));

    await A.attemptDraft.create({ data: { userId, moduleId: set.id, mode: 'PRACTICE', answers: '{"a":"1"}' } });
    await B.attemptDraft.create({ data: { userId, moduleId: set.id, mode: 'PRACTICE', answers: '{"b":"2"}' } });
    await push(fleet.server, fleet.device('A'), userId);
    await push(fleet.server, fleet.device('B'), userId);

    assert.equal(await fleet.server.prisma.attemptDraft.count({ where: { moduleId: set.id, mode: 'PRACTICE' } }), 1);
  });
});

describe('parent-owned rows cannot cross accounts', () => {
  let fleet;
  let levi;
  const mallory = 'user_test_mallory';

  before(async () => {
    fleet = await Fleet.create({ devices: ['A'] });
    levi = fleet.userId;
    await fleet.server.prisma.user.create({ data: { id: mallory, username: 'mallory', passwordHash: 'x' } });
  });

  after(async () => {
    await fleet?.destroy();
  });

  test('a message into someone else\'s chat is dropped; own and same-batch parents are kept', async () => {
    const server = fleet.server.prisma;
    const theirs = await server.chatSession.create({ data: { userId: mallory, title: 'private' } });
    const mine = await server.chatSession.create({ data: { userId: levi, title: 'mine' } });
    const msg = (id, sessionId) => ({ model: 'chatMessage', data: { id, sessionId, role: 'user', content: 'hi' } });

    const rows = [
      msg('m1', theirs.id),
      msg('m2', mine.id),
      { model: 'chatSession', data: { id: 'new-chat', userId: levi, title: 'new' } },
      msg('m3', 'new-chat'),
      msg('m4', 'no-such-chat'),
      { model: 'quizAttempt', data: { id: 'qa', moduleId: 'no-such-set', score: 1, feedback: '[]' } },
    ];
    const kept = await keepOwnedRows(server, rows, levi);
    assert.deepEqual(kept.rows.map((r) => r.data.id), ['m2', 'new-chat', 'm3']);
    assert.equal(kept.dropped, 3);
  });

  test('a batch parent claiming another owner does not vouch for its children', async () => {
    const rows = [
      { model: 'chatSession', data: { id: 'spoof', userId: mallory, title: 'x' } },
      { model: 'chatMessage', data: { id: 'm5', sessionId: 'spoof', role: 'user', content: 'x' } },
    ];
    const kept = await keepOwnedRows(fleet.server.prisma, rows, levi);
    assert.deepEqual(kept.rows.map((r) => r.data.id), ['spoof']);
  });

  test('a pushed row reusing another account’s id is dropped, not merged over theirs', async () => {
    const server = fleet.server.prisma;
    const exam = await server.examEvent.create({ data: { userId: mallory, title: 'Secret exam', date: new Date() } });
    const chat = await server.chatSession.create({ data: { userId: mallory, title: 'private' } });
    const message = await server.chatMessage.create({ data: { sessionId: chat.id, role: 'user', content: 'private' } });
    const own = await server.chatSession.create({ data: { userId: levi, title: 'mine again' } });

    const rows = [
      { model: 'examEvent', data: { ...exam, userId: levi, title: 'HIJACKED' } },
      { model: 'chatSession', data: { ...chat, userId: levi } },
      // Re-parenting someone else's message into my chat is a takeover too.
      { model: 'chatMessage', data: { ...message, sessionId: own.id } },
      { model: 'chatSession', data: { ...own, title: 'renamed' } },
    ];
    const kept = await keepOwnedRows(server, rows, levi);
    assert.deepEqual(kept.rows.map((r) => r.data.id), [own.id]);

    const stamp = new Date(Date.now() + 60000);
    await applyRows(server, kept.rows, { stamp, localDevice: 'server', incomingDevice: 'A', now: stamp });
    assert.equal((await server.examEvent.findUnique({ where: { id: exam.id } })).userId, mallory);
    assert.equal((await server.chatMessage.findUnique({ where: { id: message.id } })).sessionId, chat.id);
  });
});
