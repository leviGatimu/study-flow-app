/**
 * Proves the app rides out a refused database connection.
 *
 * The failure this guards against is not subtle: on 2026-09-10 the session-mode
 * pooler hit its 15-client ceiling, the root layout's queries were refused, and
 * the whole app rendered "Study Flow couldn't start" for a blip that was over
 * in seconds. lib/db-retry.ts waits those out.
 *
 * The other half of the contract matters just as much and is easier to get
 * wrong: a write must never be retried after it may already have reached
 * Postgres, and a genuine error must never be retried at all.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { connectionRetryExtension } from '../lib/db-retry.ts';

const run = connectionRetryExtension().query.$allModels.$allOperations;

/** Fails `failures` times with `error`, then returns 'ok'. Counts its calls. */
function flaky(error, failures) {
  const state = { calls: 0 };
  return {
    state,
    query: async () => {
      state.calls++;
      if (state.calls <= failures) throw error;
      return 'ok';
    },
  };
}

function prismaError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

const POOL_EXHAUSTED = prismaError(
  'Error in connector: FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15'
);

describe('connection retry', () => {
  test('rides out a pooler refusal and returns the real result', async () => {
    const { state, query } = flaky(POOL_EXHAUSTED, 1);

    const result = await run({ model: 'task', operation: 'findMany', args: {}, query });

    assert.equal(result, 'ok');
    assert.equal(state.calls, 2);
  });

  test('gives up after three attempts and rethrows the original error', async () => {
    const { state, query } = flaky(POOL_EXHAUSTED, 99);

    await assert.rejects(
      () => run({ model: 'task', operation: 'findMany', args: {}, query }),
      (thrown) => thrown === POOL_EXHAUSTED
    );
    assert.equal(state.calls, 3);
  });

  test('retries a pool checkout timeout - the query never left the client', async () => {
    const { state, query } = flaky(prismaError('Timed out fetching a new connection from the connection pool', 'P2024'), 1);

    assert.equal(await run({ model: 'task', operation: 'create', args: {}, query }), 'ok');
    assert.equal(state.calls, 2);
  });

  test('does NOT retry a real error - a constraint violation is an answer', async () => {
    const { state, query } = flaky(prismaError('Unique constraint failed on the fields: (`username`)', 'P2002'), 1);

    await assert.rejects(() => run({ model: 'user', operation: 'create', args: {}, query }));
    assert.equal(state.calls, 1);
  });

  test('a closed connection is retried for a read', async () => {
    const { state, query } = flaky(prismaError('Server has closed the connection.', 'P1017'), 1);

    assert.equal(await run({ model: 'task', operation: 'findFirst', args: {}, query }), 'ok');
    assert.equal(state.calls, 2);
  });

  test('a closed connection is NOT retried for a write - it may have landed', async () => {
    const closed = prismaError('Server has closed the connection.', 'P1017');
    const { state, query } = flaky(closed, 1);

    await assert.rejects(
      () => run({ model: 'task', operation: 'update', args: {}, query }),
      (thrown) => thrown === closed
    );
    assert.equal(state.calls, 1);
  });
});
