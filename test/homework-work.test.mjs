import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { cleanWork, HOMEWORK_TEXT_MAX, isImageUrl, parseDueDay, workError } from '../lib/homework-work.ts';
import { homeworkWorkPayload } from '../lib/sync/protocol.ts';

describe('homework work', () => {
  test('text is trimmed outside, line breaks kept inside, empty is none', () => {
    assert.equal(cleanWork('  1. a\r\n2. b  '), '1. a\n2. b');
    assert.equal(cleanWork('   '), null);
    assert.equal(cleanWork(null), null);
    assert.equal(cleanWork(42), null);
  });

  test('text over the limit is refused with its length', () => {
    assert.equal(workError('Your answers', 'x'.repeat(HOMEWORK_TEXT_MAX)), null);
    assert.match(workError('Your answers', 'x'.repeat(HOMEWORK_TEXT_MAX + 1)), /Your answers is too long/);
    assert.equal(workError('Your answers', null), null);
  });

  test('due days must be real calendar dates', () => {
    assert.equal(parseDueDay('2026-11-07')?.toISOString(), '2026-11-07T00:00:00.000Z');
    assert.equal(parseDueDay('2026-02-30'), null);
    assert.equal(parseDueDay('07/11/2026'), null);
    assert.equal(parseDueDay(undefined), null);
  });

  test('only image uploads preview inline', () => {
    assert.equal(isImageUrl('/uploads/hw-answer-1-work.JPG'), true);
    assert.equal(isImageUrl('/uploads/hw-answer-1-work.pdf'), false);
    assert.equal(isImageUrl(null), false);
  });

  test('older desktop clients are not sent the new columns', () => {
    const row = { id: 'h', title: 't', answer: 'a', briefFileUrl: '/uploads/b', answerFileUrl: '/uploads/c', proofUrl: '/uploads/p' };
    assert.deepEqual(homeworkWorkPayload('homework', row, false), { id: 'h', title: 't', proofUrl: '/uploads/p' });
    assert.equal(homeworkWorkPayload('homework', row, true), row);
    assert.equal(homeworkWorkPayload('task', { id: 'x', answer: 'keep' }, false).answer, 'keep');
  });
});
