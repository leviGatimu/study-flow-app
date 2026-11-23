import { test } from 'node:test';
import assert from 'node:assert/strict';

import { currentServerUrl, SYNC_SERVER_URL } from '../lib/sync/server-url.ts';

test('sync uses the Render website, and a pairing on the retired Vercel address follows it', () => {
  assert.equal(SYNC_SERVER_URL, 'https://study-flow-lm0j.onrender.com');
  assert.equal(currentServerUrl('https://studyingflow.vercel.app'), SYNC_SERVER_URL);
  assert.equal(currentServerUrl('https://studyingflow.vercel.app/'), SYNC_SERVER_URL);
});

test('other saved addresses are left alone', () => {
  assert.equal(currentServerUrl('http://192.168.1.5:3000'), 'http://192.168.1.5:3000');
  assert.equal(currentServerUrl(SYNC_SERVER_URL), SYNC_SERVER_URL);
  assert.equal(currentServerUrl('not a url'), 'not a url');
});
