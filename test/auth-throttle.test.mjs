/**
 * The sign-in throttle and session versions, against a real SQLite database
 * built from prisma/migrations-sqlite (so the auth_hardening migration is
 * exercised too).
 *
 * Needs the harness client: npm run test:sync:setup
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import { Fleet } from './sync/harness.mjs';
import {
  THROTTLE,
  DUMMY_HASH,
  addressKey,
  clearFailures,
  clientAddress,
  lockedFor,
  lockedMessage,
  recordFailure,
  throttleKeys,
  userKey,
} from '../lib/auth-throttle.ts';
import { scrub } from '../lib/sync/merge.ts';
import { sessionVersionPayload } from '../lib/sync/protocol.ts';

let fleet;
let db;

before(async () => {
  fleet = await Fleet.create({ devices: ['desktop'] });
  db = fleet.device('desktop').prisma;
});
after(async () => {
  await fleet.destroy();
});
beforeEach(async () => {
  await db.authThrottle.deleteMany({});
});

const at = (minutes) => new Date(Date.UTC(2026, 10, 5, 12, minutes));

describe('sign-in throttle', () => {
  test('keys: username is case-insensitive, address only when known', () => {
    assert.equal(userKey('  Amani '), 'user:amani');
    assert.deepEqual(throttleKeys('Amani', null), ['user:amani']);
    assert.deepEqual(throttleKeys('Amani', '1.2.3.4'), ['user:amani', 'ip:1.2.3.4']);
  });

  test('client address comes from the first x-forwarded-for entry', () => {
    const h = (map) => ({ get: (n) => map[n] ?? null });
    assert.equal(clientAddress(h({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9');
    assert.equal(clientAddress(h({ 'x-real-ip': '8.8.8.8' })), '8.8.8.8');
    assert.equal(clientAddress(h({})), null);
  });

  test(`a username locks after ${THROTTLE.maxPerUser} failures in the window`, async () => {
    const keys = throttleKeys('amani', null);
    for (let i = 0; i < THROTTLE.maxPerUser - 1; i++) await recordFailure(db, keys, at(i));
    assert.equal(await lockedFor(db, keys, at(5)), 0, 'not locked one short of the limit');
    await recordFailure(db, keys, at(5));
    const wait = await lockedFor(db, keys, at(5));
    assert.equal(wait, THROTTLE.lockMs / 1000);
    assert.match(lockedMessage(wait), /Try again in 15 minutes/);
  });

  test('the lock expires', async () => {
    const keys = throttleKeys('amani', null);
    for (let i = 0; i < THROTTLE.maxPerUser; i++) await recordFailure(db, keys, at(0));
    assert.ok((await lockedFor(db, keys, at(14))) > 0);
    assert.equal(await lockedFor(db, keys, at(16)), 0);
  });

  test('failures older than the window start a new count', async () => {
    const keys = throttleKeys('amani', null);
    for (let i = 0; i < THROTTLE.maxPerUser - 1; i++) await recordFailure(db, keys, at(0));
    await recordFailure(db, keys, at(20)); // window (15 min) has passed: count restarts at 1
    assert.equal(await lockedFor(db, keys, at(20)), 0);
    assert.equal((await db.authThrottle.findUnique({ where: { key: 'user:amani' } })).failures, 1);
  });

  test('a correct password clears the username but not the address', async () => {
    const keys = throttleKeys('amani', '1.2.3.4');
    for (let i = 0; i < 3; i++) await recordFailure(db, keys, at(i));
    await clearFailures(db, 'Amani');
    assert.equal(await db.authThrottle.findUnique({ where: { key: 'user:amani' } }), null);
    assert.equal((await db.authThrottle.findUnique({ where: { key: addressKey('1.2.3.4') } })).failures, 3);
  });

  test(`one address locks after ${THROTTLE.maxPerAddress} failures across many usernames`, async () => {
    for (let i = 0; i < THROTTLE.maxPerAddress; i++) {
      await recordFailure(db, throttleKeys(`user${i}`, '5.5.5.5'), at(1));
    }
    assert.ok((await lockedFor(db, throttleKeys('someone-new', '5.5.5.5'), at(2))) > 0);
    assert.equal(await lockedFor(db, throttleKeys('someone-new', '6.6.6.6'), at(2)), 0);
  });

  test('the dummy hash is well formed: an unknown username costs a real bcrypt compare', async () => {
    const started = Date.now();
    assert.equal(await bcrypt.compare('guess', DUMMY_HASH), false);
    assert.ok(Date.now() - started >= 20, 'compare returned too fast to be a real cost-10 hash');
  });
});

describe('session versions', () => {
  test('accounts start at version 0 and can be bumped', async () => {
    const user = await db.user.findUnique({ where: { id: fleet.userId }, select: { sessionVersion: true } });
    assert.equal(user.sessionVersion, 0);
    await db.user.update({ where: { id: fleet.userId }, data: { sessionVersion: { increment: 1 } } });
    const bumped = await db.user.findUnique({ where: { id: fleet.userId }, select: { sessionVersion: true } });
    assert.equal(bumped.sessionVersion, 1);
  });

  test('a device can never push its session version up to the server', () => {
    const up = scrub('user', { id: 'u1', username: 'a', sessionVersion: 0, passwordHash: 'x', isAdmin: true }, 'up');
    assert.equal('sessionVersion' in up, false);
    assert.equal('passwordHash' in up, false);
    assert.equal('isAdmin' in up, false);
    const down = scrub('user', { id: 'u1', sessionVersion: 3 }, 'down');
    assert.equal(down.sessionVersion, 3, 'it travels down so desktops log out too');
  });

  test('older desktops (no column) never receive it; newer ones do', () => {
    const row = { id: 'u1', username: 'a', sessionVersion: 2 };
    assert.equal('sessionVersion' in sessionVersionPayload('user', row, false), false);
    assert.equal(sessionVersionPayload('user', row, true).sessionVersion, 2);
    assert.deepEqual(sessionVersionPayload('task', { id: 't', sessionVersion: 1 }, false), { id: 't', sessionVersion: 1 });
  });
});
