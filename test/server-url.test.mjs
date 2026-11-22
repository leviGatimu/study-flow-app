import { test } from 'node:test';
import assert from 'node:assert/strict';

import { currentServerUrl, SYNC_SERVER_URL } from '../lib/sync/server-url.ts';

test('sync stays on the Vercel address until a new service really exists', () => {
  assert.equal(SYNC_SERVER_URL, 'https://studyingflow.vercel.app');
  assert.equal(currentServerUrl('https://studyingflow.vercel.app'), 'https://studyingflow.vercel.app');
});

test('saved addresses are left alone', () => {
  assert.equal(currentServerUrl('http://192.168.1.5:3000'), 'http://192.168.1.5:3000');
  assert.equal(currentServerUrl(SYNC_SERVER_URL), SYNC_SERVER_URL);
  assert.equal(currentServerUrl('not a url'), 'not a url');
});
