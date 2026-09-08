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
  const all = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const pending = all.filter((name) => !applied.has(name));

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
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (stmtErr: any) {
          // If table or index already exists, skip it safely
          const msg = stmtErr?.message || '';
          if (msg.includes('already exists') || stmtErr?.meta?.message?.includes('already exists')) {
            continue;
          }
          throw stmtErr;
        }
      }
      await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO "${TABLE}" (name) VALUES (?)`, name);
      console.log(`[sqlite-migrate] applied ${name} (${statements.length} statements)`);
    } catch (err) {
      // Fail loudly only on real unrecoverable errors.
      console.error(`[sqlite-migrate] FAILED on ${name}:`, err);
      throw err;
    }
  }

  // Always, even when nothing was pending: a database repaired by an older
  // launch must not need a second one, and a database broken by an older
  // release has to heal itself the first time a fixed build runs.
  await reconcileColumns(dir, all);
}

/** One column as the migrations declare it: `"isAdmin" BOOLEAN NOT NULL DEFAULT false`. */
type ColumnDefs = Map<string, string>;

const CREATE_TABLE = /CREATE TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\n\s*\);/g;
const ADD_COLUMN = /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+("[^"]+"[^;]*);/g;

/** Every column the migration files describe, per table, latest definition winning. */
function declaredColumns(dir: string, migrations: string[]): Map<string, ColumnDefs> {
  const declared = new Map<string, ColumnDefs>();
  const columnsFor = (table: string) => {
    const existing = declared.get(table) ?? new Map<string, string>();
    declared.set(table, existing);
    return existing;
  };

  for (const name of migrations) {
    const file = join(dir, name, 'migration.sql');
    if (!existsSync(file)) continue;
    const sql = readFileSync(file, 'utf8');

    CREATE_TABLE.lastIndex = 0;
    for (let m = CREATE_TABLE.exec(sql); m; m = CREATE_TABLE.exec(sql)) {
      const columns = columnsFor(m[1]);
      for (const rawLine of m[2].split(/\r?\n/)) {
        const line = rawLine.trim().replace(/,$/, '');
        // Column lines start with a quoted name; CONSTRAINT ... lines do not.
        const named = /^"([^"]+)"\s+\S/.exec(line);
        if (named) columns.set(named[1], line);
      }
    }

    ADD_COLUMN.lastIndex = 0;
    for (let m = ADD_COLUMN.exec(sql); m; m = ADD_COLUMN.exec(sql)) {
      const definition = m[2].trim();
      const named = /^"([^"]+)"/.exec(definition);
      if (named) columnsFor(m[1]).set(named[1], definition);
    }
  }

  return declared;
}

/**
 * SQLite will not accept every column definition in an ALTER TABLE ADD COLUMN:
 * a non-constant default (CURRENT_TIMESTAMP) is rejected outright, and NOT NULL
 * without a default is rejected on a table that already has rows. Both are
 * added nullable instead and then backfilled with the value a fresh install
 * would have had, which is what `backfill` carries.
 */
function addableDefinition(definition: string): { sql: string; backfill: string | null } {
  const nonConstantDefault = /DEFAULT\s+CURRENT_(TIMESTAMP|TIME|DATE)/i.test(definition);
  const notNullNoDefault = /NOT NULL/i.test(definition) && !/DEFAULT/i.test(definition);
  if (!nonConstantDefault && !notNullNoDefault) return { sql: definition, backfill: null };

  const sql = definition
    .replace(/DEFAULT\s+CURRENT_(TIMESTAMP|TIME|DATE)/i, '')
    .replace(/NOT NULL/i, '')
    .replace(/UNIQUE/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const type = (/^"[^"]+"\s+(\w+)/.exec(sql)?.[1] ?? 'TEXT').toUpperCase();
  const backfill = nonConstantDefault || type === 'DATETIME'
    ? 'CURRENT_TIMESTAMP'
    : type === 'TEXT'
      ? "''"
      : '0';

  return { sql, backfill };
}

/**
 * Bring tables that already existed up to the shape the migrations describe.
 *
 * The loop above skips a statement whose object "already exists" - correct in
 * itself, the table IS there - but on a database that predates the migration
 * ledger that meant every such table kept the shape it had years ago while the
 * migration was still recorded as applied. The damage found on a real install:
 * 20 tables missing columns, User.isAdmin among them, so every Prisma query
 * failed with P2022 and the desktop app could only ever show its 503 page. New
 * installs were fine, which is exactly why it survived so long - only upgraders
 * were broken.
 *
 * Idempotent and cheap: one PRAGMA per table, and nothing else unless a column
 * is genuinely missing.
 */
async function reconcileColumns(dir: string, migrations: string[]): Promise<void> {
  let repaired = 0;

  for (const [table, columns] of declaredColumns(dir, migrations)) {
    const info = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("${table}")`
    );
    if (info.length === 0) continue; // Not in this database at all; not ours to touch.
    const present = new Set(info.map((c) => c.name));

    for (const [name, definition] of columns) {
      if (present.has(name)) continue;
      if (/PRIMARY KEY/i.test(definition)) {
        // SQLite cannot add one, and a table missing its key is past repairing.
        console.warn(`[sqlite-migrate] "${table}"."${name}" is a primary key and cannot be added`);
        continue;
      }

      const { sql, backfill } = addableDefinition(definition);
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${sql}`);
      if (backfill) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${name}" = ${backfill} WHERE "${name}" IS NULL`
        );
      }
      repaired += 1;
      console.log(`[sqlite-migrate] repaired ${table}.${name}`);
    }
  }

  if (repaired > 0) {
    console.log(`[sqlite-migrate] reconciled ${repaired} missing column(s)`);
  }
}
