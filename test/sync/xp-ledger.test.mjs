/**
 * The XP ledger, tested against real databases.
 *
 * Two things must be true, and neither was before:
 *   1. A grant happens at most once, however many times the code path runs.
 *      toggleTaskDone used to pay +100 every call, so unticking and reticking
 *      a task paid twice.
 *   2. Two devices earning offline both keep their earnings. Last-writer-wins
 *      on a running total does not add them - it discards one side's.
 *
 * hazards.test.mjs still records the OLD behaviour for the bare counters that
 * have not been moved to a ledger yet (focusSessions, totalFocusMinutes).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Fleet } from './harness.mjs';

// Mirrors lib/gamification.ts. Kept local so the test does not import server
// code (which would pull in the app's Prisma client, not the harness one).
const xpForNextLevel = (level) => level * 1000;

function levelFromLifetimeXp(total) {
  let level = 1;
  let remaining = Math.max(0, total);
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  return { level, xp: remaining };
}

function lifetimeXpFor(level, xp) {
  return (1000 * ((level - 1) * level)) / 2 + xp;
}

/** The idempotent grant, as lib/gamification.ts grantXp() implements it. */
async function grantXp(node, userId, amount, source, sourceKey) {
  try {
    await node.prisma.xpEvent.create({ data: { userId, amount, source, sourceKey } });
  } catch (err) {
    if (err?.code === 'P2002') return null; // already granted
    throw err;
  }
  const { _sum } = await node.prisma.xpEvent.aggregate({
    where: { userId, deletedAt: null },
    _sum: { amount: true },
  });
  const totals = levelFromLifetimeXp(_sum.amount ?? 0);
  await node.prisma.userProgress.updateMany({ where: { userId }, data: totals });
  return totals;
}

let fleet;

before(async () => {
  fleet = await Fleet.create({ devices: ['A', 'B'] });
  for (const node of fleet.all) {
    await node.prisma.userProgress.create({
      data: { userId: fleet.userId, name: 'Levi' },
    });
  }
});

after(async () => {
  await fleet?.destroy();
});

describe('xp ledger: level maths round-trips', () => {
  test('lifetime <-> (level, remainder) is exactly invertible', () => {
    // The real value from production: level 29 with 10828 remaining.
    const lifetime = lifetimeXpFor(29, 10828);
    assert.equal(lifetime, 416828);
    assert.deepEqual(levelFromLifetimeXp(lifetime), { level: 29, xp: 10828 });
  });

  test('a few edges', () => {
    assert.deepEqual(levelFromLifetimeXp(0), { level: 1, xp: 0 });
    // Exactly enough to finish level 1 lands on level 2 with nothing spare.
    assert.deepEqual(levelFromLifetimeXp(1000), { level: 2, xp: 0 });
    assert.deepEqual(levelFromLifetimeXp(999), { level: 1, xp: 999 });
    for (const total of [1, 2500, 99_999, 416_828]) {
      const { level, xp } = levelFromLifetimeXp(total);
      assert.equal(lifetimeXpFor(level, xp), total, `round trip failed for ${total}`);
    }
  });
});

describe('xp ledger: grants are idempotent', () => {
  test('reticking a task does not pay twice', async () => {
    const device = fleet.device('A');
    const taskId = 'task_networking_monday';

    const first = await grantXp(device, fleet.userId, 100, 'TASK', `task:${taskId}`);
    assert.ok(first, 'first completion is granted');

    // Untick, retick, retick again - the old code paid +100 each time.
    const second = await grantXp(device, fleet.userId, 100, 'TASK', `task:${taskId}`);
    const third = await grantXp(device, fleet.userId, 100, 'TASK', `task:${taskId}`);
    assert.equal(second, null, 'already granted');
    assert.equal(third, null, 'still already granted');

    const { _sum } = await device.prisma.xpEvent.aggregate({
      where: { userId: fleet.userId },
      _sum: { amount: true },
    });
    assert.equal(_sum.amount, 100, 'one task, one grant, not three');
  });

  test('a different task still earns', async () => {
    const device = fleet.device('A');
    await grantXp(device, fleet.userId, 100, 'TASK', 'task:physics_wednesday');
    const total = await device.prisma.xpEvent.aggregate({
      where: { userId: fleet.userId },
      _sum: { amount: true },
    });
    assert.equal(total._sum.amount, 200);
  });
});

describe('xp ledger: two devices merge without losing earnings', () => {
  test('a union of append-only rows sums to the truthful total', async () => {
    const [a, b] = fleet.devices;

    const sumOf = async (node) =>
      (await node.prisma.xpEvent.aggregate({
        where: { userId: fleet.userId },
        _sum: { amount: true },
      }))._sum.amount ?? 0;

    // Two grants both devices already agree on - they synced before going
    // offline - then one grant each, earned independently. That divergence is
    // the exact scenario that used to destroy XP.
    for (const key of ['merge:shared-1', 'merge:shared-2']) {
      await grantXp(a, fleet.userId, 100, 'TASK', key);
      await grantXp(b, fleet.userId, 100, 'TASK', key);
    }
    await grantXp(a, fleet.userId, 300, 'FOCUS', 'merge:focus-on-A');
    await grantXp(b, fleet.userId, 250, 'FOCUS', 'merge:focus-on-B');

    const aBefore = await sumOf(a);
    const bBefore = await sumOf(b);
    assert.ok(aBefore > 0 && bBefore > 0);

    // Merge: replay every row from B into A. Rows already present are rejected
    // by the (userId, sourceKey) constraint, which is the whole mechanism.
    const rowsFromB = await b.prisma.xpEvent.findMany({ where: { userId: fleet.userId } });
    let applied = 0;
    let skipped = 0;
    for (const row of rowsFromB) {
      try {
        await a.prisma.xpEvent.create({
          data: {
            id: row.id,
            userId: row.userId,
            amount: row.amount,
            source: row.source,
            sourceKey: row.sourceKey,
            createdAt: row.createdAt,
          },
        });
        applied++;
      } catch (err) {
        if (err?.code !== 'P2002') throw err;
        skipped++;
      }
    }

    assert.equal(skipped, 2, 'the two shared grants were recognised as duplicates');
    assert.equal(applied, 1, "only B's own focus session was new to A");

    const merged = await sumOf(a);
    assert.equal(
      merged,
      aBefore + 250,
      "A keeps everything it had and gains exactly B's unshared earnings"
    );

    // The visible level/xp now follow from the ledger rather than from whichever
    // device wrote last.
    const totals = levelFromLifetimeXp(merged);
    await a.prisma.userProgress.updateMany({ where: { userId: fleet.userId }, data: totals });
    const progress = (await a.rows('userProgress'))[0];
    assert.equal(lifetimeXpFor(progress.level, progress.xp), merged);

    // The old behaviour, for contrast: last-writer-wins keeps one device's
    // total wholesale, so the other device's independent earnings vanish.
    const lwwWouldKeep = Math.max(aBefore, bBefore);
    assert.ok(
      merged > lwwWouldKeep,
      `LWW would have kept ${lwwWouldKeep} and lost ${merged - lwwWouldKeep} XP`
    );
  });
});
