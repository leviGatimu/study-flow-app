import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FileBackoff, FIRST_RETRY_MS, MAX_RETRY_MS } from '../lib/sync/file-backoff.ts';

describe('file sync backoff', () => {
  test('an unknown file is tried; a settled one never again this launch', () => {
    const b = new FileBackoff();
    assert.equal(b.shouldTry('a.pdf', 0), true);
    b.succeeded('a.pdf');
    assert.equal(b.shouldTry('a.pdf', 10 * MAX_RETRY_MS), false);
  });

  test('a failing server is asked once per window, the window doubling up to a day', () => {
    const b = new FileBackoff();
    let now = 0;
    let asked = 0;
    // Simulate a sync run every 5 minutes for 3 days against a server that always fails.
    for (let run = 0; run < (3 * 24 * 60) / 5; run++, now += 5 * 60_000) {
      if (b.shouldTry('lost.pdf', now)) {
        asked++;
        b.failed('lost.pdf', now);
      }
    }
    // Without backoff this would be 864 requests.
    assert.ok(asked < 20, `asked ${asked} times`);
    b.failed('lost.pdf', now);
    assert.equal(b.shouldTry('lost.pdf', now + MAX_RETRY_MS - 1), false);
    assert.equal(b.shouldTry('lost.pdf', now + MAX_RETRY_MS), true);
  });

  test('first retry after five minutes; success after failure settles it; clear forgets', () => {
    const b = new FileBackoff();
    b.failed('x', 0);
    assert.equal(b.shouldTry('x', FIRST_RETRY_MS - 1), false);
    assert.equal(b.shouldTry('x', FIRST_RETRY_MS), true);
    b.succeeded('x');
    assert.equal(b.shouldTry('x', 10 * MAX_RETRY_MS), false);
    b.clear();
    assert.equal(b.shouldTry('x', 0), true);
  });
});
