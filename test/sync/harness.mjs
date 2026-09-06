/**
 * Two-device sync test harness.
 *
 * Sync bugs do not appear in a single process. They appear when two devices
 * diverge offline and then reconnect, so the only way to prove a merge rule is
 * to have two real databases, drive them apart, and merge them. This builds
 * that: N isolated SQLite databases, each with a real Prisma client, all built
 * from the REAL migrations in prisma/migrations-sqlite.
 *
 * It deliberately uses its own Prisma client, generated to
 * node_modules/.prisma/client-sqlite-test by `npm run test:sync:setup`. The
 * desktop build generates its SQLite client over the web one (same output
 * path), so using that here would swap the client out from under a running
 * `npm run dev` - and on Windows the generate dies half-finished with EPERM,
 * leaving the app broken. The harness must never be able to do that.
 *
 *   npm run test:sync:setup     once, after any schema change
 *   npm run test:sync
 */

import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATIONS = join(ROOT, 'prisma', 'migrations-sqlite');
const CLIENT_DIR = join(ROOT, 'node_modules', '.prisma', 'client-sqlite-test');

const require = createRequire(import.meta.url);

/**
 * Split a migration file into executable statements.
 *
 * This is a copy of the splitter in lib/sqlite-migrate.ts rather than an import,
 * because that module pulls in the app's Prisma client and cannot be loaded from
 * a plain node test. assertSplitterInSync() below fails the suite if the shipped
 * one ever changes, so the copy cannot rot silently - which matters, because a
 * bug in that splitter is exactly what made every desktop install ship an empty
 * database.
 */
export function splitStatements(sql) {
  return sql
    .split(/;\s*$/m)
    .map((chunk) =>
      chunk
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean);
}

export function assertSplitterInSync() {
  const shipped = readFileSync(join(ROOT, 'lib', 'sqlite-migrate.ts'), 'utf8');
  const markers = [
    ".split(/;\\s*$/m)",
    ".filter((line) => !line.trim().startsWith('--'))",
    ".filter(Boolean)",
  ];
  const missing = markers.filter((m) => !shipped.includes(m));
  if (missing.length) {
    throw new Error(
      'lib/sqlite-migrate.ts no longer matches the harness copy of the statement ' +
        'splitter. Update splitStatements() in test/sync/harness.mjs to match. ' +
        `Missing: ${missing.join(' | ')}`
    );
  }
}

/** Every migration folder, in the order the desktop app applies them. */
export function migrationNames() {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Build a schema in a fresh SQLite file using the real migrations. */
function buildSchema(dbPath) {
  const db = new DatabaseSync(dbPath);
  let statements = 0;
  try {
    for (const name of migrationNames()) {
      const file = join(MIGRATIONS, name, 'migration.sql');
      if (!existsSync(file)) continue;
      for (const statement of splitStatements(readFileSync(file, 'utf8'))) {
        db.exec(statement);
        statements++;
      }
    }
  } finally {
    db.close();
  }
  return statements;
}

/**
 * One participant in a sync scenario: a device, or the server. Both are just
 * databases with a name, which is the point - the merge rules should not care
 * which side they are running on.
 */
export class Node {
  constructor(name, dbPath, prisma) {
    this.name = name;
    this.dbPath = dbPath;
    this.prisma = prisma;
  }

  /** Rows of one model, ordered stably, for comparing two nodes. */
  async rows(model, { where = {}, orderBy = { id: 'asc' } } = {}) {
    return this.prisma[model].findMany({ where, orderBy });
  }

  async count(model, where = {}) {
    return this.prisma[model].count({ where });
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

/**
 * A scenario: one server and however many devices, each isolated, all sharing
 * the same user identity so that sync has something to key on.
 */
export class Fleet {
  constructor(dir) {
    this.dir = dir;
    this.nodes = new Map();
    this.userId = null;
  }

  static async create({ devices = ['A', 'B'], seedUser = true } = {}) {
    if (!existsSync(CLIENT_DIR)) {
      throw new Error(
        'The harness Prisma client is missing. Run: npm run test:sync:setup'
      );
    }
    assertSplitterInSync();

    const fleet = new Fleet(mkdtempSync(join(tmpdir(), 'studyflow-sync-')));
    const { PrismaClient } = require(join(CLIENT_DIR, 'index.js'));

    for (const name of ['server', ...devices]) {
      const dbPath = join(fleet.dir, `${name}.db`);
      buildSchema(dbPath);
      const prisma = new PrismaClient({
        datasources: { db: { url: `file:${dbPath}` } },
      });
      fleet.nodes.set(name, new Node(name, dbPath, prisma));
    }

    if (seedUser) await fleet.seedUser();
    return fleet;
  }

  get server() {
    return this.nodes.get('server');
  }

  device(name) {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`no such node: ${name}`);
    return node;
  }

  /** Every node except the server. */
  get devices() {
    return [...this.nodes.values()].filter((n) => n.name !== 'server');
  }

  get all() {
    return [...this.nodes.values()];
  }

  /**
   * The same user, with the SAME id, on every node.
   *
   * Real life gets this for free: you register online, then each device pulls
   * that user down. Sync of anything else is meaningless without it, so the
   * harness asserts it rather than leaving it to each test.
   */
  async seedUser({ username = 'levi', id = 'user_test_levi' } = {}) {
    this.userId = id;
    for (const node of this.all) {
      await node.prisma.user.create({
        data: { id, username, passwordHash: 'not-a-real-hash', currentTerm: 'Term 1' },
      });
    }
    return id;
  }

  /**
   * Compare one model across nodes. Returns null when they agree, or a
   * description of the first difference - which is what a sync test asserts on.
   */
  async diff(model, { ignore = ['updatedAt'] } = {}) {
    const strip = (row) => {
      const copy = { ...row };
      for (const field of ignore) delete copy[field];
      return copy;
    };

    const snapshots = [];
    for (const node of this.all) {
      const rows = (await node.rows(model)).map(strip);
      snapshots.push({ node: node.name, rows });
    }

    const [first, ...rest] = snapshots;
    for (const other of rest) {
      if (JSON.stringify(first.rows) !== JSON.stringify(other.rows)) {
        return {
          model,
          left: first.node,
          right: other.node,
          leftCount: first.rows.length,
          rightCount: other.rows.length,
          leftRows: first.rows,
          rightRows: other.rows,
        };
      }
    }
    return null;
  }

  async destroy() {
    for (const node of this.all) await node.close();
    try {
      rmSync(this.dir, { recursive: true, force: true });
    } catch {
      // Windows sometimes still holds the file briefly; a temp dir left behind
      // is not worth failing a test over.
    }
  }
}
