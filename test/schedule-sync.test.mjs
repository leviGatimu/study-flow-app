/**
 * Made blocks follow the plan: none after the term's last day, and routine
 * edits reach the blocks already made from that routine block.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { blocksAfterTermEnd, blocksOfRemovedRoutine, followTemplateEdit, outOfStepBlocks, weekdayOf, WITHDRAWN } from '../lib/schedule-sync.ts';

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

describe('blocks left behind by an older routine', () => {
  const today = '2026-11-17'; // a Tuesday
  // Java moved from Monday 20:00 to Wednesday 18:00, edited at time 100.
  const routine = [{ id: 't1', dayOfWeek: 3, startTime: '18:00', endTime: '19:00', subject: 'Java', type: 'HOMEWORK', changedAt: 100 }];
  const made = (id, day, over = {}) => ({
    ...block(id, day), startTime: '20:00', endTime: '21:00', subject: 'Java', type: 'HOMEWORK', changedAt: 50, ...over,
  });

  test('made before the edit: on the old day withdrawn, on the routine day retimed', () => {
    const r = outOfStepBlocks([
      made('old-monday', '2026-11-23'),
      made('wednesday-old-times', '2026-11-18'),
      made('wednesday-in-step', '2026-11-25', { startTime: '18:00', endTime: '19:00' }),
    ], routine, new Set(), today);
    assert.deepEqual(r, { update: [{ id: 'wednesday-old-times', templateId: 't1' }], withdraw: ['old-monday'] });
  });

  test('changes made by the student, history and other routines stay', () => {
    const r = outOfStepBlocks([
      made('changed-after-edit', '2026-11-23', { changedAt: 150 }),
      made('past', '2026-11-16'),
      made('done', '2026-11-23', { isDone: true }),
      made('homework', '2026-11-23', { hasHomework: true }),
      made('missed', '2026-11-17', { isMissed: true }),
      made('other-routine', '2026-11-23', { templateId: 't9' }),
      made('by-hand', '2026-11-23', { templateId: null }),
    ], routine, new Set(), today);
    assert.deepEqual(r, { update: [], withdraw: [] });
  });

  test('a block moved by hand off the routine day is a move, not a stale copy', () => {
    const r = outOfStepBlocks(
      [made('moved-to-thursday', '2026-11-19')],
      routine,
      new Set(['t1|2026-11-18']),
      today
    );
    assert.deepEqual(r, { update: [], withdraw: [] });
  });
});

test('blocks still waiting from a removed routine block go; history and own work stay', () => {
  const ids = blocksOfRemovedRoutine([
    block('upcoming', '2026-11-24', { templateId: 'gone' }),
    block('today', '2026-11-17', { templateId: 'gone' }),
    block('past', '2026-11-10', { templateId: 'gone' }),
    block('missed', '2026-11-17', { templateId: 'gone', isMissed: true }),
    block('homework', '2026-11-24', { templateId: 'gone', hasHomework: true }),
    block('still-in-routine', '2026-11-24', { templateId: 't1' }),
  ], new Set(['gone']), '2026-11-17');
  assert.deepEqual(ids, ['upcoming', 'today']);
});
