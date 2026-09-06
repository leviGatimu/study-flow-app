import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { prisma } from '@/lib/prisma';

/**
 * Apply pending SQLite migrations to the user's local database on launch.
 *
 * The desktop app ships as an installer, so when a release adds a column every
 * existing user's database.db has to be brought forward. `prisma migrate
 * deploy` is not an option there: it needs the Prisma CLI and a node_modules
 * tree that a packaged Electron app does not have. So this applies the same
 * .sql files itself and records what it has run, which is all `migrate deploy`
 * really does.
 *
 * Only ever runs against SQLite. On Postgres (the web build) it is a no-op -
 * that database is migrated deliberately, not on boot.
 */

const TABLE = '_local_migrations';

function migrationsDir(): string | null {
  // In dev the app runs from the repo root; when packaged, electron-builder
  // copies ../prisma next to the standalone server.
  // process.resourcesPath is set by Electron and absent from Node's types.
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;

  const candidates = [
    join(process.cwd(), 'prisma', 'migrations-sqlite'),
    join(process.cwd(), '..', 'prisma', 'migrations-sqlite'),
    resourcesPath ? join(resourcesPath, 'prisma', 'migrations-sqlite') : '',
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

export async function runSqliteMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('file:')) return; // Postgres build - not our business.

  const dir = migrationsDir();
  if (!dir) {
    console.warn('[sqlite-migrate] no migrations-sqlite directory found; skipping');
    return;
  }

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${TABLE}" (
       "name"       TEXT PRIMARY KEY NOT NULL,
       "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );

  const applied = new Set(
    (
      await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM "${TABLE}"`)
    ).map((r) => r.name)
  );

  // Lexicographic order is the migration order, same convention as Prisma.
  const pending = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .filter((name) => !applied.has(name));

  if (pending.length === 0) return;

  for (const name of pending) {
    const file = join(dir, name, 'migration.sql');
    if (!existsSync(file)) continue;

    const sql = readFileSync(file, 'utf8');
    // Prisma's SQLite output is one statement per ";" at end of line. Executed
    // individually because the driver does not accept multi-statement strings.
    //
    // Every generated statement is preceded by its own "-- CreateTable" style
    // comment, so comment lines are stripped from INSIDE each chunk. Dropping a
    // chunk merely because it started with a comment discarded all 29 CREATE
    // TABLEs while still recording the migration as applied, which left a fresh
    // install with an empty database that could never repair itself.
    // Only whole comment lines go: a "--" inside a string literal must survive.
    const statements = sql
      .split(/;\s*$/m)
      .map((chunk) =>
        chunk
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter(Boolean);

    try {
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(`INSERT INTO "${TABLE}" (name) VALUES (?)`, name);
      console.log(`[sqlite-migrate] applied ${name} (${statements.length} statements)`);
    } catch (err) {
      // Fail loudly. A half-migrated database must not be quietly served: the
      // launcher takes a backup before boot precisely so this is recoverable.
      console.error(`[sqlite-migrate] FAILED on ${name}:`, err);
      throw err;
    }
  }
}
