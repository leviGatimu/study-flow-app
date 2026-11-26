import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fillDataBlocks, readWidget, widgetForDisplay, widgetsForModel } from '../lib/chat-ui.ts';

const DATA = {
  todayKey: '2026-11-26',
  tomorrowKey: '2026-11-27',
  schedule: {
    '2026-11-26': { label: 'Today', rows: [{ start: '19:00', end: '20:00', subject: 'Java', type: 'REVISION', status: 'pending' }] },
    '2026-11-27': { label: 'Tomorrow', rows: [] },
  },
  exams: [{ title: 'Java final', subject: 'Java', date: 'Tue 1 Dec', daysLeft: 5, time: '08:30' }],
  homework: [],
  marks: [{ subject: 'Java', percent: 82, goal: 80 }],
};
const block = (obj) => '```ui\n' + JSON.stringify(obj) + '\n```';
const savedOf = (text) => JSON.parse(text.match(/```ui\n(.*)\n```/)[1]);

test('a schedule card is filled with the real rows, whatever the model wrote', () => {
  const out = fillDataBlocks(`Here you go.\n\n${block({ type: 'schedule', day: 'today', rows: [{ subject: 'FAKE' }] })}\n\nGood luck.`, DATA);
  const saved = savedOf(out);
  assert.equal(saved.label, 'Today');
  assert.deepEqual(saved.rows, DATA.schedule['2026-11-26'].rows);
  assert.match(out, /^Here you go\./);
  assert.match(out, /Good luck\.$/);
});

test('exams and marks cards use the records; an unknown day is dropped', () => {
  assert.deepEqual(savedOf(fillDataBlocks(block({ type: 'exams' }), DATA)).rows, DATA.exams);
  assert.deepEqual(savedOf(fillDataBlocks(block({ type: 'marks', title: 'Marks' }), DATA)).rows, DATA.marks);
  assert.equal(fillDataBlocks(`a ${block({ type: 'schedule', day: '2027-01-01' })}`, DATA), 'a ');
});

test('drawn cards are checked and capped; broken ones vanish', () => {
  assert.equal(fillDataBlocks(block({ type: 'nope' }), DATA), '');
  assert.equal(fillDataBlocks('```ui\n{not json\n```', DATA), '');
  const bars = readWidget({ type: 'bars', items: [{ label: 'A', value: 40 }, { label: 'B', value: -1 }, { label: '', value: 3 }, { label: 'C', value: 'x' }] });
  assert.deepEqual(bars, { type: 'bars', title: undefined, unit: undefined, max: 40, items: [{ label: 'A', value: 40 }] });
  assert.equal(readWidget({ type: 'stats', items: [] }), null);
  assert.equal(readWidget({ type: 'callout', text: 'Hi', tone: 'purple' }).tone, 'info');
  const table = readWidget({ type: 'table', columns: ['Day', 'Subject'], rows: [['Mon'], ['Tue', 'Java', 'extra']] });
  assert.deepEqual(table.rows, [['Mon', ''], ['Tue', 'Java']]);
  assert.deepEqual(readWidget({ type: 'checklist', items: ['Read notes', { text: 'Past paper', done: true }] }).items, [
    { text: 'Read notes', done: false },
    { text: 'Past paper', done: true },
  ]);
});

test('display keeps the saved rows; the model sees one line per card', () => {
  const saved = fillDataBlocks(block({ type: 'schedule', day: 'today' }), DATA);
  const json = saved.match(/```ui\n(.*)\n```/)[1];
  assert.equal(widgetForDisplay(json).rows.length, 1);
  assert.equal(widgetForDisplay('{oops'), null);
  assert.equal(widgetsForModel(`Hi\n${saved}`), 'Hi\n(A schedule card was shown.)');
});

test('splitReply separates text and cards, including one still being written', async () => {
  const { splitReply } = await import('../lib/chat-ui.ts');
  const parts = splitReply('Hi\n\n```ui\n{"type":"exams"}\n```\n\nBye');
  assert.deepEqual(parts.map((p) => p.kind), ['text', 'widget', 'text']);
  assert.equal(parts[1].json, '{"type":"exams"}');
  assert.equal(parts[1].complete, true);
  const live = splitReply('Hi\n\n```ui\n{"type":"sta');
  assert.deepEqual(live.map((p) => [p.kind, p.complete ?? null]), [['text', null], ['widget', false]]);
  assert.deepEqual(splitReply('Just text'), [{ kind: 'text', text: 'Just text' }]);
  assert.deepEqual(splitReply('```js\nx\n```'), [{ kind: 'text', text: '```js\nx\n```' }]);
});
