import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnline, lastSeenLabel } from '../lib/last-seen.ts';

const NOW = Date.parse('2026-11-06T18:00:00Z');
const ago = (minutes) => new Date(NOW - minutes * 60_000);

test('nothing recorded says so, rather than showing a date', () => {
  assert.equal(lastSeenLabel(null, NOW), 'Not seen yet');
  assert.equal(isOnline(null, NOW), false);
});

test('recently here counts as online', () => {
  assert.equal(lastSeenLabel(ago(3), NOW), 'Online now');
  assert.equal(isOnline(ago(3), NOW), true);
  assert.equal(isOnline(ago(11), NOW), false);
});

test('older times read plainly', () => {
  assert.equal(lastSeenLabel(ago(25), NOW), '25 minutes ago');
  assert.equal(lastSeenLabel(ago(60), NOW), '1 hour ago');
  assert.equal(lastSeenLabel(ago(300), NOW), '5 hours ago');
  assert.equal(lastSeenLabel(ago(60 * 26), NOW), 'Yesterday');
  assert.equal(lastSeenLabel(ago(60 * 24 * 5), NOW), '5 days ago');
  assert.equal(lastSeenLabel(ago(60 * 24 * 45), NOW), '1 month ago');
});

test('a time sent as text reads the same as a date', () => {
  assert.equal(lastSeenLabel(ago(25).toISOString(), NOW), '25 minutes ago');
});
