import { test } from 'node:test';
import assert from 'node:assert/strict';

import { liveReplyText, parsePlanRequest, planForModel, planReference, replacePlan, splitPlan } from '../lib/copilot-plan.ts';

const TODAY = '2026-11-26';
const line = (obj) => `Here is a plan.\n\n[[PLAN ${JSON.stringify(obj)}]]`;

test('a plan line becomes a checked plan, sorted by date and time', () => {
  const parsed = parsePlanRequest(
    line({
      title: 'Physics exam prep',
      steps: [
        { kind: 'block', subject: 'Physics', date: '2026-11-30', start: '19:00', end: '20:00', type: 'REVISION' },
        { kind: 'exam', subject: 'Physics', date: '2026-12-02', start: '8:30', end: '11:00', category: 'Midterm' },
        { kind: 'block', subject: 'Physics', date: '2026-11-28', start: '18:00', end: '19:00' },
      ],
    }),
    TODAY
  );
  assert.equal(parsed.kind, 'plan');
  assert.equal(parsed.before, 'Here is a plan.');
  assert.equal(parsed.plan.title, 'Physics exam prep');
  assert.deepEqual(parsed.plan.steps.map((s) => s.date), ['2026-11-28', '2026-11-30', '2026-12-02']);
  assert.equal(parsed.plan.steps[0].type, 'REVISION');
  assert.deepEqual(parsed.plan.steps[2], { kind: 'exam', subject: 'Physics', date: '2026-12-02', start: '08:30', end: '11:00', category: 'Midterm' });
});

test('bad steps are dropped: past dates, bad times, unknown kinds, no subject', () => {
  const parsed = parsePlanRequest(
    line({
      steps: [
        { kind: 'block', subject: 'Math', date: '2026-11-25', start: '19:00', end: '20:00' },
        { kind: 'block', subject: 'Math', date: '2026-11-27', start: '25:00', end: '20:00' },
        { kind: 'block', subject: 'Math', date: '2026-02-30', start: '19:00', end: '20:00' },
        { kind: 'delete', subject: 'Math', date: '2026-11-27' },
        { kind: 'block', subject: '', date: '2026-11-27', start: '19:00', end: '20:00' },
        { kind: 'exam', subject: 'Math', date: '2026-12-01', start: '09:00', end: null, category: 'null' },
        { kind: 'block', subject: 'Math', date: '2026-11-27', start: '19:00', end: '20:00', type: 'HOMEWORK' },
      ],
    }),
    TODAY
  );
  assert.equal(parsed.kind, 'plan');
  assert.equal(parsed.plan.title, 'Your plan');
  assert.equal(parsed.plan.steps.length, 2);
  assert.deepEqual(parsed.plan.steps[0], { kind: 'block', subject: 'Math', date: '2026-11-27', start: '19:00', end: '20:00', type: 'HOMEWORK' });
  // One time only: the exam is kept without times, like the form.
  assert.deepEqual(parsed.plan.steps[1], { kind: 'exam', subject: 'Math', date: '2026-12-01', start: null, end: null, category: null });
});

test('no line, broken JSON and empty plans', () => {
  assert.deepEqual(parsePlanRequest('Just an answer.', TODAY), { kind: 'none' });
  assert.equal(parsePlanRequest('x [[PLAN {nope}]]', TODAY).kind, 'invalid');
  const empty = parsePlanRequest(line({ steps: [] }), TODAY);
  assert.equal(empty.kind, 'invalid');
  assert.equal(empty.before, 'Here is a plan.');
});

test('a saved plan round-trips, and Yes / Not now replace it in place', () => {
  const plan = { title: 'Prep ]] here', steps: [{ kind: 'block', subject: 'Java', date: '2026-11-27', start: '19:00', end: '20:00', type: 'REVISION' }] };
  const saved = `Sure.\n\n${planReference('PROPOSED', plan)}`;
  const split = splitPlan(saved);
  assert.equal(split.text, 'Sure.');
  assert.equal(split.plan.state, 'PROPOSED');
  assert.equal(split.plan.plan.title, 'Prep ] ] here');
  const applied = replacePlan(saved, { state: 'APPLIED', plan: { ...split.plan.plan, steps: [{ ...plan.steps[0], outcome: 'done' }] } });
  assert.equal(splitPlan(applied).plan.state, 'APPLIED');
  assert.equal(splitPlan(applied).plan.plan.steps[0].outcome, 'done');
  assert.match(planForModel(applied), /the student said yes/);
  assert.match(planForModel(applied), /revision Java on 2026-11-27 19:00-20:00/);
  assert.equal(splitPlan('nothing here').plan, null);
});

test('liveReplyText hides the machine line, even half-written', () => {
  assert.equal(liveReplyText('Making it now.\n\n[[PLAN {"title":'), 'Making it now.');
  assert.equal(liveReplyText('Making it now.\n\n[[PRA'), 'Making it now.');
  assert.equal(liveReplyText('Making it now. [['), 'Making it now.');
  assert.equal(liveReplyText('An array a[i] is fine'), 'An array a[i] is fine');
  assert.equal(liveReplyText('Plain text'), 'Plain text');
});
