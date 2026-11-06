import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { safeToRestart, focusSessionRunning } = require('../desktop-app/update-policy.js');

const focus = (fields) => JSON.stringify(fields);

test('never restarts while someone is using the app', () => {
  assert.equal(safeToRestart({ idleSeconds: 30, savedFocus: null }), false);
});

test('restarts once idle with nothing running', () => {
  assert.equal(safeToRestart({ idleSeconds: 120, savedFocus: null }), true);
});

test('never restarts during a focus session, however long the idle', () => {
  const running = focus({ activeTask: { id: 't' }, step: 'FOCUS', isPaused: false });
  assert.equal(safeToRestart({ idleSeconds: 3600, savedFocus: running }), false);
});

test('a paused focus session still counts as running', () => {
  assert.equal(focusSessionRunning(focus({ activeTask: { id: 't' }, step: 'FOCUS', isPaused: true })), true);
});

test('a finished session does not hold it up', () => {
  assert.equal(focusSessionRunning(focus({ activeTask: { id: 't' }, step: 'DONE' })), false);
  assert.equal(focusSessionRunning(focus({ activeTask: null })), false);
});

test('unreadable saved focus is treated as running', () => {
  assert.equal(focusSessionRunning('{not json'), true);
});
