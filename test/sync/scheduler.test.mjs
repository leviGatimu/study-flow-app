/**
 * The invariant that makes automatic sync safe to leave running.
 *
 * Sync now fires on every local change. That is the feature - an assignment
 * added on the laptop is on the website seconds later, with nobody pressing
 * anything - and it is also the one design that can eat a machine alive: if
 * applying a pull counted as a local change, every sync would schedule the next
 * one and the app would sync in a tight loop forever, on battery, for as long
 * as it was open.
 *
 * The whole defence is one line in lib/sync/stamp.ts: a write carrying an
 * EXPLICIT syncedAt is the engine's own, and is left alone. That line is worth
 * a test of its own, because nothing about the app would look broken if it
 * regressed - it would just get hot and quiet.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { syncStampExtension } from '../../lib/sync/stamp.ts';
import { onLocalWrite, localWrite } from '../../lib/sync/notify.ts';

/** Drive the extension the way Prisma does, recording what it passed through. */
async function run(extension, { model, operation, args }) {
  let seen = null;
  const query = async (next) => {
    seen = next;
    return { ok: true };
  };
  await extension.query.$allModels.$allOperations({ model, operation, args, query });
  return seen;
}

/** Count how many times the scheduler would have been nudged. */
function countingListener() {
  const calls = { n: 0 };
  onLocalWrite(() => calls.n++);
  return calls;
}

describe('the sync stamp extension', () => {
  const device = syncStampExtension(false);
  const server = syncStampExtension(true);

  test('a device write is marked as not yet sent', async () => {
    const seen = await run(device, {
      model: 'Task',
      operation: 'create',
      args: { data: { subject: 'Physics' } },
    });
    assert.equal(seen.data.syncedAt, null);
  });

  test('a server write is stamped with the server clock', async () => {
    const before = Date.now();
    const seen = await run(server, {
      model: 'Task',
      operation: 'create',
      args: { data: { subject: 'Physics' } },
    });
    assert.ok(seen.data.syncedAt instanceof Date);
    assert.ok(seen.data.syncedAt.getTime() >= before);
  });

  test('an explicit syncedAt is never overwritten - that is the engine speaking', async () => {
    const stamp = new Date('2026-01-01T00:00:00.000Z');
    for (const [name, extension] of [['device', device], ['server', server]]) {
      const seen = await run(extension, {
        model: 'Task',
        operation: 'updateMany',
        args: { data: { isDone: true, syncedAt: stamp } },
      });
      assert.equal(seen.data.syncedAt, stamp, name);
    }
  });

  test('models that do not sync are passed through untouched', async () => {
    const seen = await run(device, {
      model: 'ChatMessage',
      operation: 'create',
      args: { data: { content: 'hello' } },
    });
    assert.equal('syncedAt' in seen.data, false);
  });

  test('reads are passed through untouched', async () => {
    const seen = await run(device, {
      model: 'Task',
      operation: 'findMany',
      args: { where: { userId: 'u1' } },
    });
    assert.deepEqual(seen, { where: { userId: 'u1' } });
  });

  test('an upsert is stamped on both branches', async () => {
    const seen = await run(device, {
      model: 'Subject',
      operation: 'upsert',
      args: { where: { id: 's1' }, create: { name: 'Maths' }, update: { name: 'Maths' } },
    });
    assert.equal(seen.create.syncedAt, null);
    assert.equal(seen.update.syncedAt, null);
  });
});

describe('what wakes the scheduler', () => {
  const device = syncStampExtension(false);
  const server = syncStampExtension(true);

  test('a real local edit asks for a sync', async () => {
    const calls = countingListener();
    await run(device, {
      model: 'Task',
      operation: 'create',
      args: { data: { subject: 'Physics' } },
    });
    assert.equal(calls.n, 1);
  });

  test('APPLYING A PULL DOES NOT - otherwise sync would never stop', async () => {
    const calls = countingListener();
    await run(device, {
      model: 'Task',
      operation: 'updateMany',
      args: { data: { subject: 'Physics', syncedAt: new Date() } },
    });
    assert.equal(
      calls.n,
      0,
      'a write carrying an explicit syncedAt is the merge engine applying a pull; ' +
        'treating it as a local change makes every sync schedule the next one'
    );
  });

  test('the server never nudges a scheduler - it does not have one', async () => {
    const calls = countingListener();
    await run(server, {
      model: 'Task',
      operation: 'create',
      args: { data: { subject: 'Physics' } },
    });
    assert.equal(calls.n, 0);
  });

  test('a local-only model does not wake it either', async () => {
    const calls = countingListener();
    await run(device, {
      model: 'ChatMessage',
      operation: 'create',
      args: { data: { content: 'hello' } },
    });
    assert.equal(calls.n, 0);
  });

  test('a listener that throws cannot break the write it came from', () => {
    onLocalWrite(() => {
      throw new Error('scheduler exploded');
    });
    assert.doesNotThrow(() => localWrite());
    onLocalWrite(() => {});
  });
});
