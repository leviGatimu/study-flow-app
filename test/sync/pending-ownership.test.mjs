import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fleet } from './harness.mjs';
import { APPLY_ORDER } from '../../lib/sync/merge.ts';
import { ownedBy } from '../../lib/sync/ownership.ts';

test('pending sync queries accept every model and exclude another account’s attempts and messages', async () => {
  const fleet = await Fleet.create({ devices: ['A'] });
  try {
    const db = fleet.device('A').prisma;
    const userId = fleet.userId;
    await db.user.create({ data: { id: 'other', username: 'other', passwordHash: 'fixture-only' } });
    for (const owner of [userId, 'other']) {
      const module = await db.tutorModule.create({ data: { userId: owner, title: 'Private set', subject: 'Physics', questions: '[]' } });
      const chat = await db.chatSession.create({ data: { userId: owner, title: 'Private chat' } });
      await db.quizAttempt.create({ data: { moduleId: module.id, score: 80, feedback: '[]' } });
      await db.chatMessage.create({ data: { sessionId: chat.id, role: 'user', content: 'Private message' } });
    }
    const counts = {};
    for (const model of APPLY_ORDER) {
      counts[model] = await db[model].count({ where: { ...ownedBy(model, userId), syncedAt: null } });
    }
    assert.equal(counts.user, 1);
    assert.equal(counts.quizAttempt, 1);
    assert.equal(counts.chatMessage, 1);
    assert.equal(counts.tutorModule, 1);
    assert.equal(counts.chatSession, 1);
  } finally { await fleet.destroy(); }
});
