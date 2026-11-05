import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { dayWindow, duration, placeBlocks, span, timeSnapshot } from '../lib/time-view.ts';

const block = (id, startTime, endTime, extra = {}) => ({ id, subject: id, type: 'HOMEWORK', startTime, endTime, isDone: false, ...extra });
const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

describe('time view', () => {
  test('a block ending at or before its start runs past midnight', () => {
    assert.deepEqual(span({ startTime: '22:30', endTime: '00:00' }), [1350, 1440]);
  });

  test('blocks are placed in time order with their state', () => {
    const placed = placeBlocks([
      block('later', '21:00', '22:00'),
      block('done', '17:00', '18:00', { isDone: true }),
      block('now', '19:00', '20:30'),
      block('missed', '18:00', '18:30', { isMissed: true }),
    ], at('19:30'));
    assert.deepEqual(placed.map((b) => `${b.id}:${b.state}`), ['done:done', 'missed:missed', 'now:now', 'later:later']);
  });

  test('the snapshot finds now, next, progress and what is left', () => {
    const s = timeSnapshot([block('a', '19:00', '21:00'), block('b', '21:30', '22:30'), block('c', '18:00', '19:00', { isDone: true })], at('20:00'));
    assert.equal(s.current.id, 'a');
    assert.equal(s.currentProgress, 50);
    assert.equal(s.currentLeft, 60);
    assert.equal(s.next.id, 'b');
    assert.equal(s.untilNext, 90);
    assert.equal(s.done, 1);
    assert.equal(s.total, 3);
    assert.equal(s.plannedLeft, 120);
  });

  test('an empty day has a six-hour window around now', () => {
    assert.deepEqual(dayWindow([], at('14:20')), { from: at('11:00'), to: at('17:00') });
  });

  test('the window covers every block with an hour either side', () => {
    const placed = placeBlocks([block('a', '19:00', '21:00'), block('b', '22:30', '00:00')], at('10:15'));
    assert.deepEqual(dayWindow(placed, at('10:15')), { from: at('09:00'), to: 25 * 60 });
  });

  test('durations read plainly', () => {
    assert.equal(duration(80), '1h 20m');
    assert.equal(duration(120), '2h');
    assert.equal(duration(0.4), 'under a minute');
  });
});
