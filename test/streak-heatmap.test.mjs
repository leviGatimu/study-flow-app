import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildHeatmap, levelOf, milestones, nextMilestone, thisWeek } from '../lib/streak-heatmap.ts';

describe('streak heatmap', () => {
  test('levels step at each hour', () => {
    assert.deepEqual([0, 1, 59, 60, 119, 120, 179, 180, 600].map(levelOf), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test('the grid ends with the week holding today, Monday first', () => {
    // 2026-11-05 is a Thursday.
    const grid = buildHeatmap({}, [], '2026-11-05', 4);
    assert.equal(grid.length, 4);
    const last = grid[3].cells;
    assert.equal(last[0].key, '2026-11-02');
    assert.equal(last[3].key, '2026-11-05');
    assert.equal(last[3].future, false);
    assert.equal(last[4].future, true);
    assert.equal(grid[0].cells[0].key, '2026-10-12');
  });

  test('minutes set the shade; a studied day without minutes still shows', () => {
    const grid = buildHeatmap({ '2026-11-03': 150 }, ['2026-11-04'], '2026-11-05', 1);
    const [mon, tue, wed] = grid[0].cells;
    assert.equal(mon.level, 0);
    assert.equal(tue.level, 3);
    assert.equal(tue.minutes, 150);
    assert.equal(wed.level, 1);
  });

  test('future days are empty even with data', () => {
    const grid = buildHeatmap({ '2026-11-07': 300 }, ['2026-11-07'], '2026-11-05', 1);
    assert.equal(grid[0].cells[5].level, 0);
    assert.equal(grid[0].cells[5].minutes, 0);
  });

  test('month labels mark the first week of each month', () => {
    const grid = buildHeatmap({}, [], '2026-11-05', 10);
    const labels = grid.map((w) => w.month).filter(Boolean);
    assert.ok(labels.includes('Oct'));
    assert.ok(labels.includes('Nov'));
  });
});

describe('week strip and milestones', () => {
  test('this week marks today, studied days and the days still to come', () => {
    const week = thisWeek(['2026-11-02', '2026-11-05'], '2026-11-05');
    assert.deepEqual(week.map((d) => d.studied), [true, false, false, true, false, false, false]);
    assert.equal(week[3].isToday, true);
    assert.equal(week[4].future, true);
  });

  test('milestones are reached by the best streak; the next one counts down', () => {
    assert.deepEqual(milestones(10).slice(0, 4).map((m) => m.reached), [true, true, false, false]);
    assert.deepEqual(nextMilestone(12), { days: 14, left: 2 });
    assert.equal(nextMilestone(400), null);
  });
});
