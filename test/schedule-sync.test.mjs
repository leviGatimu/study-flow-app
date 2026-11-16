/**
 * Made blocks follow the plan: none after the term's last day, and routine
 * edits reach the blocks already made from that routine block.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { blocksAfterTermEnd, followTemplateEdit, weekdayOf, WITHDRAWN } from '../lib/schedule-sync.ts';

const block = (id, day, over = {}) => ({
  id, day, templateId: 't1', examId: null, isDone: false, isMissed: false, hasWork: false, hasHomework: false, ...over,
});

describe('after the term ends', () => {
  test('routine and revision blocks after the last day are withdrawn', () => {
    const ids = blocksAfterTermEnd([
      block('on-last-day', '2026-12-04'),
      block('after', '2026-12-05'),
      block('revision', '2026-12-08', { templateId: null, examId: 'e1' }),
      block('missed-after', '2026-12-05', { isMissed: true }),
    ], '2026-12-04');
    assert.deepEqual(ids, ['after', 'revision', 'missed-after']);
  });

  test('the student\'s own work and hand-added blocks stay', () => {
    const ids = blocksAfterTermEnd([
      block('done', '2026-12-06', { isDone: true }),
      block('written', '2026-12-06', { hasWork: true }),
      block('homework', '2026-12-06', { hasHomework: true }),
      block('by-hand', '2026-12-06', { templateId: null }),
    ], '2026-12-04');
    assert.deepEqual(ids, []);
  });
});

describe('editing a routine block', () => {
  const today = '2026-11-16'; // a Monday
  const previous = { dayOfWeek: 1, startTime: '20:00', endTime: '21:00' };
  const timed = (id, day, over = {}) => ({ ...block(id, day), startTime: '20:00', endTime: '21:00', ...over });

  test('same weekday: blocks from today on, still on the old slot, take the new times', () => {
    const r = followTemplateEdit([
      timed('past', '2026-11-09'),
      timed('today', '2026-11-16'),
      timed('next', '2026-11-23'),
      timed('missed-today', '2026-11-16', { isMissed: true }),
      timed('other-template', '2026-11-23', { templateId: 't2' }),
      timed('moved-by-hand', '2026-11-30', { startTime: '18:00', endTime: '19:00' }),
    ], { templateId: 't1', previous, dayOfWeek: 1, today });
    assert.deepEqual(r, { update: ['today', 'next'], withdraw: [] });
  });

  test('moved to another weekday: the blocks on the old day are withdrawn', () => {
    const r = followTemplateEdit([
      timed('mon', '2026-11-23'),
      timed('mon-homework', '2026-11-30', { hasHomework: true }),
      timed('mon-done', '2026-11-16', { isDone: true }),
      timed('moved-to-tue', '2026-11-24'),
    ], { templateId: 't1', previous, dayOfWeek: 3, today });
    assert.deepEqual(r, { update: ['mon-homework'], withdraw: ['mon'] });
  });

  test('weekday from a day key, and how a withdrawn block is written', () => {
    assert.equal(weekdayOf('2026-11-16'), 1);
    assert.deepEqual(WITHDRAWN, { isDeleted: true, templateId: null, examId: null });
  });
});
