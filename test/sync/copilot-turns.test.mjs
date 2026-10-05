/**
 * Ask AI turns on a real SQLite database: a retried or doubled send never
 * writes a second user message, an answered turn is not asked twice, and a
 * stopped turn's late answer is discarded.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';
import { beginTurn, finishTurn, failTurn } from '../../lib/copilot-turns.ts';

describe('copilot turns', () => {
  let fleet;
  let db;
  let sessionId;

  before(async () => {
    fleet = await Fleet.create({ devices: ['A'] });
    db = fleet.device('A').prisma;
    sessionId = (await db.chatSession.create({ data: { userId: fleet.userId, title: 't' } })).id;
  });

  after(async () => {
    await fleet?.destroy();
  });

  const userTurns = (requestId) => db.chatMessage.count({ where: { sessionId, requestId } });

  test('a failed turn retried with the same requestId reuses its message', async () => {
    const first = await beginTurn(db, sessionId, 'r1', 'Explain forces');
    await failTurn(db, first.userMessage.id);
    const retry = await beginTurn(db, sessionId, 'r1', 'Explain forces');
    assert.equal(retry.userMessage.id, first.userMessage.id);
    assert.equal(retry.userMessage.status, 'PENDING');
    assert.equal(await userTurns('r1'), 1);
  });

  test('an answered turn returns its answer instead of asking again', async () => {
    const { userMessage } = await beginTurn(db, sessionId, 'r2', 'Plan tonight');
    const done = await finishTurn(db, sessionId, userMessage.id, 'Do Physics at 19:00 [S1].', '[{"id":"S1"}]');
    assert.equal(done.userMessage.status, 'DONE');
    const again = await beginTurn(db, sessionId, 'r2', 'Plan tonight');
    assert.equal(again.answered?.id, done.reply.id);
    assert.equal(await db.chatMessage.count({ where: { sessionId, role: 'model' } }), 1);
  });

  test('two simultaneous sends of one turn write one message', async () => {
    const [a, b] = await Promise.all([
      beginTurn(db, sessionId, 'r3', 'Same send'),
      beginTurn(db, sessionId, 'r3', 'Same send'),
    ]);
    assert.equal(a.userMessage.id, b.userMessage.id);
    assert.equal(await userTurns('r3'), 1);
  });

  test('a stopped turn discards the answer that arrives afterwards', async () => {
    const { userMessage } = await beginTurn(db, sessionId, 'r4', 'Long question');
    await failTurn(db, userMessage.id); // what stopCopilotTurn does
    const late = await finishTurn(db, sessionId, userMessage.id, 'late answer', null);
    assert.deepEqual(late, { stopped: true });
    assert.equal(await db.chatMessage.count({ where: { sessionId, content: 'late answer' } }), 0);
  });
});
