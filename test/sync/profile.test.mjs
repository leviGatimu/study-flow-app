import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fleet } from './harness.mjs';
import { applyRows, scrub } from '../../lib/sync/merge.ts';
import { FILE_COLUMNS } from '../../lib/sync/file-columns.ts';

test('profile migration preserves account data and profile edits sync between devices', async () => {
  const fleet = await Fleet.create({ devices: ['A'] });
  try {
    const profile = await fleet.server.prisma.userProgress.create({ data: {
      userId: fleet.userId, name: 'Alex', bio: 'Physics student', school: 'College',
      avatarUrl: '/uploads/avatar-fixture.webp', xp: 500, level: 3,
    } });
    const stamp = new Date();
    const result = await applyRows(fleet.device('A').prisma, [{ model: 'userProgress', data: scrub('userProgress', profile, 'down') }], {
      stamp, now: stamp, localDevice: 'A', incomingDevice: 'server',
    });
    assert.deepEqual(result.errors, []);
    const received = await fleet.device('A').prisma.userProgress.findUnique({ where: { userId: fleet.userId } });
    assert.equal(received.bio, 'Physics student');
    assert.equal(received.school, 'College');
    assert.equal(received.avatarUrl, profile.avatarUrl);
    assert.equal(received.xp, 500);
    assert.deepEqual(FILE_COLUMNS.userProgress, ['avatarUrl']);
  } finally { await fleet.destroy(); }
});
