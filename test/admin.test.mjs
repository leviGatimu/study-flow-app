import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Fleet } from './sync/harness.mjs';
import { collectAdminMetrics, hasAdminRole } from '../lib/admin-metrics.ts';
import { fetchAdminReport, decodeAdminReport } from '../lib/admin-remote.ts';
import { recordDeviceStatus } from '../lib/sync/device-status.ts';

test('admin reports count current practice/focus activity and exclude deleted records', async () => {
  const fleet = await Fleet.create({ devices: ['A'] });
  try {
    const db = fleet.device('A').prisma,
      userId = fleet.userId;
    const live = await db.tutorModule.create({
      data: { userId, title: 'Physics', subject: 'Physics', questions: '[]' },
    });
    const deleted = await db.tutorModule.create({
      data: {
        userId,
        title: 'Deleted',
        subject: 'Physics',
        questions: '[]',
        deletedAt: new Date(),
      },
    });
    await db.quizAttempt.createMany({
      data: [
        { moduleId: live.id, score: 80, feedback: '[]' },
        {
          moduleId: live.id,
          score: 0,
          feedback: '[]',
          markingStatus: 'PENDING',
        },
        { moduleId: deleted.id, score: 100, feedback: '[]' },
      ],
    });
    await db.attemptDraft.createMany({
      data: [
        { userId, moduleId: live.id, mode: 'PRACTICE' },
        { userId, moduleId: deleted.id, mode: 'EXAM' },
      ],
    });
    await db.task.createMany({
      data: [
        {
          id: 'done',
          userId,
          subject: 'Physics',
          date: new Date(),
          startTime: '19:00',
          endTime: '20:00',
          type: 'REVISION',
          isDone: true,
        },
        {
          id: 'suppressed',
          userId,
          subject: 'Physics',
          date: new Date(),
          startTime: '19:00',
          endTime: '20:00',
          type: 'REVISION',
          isDone: true,
          isDeleted: true,
        },
      ],
    });
    await db.resource.createMany({
      data: [
        {
          userId,
          subject: 'Physics',
          title: 'Folder',
          type: 'FOLDER',
          url: '',
        },
        {
          userId,
          subject: 'Physics',
          title: 'Document',
          type: 'FILE',
          url: '/uploads/sample.pdf',
        },
      ],
    });
    await db.xpEvent.createMany({
      data: [
        {
          userId,
          source: 'FOCUS',
          sourceKey: 'measured',
          amount: 90,
          focusSeconds: 90,
        },
        { userId, source: 'FOCUS', sourceKey: 'legacy', amount: 600 },
        {
          userId,
          source: 'FOCUS',
          sourceKey: 'deleted',
          amount: 10,
          focusSeconds: 10,
          deletedAt: new Date(),
        },
      ],
    });
    const report = await collectAdminMetrics(db);
    assert.equal(report.completedBlocks, 1);
    assert.equal(report.practiceSets, 1);
    assert.equal(report.attempts, 2);
    assert.equal(report.pendingMarks, 1);
    assert.equal(report.drafts, 1);
    assert.equal(report.resources, 1);
    assert.equal(report.focusSeconds, 90);
    assert.equal(report.measuredSessions, 1);
    assert.equal(await hasAdminRole(db, null), false);
    assert.equal(await hasAdminRole(db, userId), false);
    await db.user.update({ where: { id: userId }, data: { isAdmin: true } });
    assert.equal(await hasAdminRole(db, userId), true);
    await db.user.update({ where: { id: userId }, data: { isAdmin: false } });
    assert.equal(await hasAdminRole(db, userId), false);
  } finally {
    await fleet.destroy();
  }
});
test('device reports are idempotent, account-scoped, credential-free and preserve push errors during pulls', async () => {
  const fleet = await Fleet.create({ devices: ['A'] });
  try {
    const db = fleet.server.prisma,
      userId = fleet.userId;
    await recordDeviceStatus(db, userId, 'desktop-1', {
      pushed: 4,
      error: 'One record failed',
    });
    await recordDeviceStatus(db, userId, 'desktop-1', { pulled: 6 });
    await recordDeviceStatus(db, 'other-user', 'desktop-1', { pulled: 2 });
    const state = await db.syncState.findUnique({
      where: { userId_deviceId: { userId, deviceId: 'desktop-1' } },
    });
    assert.equal(state.lastPushed, 4);
    assert.equal(state.lastPulled, 6);
    assert.equal(state.lastError, 'One record failed');
    assert.equal(state.token, null);
    assert.equal(state.serverUrl, null);
    assert.equal(await db.syncState.count(), 2);
    await recordDeviceStatus(db, userId, 'invalid/id', { pulled: 3 });
    assert.equal(await db.syncState.count(), 2);
    await recordDeviceStatus(db, userId, 'desktop-1', {
      pushed: 1,
      error: null,
    });
    assert.equal(
      (await db.syncState.findUnique({ where: { id: state.id } })).lastError,
      null,
    );
  } finally {
    await fleet.destroy();
  }
});
test('desktop admin fetch uses the server token without caching, revives only date fields and fails clearly on revoked rights', async () => {
  let status = 200,
    seen;
  const server = createServer((req, res) => {
    seen = req;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        source: { checkedAt: '2026-11-04T07:00:00.000Z' },
        body: '2026-11-04T07:00:00.000Z',
      }),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const connection = {
    serverUrl: `http://127.0.0.1:${server.address().port}`,
    token: 'synthetic-token',
  };
  try {
    const report = await fetchAdminReport(connection, {
      operation: 'snapshot',
    });
    assert.equal(seen.headers.authorization, 'Bearer synthetic-token');
    assert.equal(seen.url, '/api/admin?operation=snapshot');
    assert.ok(report.source.checkedAt instanceof Date);
    assert.equal(typeof report.body, 'string');
    status = 403;
    await assert.rejects(
      () => fetchAdminReport(connection, { operation: 'snapshot' }),
      /does not have admin access/,
    );
    status = 401;
    await assert.rejects(
      () => fetchAdminReport(connection, { operation: 'snapshot' }),
      /expired/,
    );
    status = 404;
    await assert.rejects(
      () => fetchAdminReport(connection, { operation: 'snapshot' }),
      /needs the admin-console update/,
    );
    await assert.rejects(
      () =>
        fetchAdminReport(
          { serverUrl: 'file:///private', token: 'synthetic' },
          { operation: 'snapshot' },
        ),
      /invalid/,
    );
    await fetchAdminReport(
      connection,
      { operation: 'snapshot' },
      async (_url, options) => {
        assert.equal(options.cache, 'no-store');
        assert.equal(options.redirect, 'error');
        return new Response('{}');
      },
    );
    assert.equal(
      decodeAdminReport('{"content":"2026-11-04T07:00:00.000Z"}').content,
      '2026-11-04T07:00:00.000Z',
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
