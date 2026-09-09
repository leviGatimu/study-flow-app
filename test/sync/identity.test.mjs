/**
 * Guards the identity map against schema drift.
 *
 * The map is only useful if it stays true: a model added to the schema without
 * a rule would silently never sync, and a natural key naming a field that has
 * been renamed would match nothing and duplicate every row. Both failures are
 * invisible at runtime until data is already wrong, so they are checked here
 * against the generated client's own model metadata rather than by eye.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SYNC_RULES, SYNCED_MODELS, DERIVED_MODELS, REPARENT_BEFORE_DELETE } from '../../lib/sync/identity.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { Prisma } = require(join(ROOT, 'node_modules', '.prisma', 'client-sqlite-test', 'index.js'));

/** Prisma names models in PascalCase; the client exposes them camelCase. */
const camel = (name) => name.charAt(0).toLowerCase() + name.slice(1);

const MODELS = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [camel(m.name), new Set(m.fields.map((f) => f.name))])
);

describe('identity map', () => {
  test('covers every model in the schema', () => {
    const missing = [...MODELS.keys()].filter((m) => !(m in SYNC_RULES));
    assert.deepEqual(
      missing,
      [],
      `these models have no sync rule - decide explicitly, do not leave them undeclared: ${missing.join(', ')}`
    );
  });

  test('names no model that does not exist', () => {
    const unknown = Object.keys(SYNC_RULES).filter((m) => !MODELS.has(m));
    assert.deepEqual(unknown, [], `unknown models in the map: ${unknown.join(', ')}`);
  });

  test('every natural key names real fields on that model', () => {
    const problems = [];
    for (const [model, rule] of Object.entries(SYNC_RULES)) {
      if (rule.match !== 'NATURAL_KEY') continue;
      assert.ok(rule.key?.length, `${model}: NATURAL_KEY needs a key`);
      for (const field of rule.key) {
        if (!MODELS.get(model)?.has(field)) problems.push(`${model}.${field}`);
      }
    }
    assert.deepEqual(problems, [], `natural keys reference missing fields: ${problems.join(', ')}`);
  });

  test('accumulated and monotonic fields exist on their model', () => {
    const problems = [];
    for (const [model, rule] of Object.entries(SYNC_RULES)) {
      for (const field of [...(rule.accumulated ?? []), ...(rule.monotonic ?? [])]) {
        if (!MODELS.get(model)?.has(field)) problems.push(`${model}.${field}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('every rule explains itself', () => {
    for (const [model, rule] of Object.entries(SYNC_RULES)) {
      assert.ok(rule.why && rule.why.length > 20, `${model}: needs a real justification`);
    }
  });

  test('re-parent targets are real models with real foreign keys', () => {
    for (const [parent, children] of Object.entries(REPARENT_BEFORE_DELETE)) {
      assert.ok(MODELS.has(parent), `REPARENT_BEFORE_DELETE names unknown model ${parent}`);
      for (const { model, fk } of children) {
        assert.ok(MODELS.has(model), `unknown child model ${model}`);
        assert.ok(
          MODELS.get(model).has(fk),
          `${model}.${fk} does not exist - a cascade would not be caught`
        );
      }
    }
  });

  test('every model matched by natural key that can cascade has a re-parent plan', () => {
    // Deleting a duplicate is only safe if its cascade children are re-parented
    // first. Any model whose children cascade must appear in the plan.
    const cascadeParents = ['class', 'term', 'scheduleTemplate'];
    for (const parent of cascadeParents) {
      assert.ok(
        REPARENT_BEFORE_DELETE[parent]?.length,
        `${parent} cascades to children but has no re-parent plan - a merge would delete history`
      );
    }
  });

  test('v1 scope is what we decided, not whatever accumulated', () => {
    assert.deepEqual(
      [...SYNCED_MODELS].sort(),
      [
        'class', 'examEvent', 'homework', 'markedDay', 'masteryItem', 'reportCard',
        'resource', 'scheduleTemplate', 'schoolLesson', 'studioNote', 'subject', 'subjectGoal',
        'subjectGrade', 'task', 'term', 'user', 'userProgress', 'xpEvent',
      ],
      'the synced set changed - if that was deliberate, update this test and HANDOFF.md'
    );
    assert.deepEqual([...DERIVED_MODELS].sort(), ['dailySummary', 'weeklySummary']);
  });

  test('nothing synced points at something local-only', () => {
    // A synced row referencing a local-only row is a dangling reference on the
    // other device. This is why examEvent is in scope: task.examId points at it.
    const localOnly = new Set(
      Object.entries(SYNC_RULES)
        .filter(([, r]) => r.match === 'LOCAL_ONLY')
        .map(([m]) => m)
    );

    const dangling = [];
    for (const model of SYNCED_MODELS) {
      const dmmf = Prisma.dmmf.datamodel.models.find((m) => camel(m.name) === model);
      for (const field of dmmf.fields) {
        if (field.kind !== 'object' || field.isList) continue;
        if (localOnly.has(camel(field.type))) dangling.push(`${model}.${field.name} -> ${field.type}`);
      }
    }
    assert.deepEqual(
      dangling,
      [],
      `synced models reference local-only models: ${dangling.join(', ')}`
    );
  });
});
