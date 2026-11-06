import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CHANGELOG, CHANGE_LABELS } from '../lib/changelog.ts';

const pkg = JSON.parse(readFileSync(new URL('../desktop-app/package.json', import.meta.url), 'utf8'));
const parts = (version) => version.split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

test('the version being released has an entry, so none can be forgotten', () => {
  assert.ok(CHANGELOG.some((r) => r.version === pkg.version), `add ${pkg.version} to lib/changelog.ts`);
});

test('newest first, each version once', () => {
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.ok(newer(CHANGELOG[i - 1].version, CHANGELOG[i].version), `${CHANGELOG[i - 1].version} before ${CHANGELOG[i].version}`);
    assert.ok(CHANGELOG[i - 1].date >= CHANGELOG[i].date, `${CHANGELOG[i].version} date order`);
  }
});

test('every entry says something, in a known section', () => {
  for (const release of CHANGELOG) {
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(release.title.trim(), release.version);
    const sections = Object.entries(release.changes);
    assert.ok(sections.length > 0, `${release.version} has no changes`);
    for (const [kind, items] of sections) {
      assert.ok(kind in CHANGE_LABELS, kind);
      assert.ok(items.length > 0 && items.every((item) => item.trim()), `${release.version} ${kind}`);
    }
  }
});
