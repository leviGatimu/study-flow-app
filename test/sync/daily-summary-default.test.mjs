import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Fleet, migrationNames, splitStatements } from './harness.mjs';

const migrationName = '20261025000000_daily_report_time';
const migrations = new URL('../../prisma/migrations-sqlite/', import.meta.url);

test('upgrading a desktop moves 21:00 to 23:58 and preserves custom times and other progress', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of migrationNames().filter(name => name < migrationName)) {
      const file = new URL(`${name}/migration.sql`, migrations);
      if (existsSync(file)) for (const statement of splitStatements(readFileSync(file, 'utf8'))) db.exec(statement);
    }
    const samples = [
      { id: 'legacy', time: '21:00', deletedAt: null },
      { id: 'custom', time: '22:30', deletedAt: null },
      { id: 'midnight', time: '00:00', deletedAt: null },
      { id: 'already-new', time: '23:58', deletedAt: null },
      { id: 'deleted', time: '21:00', deletedAt: 1 },
    ];
    for (const sample of samples) {
      db.prepare('INSERT INTO "User" (id, username, passwordHash) VALUES (?, ?, ?)').run(sample.id, sample.id, 'test-hash');
      db.prepare(`INSERT INTO "UserProgress"
        (id, userId, dailySummaryTime, xp, name, geminiApiKey, updatedAt, syncedAt, deletedAt)
        VALUES (?, ?, ?, 123, 'Test student', 'test-only-key', 1000, 2000, ?)`).run(sample.id, sample.id, sample.time, sample.deletedAt);
    }
    const select = () => db.prepare('SELECT * FROM "UserProgress" ORDER BY id').all().map(row => ({ ...row }));
    const before = select();
    const migration = readFileSync(new URL(`${migrationName}/migration.sql`, migrations), 'utf8');
    for (const statement of splitStatements(migration)) db.exec(statement);
    const after = select();
    for (let i = 0; i < before.length; i++) {
      if (before[i].id === 'legacy') {
        assert.equal(after[i].dailySummaryTime, '23:58');
        assert.equal(after[i].syncedAt, null);
        assert.ok(after[i].updatedAt > before[i].updatedAt);
        assert.deepEqual(after[i], { ...before[i], dailySummaryTime: '23:58', syncedAt: null, updatedAt: after[i].updatedAt });
      } else {
        assert.deepEqual(after[i], before[i]);
      }
    }
    for (const statement of splitStatements(migration)) db.exec(statement);
    assert.deepEqual(select(), after, 're-running does not dirty unchanged preferences');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('new Prisma profiles default to 23:58 even on an existing SQLite table', async () => {
  const fleet = await Fleet.create({ devices: [] });
  try {
    // Existing desktop tables retain their physical 21:00 default; Prisma's
    // generated create input must supply the new application default itself.
    const db = new DatabaseSync(fleet.server.dbPath, { readOnly: true });
    try {
      const field = db.prepare('PRAGMA table_info("UserProgress")').all().find(column => column.name === 'dailySummaryTime');
      assert.equal(field.dflt_value, "'21:00'");
    } finally {
      db.close();
    }
    const progress = await fleet.server.prisma.userProgress.create({ data: { userId: fleet.userId } });
    assert.equal(progress.dailySummaryTime, '23:58');
  } finally {
    await fleet.destroy();
  }
});
