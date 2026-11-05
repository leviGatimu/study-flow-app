import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRestoreFilter } from '../lib/backup-scope.ts';

const yearStart = new Date('2026-09-01T00:00:00Z');

test('1.1 backup: rows of the backup year are kept, finished years are skipped', () => {
  const keep = makeRestoreFilter(
    { activeClassId: 'y2', terms: [{ id: 't1', classId: 'y1' }, { id: 't3', classId: 'y2' }] },
    yearStart
  );
  assert.equal(keep({ classId: 'y2' }), true);
  assert.equal(keep({ classId: 'y1' }), false);
  assert.equal(keep({ termId: 't3', date: '2026-10-02T00:00:00Z' }), true);
  assert.equal(keep({ termId: 't1', date: '2026-10-02T00:00:00Z' }), false);
});

test('1.1 backup: rows that name no year (pre-year data) are kept', () => {
  const keep = makeRestoreFilter({ activeClassId: 'y2', terms: [] }, yearStart);
  assert.equal(keep({ classId: null }), true);
  assert.equal(keep({ termId: null, date: '2020-01-01T00:00:00Z' }), true);
});

test('1.1 backup: a term the backup does not list counts as no year', () => {
  const keep = makeRestoreFilter({ activeClassId: 'y2', terms: [] }, yearStart);
  assert.equal(keep({ termId: 'unknown' }), true);
});

test('1.0 backup: dated rows before the current year are skipped', () => {
  const keep = makeRestoreFilter({}, yearStart);
  assert.equal(keep({ date: '2026-08-31T23:59:59Z' }), false);
  assert.equal(keep({ date: '2026-09-01T00:00:00Z' }), true);
  assert.equal(keep({ date: '2026-11-04T00:00:00Z' }), true);
});

test('1.0 backup: undated rows and unreadable dates are kept', () => {
  const keep = makeRestoreFilter({}, yearStart);
  assert.equal(keep({}), true);
  assert.equal(keep({ date: 'not a date' }), true);
});

test('1.0 backup with no current year keeps everything', () => {
  const keep = makeRestoreFilter({}, null);
  assert.equal(keep({ date: '2019-01-01T00:00:00Z' }), true);
});
