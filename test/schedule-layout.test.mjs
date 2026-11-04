import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryRange, scheduleDuration, scheduleGroups, scheduleLayout, scheduleOffset, scheduleHour } from '../lib/schedule-layout.ts';

const entry = (id, startTime, endTime, day = 'Monday', kind = 'school') => ({ id, day, title: 'Embedded System Software', startTime, endTime, kind });

test('back-to-back lessons stay separate and time-aligned across days', () => {
  const items = [entry('a', '08:00','08:50'), entry('b','08:50','09:40'), entry('c','08:00','08:50','Tuesday')];
  const layout = scheduleLayout(items);
  assert.equal(layout.groups.length, 3);
  assert.ok(layout.points.includes(530));
  const monday = layout.groups.find((group) => group.entries[0].id === 'a');
  const tuesday = layout.groups.find((group) => group.entries[0].id === 'c');
  assert.equal(scheduleOffset(monday.end,layout.points,layout.heights), scheduleOffset(tuesday.end,layout.points,layout.heights));
});

test('overlapping and transitively overlapping tasks remain visible in one group', () => {
  const items = [entry('c','20:15','21:00'),entry('a','19:00','20:00'),entry('b','19:30','20:30')];
  const layout = scheduleLayout(items);
  assert.equal(layout.groups.length,1);
  assert.deepEqual(layout.groups[0].entries.map((item)=>item.id),['a','b','c']);
  const group=layout.groups[0];
  const height=scheduleOffset(group.end,layout.points,layout.heights)-scheduleOffset(group.start,layout.points,layout.heights);
  assert.ok(height >= 3*88+24);
  assert.deepEqual(items.map((item)=>item.id),['c','a','b']);
});

test('overnight study retains the following-day end and correct duration', () => {
  const item=entry('overnight','22:30','00:30','Friday','revision');
  assert.deepEqual(entryRange(item),{start:1350,end:1470});
  assert.equal(scheduleDuration(item),'2h');
  assert.equal(scheduleLayout([item]).end,1500);
  assert.equal(scheduleHour(1470),'00:30 +1');
});

test('short breaks and long titles have enough space without dropping content', () => {
  const long={...entry('long','08:00','08:10'),title:'Embedded System Software and Advanced Network Administration'};
  const pause=entry('break','08:10','08:15','Monday','break');
  const layout=scheduleLayout([long,pause]);
  assert.ok(scheduleOffset(490,layout.points,layout.heights)>=132);
  const pauseHeight=scheduleOffset(495,layout.points,layout.heights)-scheduleOffset(490,layout.points,layout.heights);
  assert.ok(pauseHeight>=44);
  assert.equal(layout.groups[0].entries[0].title,long.title);
});

test('empty schedules and legacy zero-duration entries produce finite layouts', () => {
  assert.ok(scheduleLayout([]).heights.every(Number.isFinite));
  const layout=scheduleLayout([entry('zero','09:00','09:00')]);
  assert.ok(layout.heights.every((height)=>Number.isFinite(height)&&height>0));
  assert.equal(scheduleDuration(entry('zero','09:00','09:00')),'0m');
});

test('duplicate start times on different days do not become overlaps', () => {
  assert.equal(scheduleGroups([entry('a','09:00','10:00'),entry('b','09:00','10:00','Tuesday')]).length,2);
});
