import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunSaveQueue } from '../lib/run-save-queue.ts';

test('exit waits for an in-flight save and the newer answer behind it', async () => {
  let release;
  const saved = [];
  const states = [];
  const queue = createRunSaveQueue(async (snapshot) => {
    if (snapshot === 'first') await new Promise((resolve) => { release = resolve; });
    saved.push(snapshot);
  }, (value) => states.push(value));
  queue.queue('first');
  const autosave = queue.flush();
  queue.queue('newer');
  const exit = queue.flush();
  assert.equal(autosave, exit);
  assert.deepEqual(saved, []);
  release();
  assert.equal(await exit, true);
  assert.deepEqual(saved, ['first', 'newer']);
  assert.equal(states.at(-1), 'saved');
});
test('failed saves keep the latest edit and block exit until Retry succeeds', async () => {
  let reject;
  let fail = true;
  const saved = [];
  const states = [];
  const queue = createRunSaveQueue(async (snapshot) => {
    if (fail) await new Promise((_, no) => { reject = no; });
    saved.push(snapshot);
  }, (value) => states.push(value));
  queue.queue('old');
  const running = queue.flush();
  queue.queue('latest');
  reject(new Error('offline'));
  assert.equal(await running, false);
  assert.equal(states.at(-1), 'error');
  fail = false;
  assert.equal(await queue.flush(), true);
  assert.deepEqual(saved, ['latest']);
});
