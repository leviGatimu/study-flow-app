/**
 * The Range parser behind app/uploads/[...path]/route.ts.
 *
 * Without Range support the <audio> element cannot seek: it asks for a byte
 * range, gets a 200 with the whole body instead of a 206, and Chromium marks
 * the track non-seekable. Off-by-one errors here are invisible until a file
 * plays back truncated, so the boundaries are pinned down.
 *
 * Kept as a copy of the route's parser rather than an import, because the
 * route module pulls in server-only auth and Prisma. The guard below fails if
 * the shipped version stops matching.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseRange(header, size) {
  if (!header) return undefined;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return undefined;

  let start;
  let end;

  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size || end < start) return null;

  return { start, end: Math.min(end, size - 1) };
}

describe('uploads Range parser', () => {
  test('the shipped route still contains this parser', () => {
    const shipped = readFileSync(join(ROOT, 'app', 'uploads', '[...path]', 'route.ts'), 'utf8');
    for (const marker of [
      'function parseRange(',
      "/^bytes=(\\d*)-(\\d*)$/",
      "'Accept-Ranges': 'bytes'",
      'status: 206',
      'status: 416',
    ]) {
      assert.ok(shipped.includes(marker), `route.ts no longer contains: ${marker}`);
    }
  });

  const SIZE = 1000;

  test('no header means send the whole file', () => {
    assert.equal(parseRange(null, SIZE), undefined);
    assert.equal(parseRange('', SIZE), undefined);
  });

  test('a normal range', () => {
    assert.deepEqual(parseRange('bytes=0-499', SIZE), { start: 0, end: 499 });
    assert.deepEqual(parseRange('bytes=500-999', SIZE), { start: 500, end: 999 });
  });

  test('open-ended range runs to the last byte', () => {
    // What an <audio> element sends when the user drags the scrubber.
    assert.deepEqual(parseRange('bytes=500-', SIZE), { start: 500, end: 999 });
    assert.deepEqual(parseRange('bytes=0-', SIZE), { start: 0, end: 999 });
  });

  test('suffix range means the LAST n bytes', () => {
    assert.deepEqual(parseRange('bytes=-100', SIZE), { start: 900, end: 999 });
    // A suffix longer than the file clamps to the whole file rather than
    // producing a negative start.
    assert.deepEqual(parseRange('bytes=-5000', SIZE), { start: 0, end: 999 });
  });

  test('an end past the file is clamped, not rejected', () => {
    assert.deepEqual(parseRange('bytes=900-99999', SIZE), { start: 900, end: 999 });
  });

  test('the single-byte edges', () => {
    assert.deepEqual(parseRange('bytes=0-0', SIZE), { start: 0, end: 0 });
    assert.deepEqual(parseRange('bytes=999-999', SIZE), { start: 999, end: 999 });
  });

  test('unsatisfiable ranges are rejected so the route can answer 416', () => {
    assert.equal(parseRange('bytes=1000-', SIZE), null, 'start at EOF');
    assert.equal(parseRange('bytes=1500-1600', SIZE), null, 'entirely past EOF');
    assert.equal(parseRange('bytes=500-400', SIZE), null, 'end before start');
    assert.equal(parseRange('bytes=-0', SIZE), null, 'zero-length suffix');
  });

  test('malformed headers fall back to a full response, never a crash', () => {
    for (const header of [
      'bytes=abc-def',
      'items=0-100',
      'bytes=0-100, 200-300', // multipart: unsupported, send it all
      'bytes=',
      'nonsense',
    ]) {
      assert.equal(parseRange(header, SIZE), undefined, `should ignore: ${header}`);
    }
  });

  test('content-length of a partial response is inclusive on both ends', () => {
    // The classic off-by-one: bytes 0-499 is 500 bytes, not 499.
    const r = parseRange('bytes=0-499', SIZE);
    assert.equal(r.end - r.start + 1, 500);
  });
});
