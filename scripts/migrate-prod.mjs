/**
 * Apply pending migrations to the web (Postgres) database, after showing them.
 *
 *   npm run db:migrate:web                     show what is pending (default)
 *   npm run db:migrate:web -- --apply          apply it, then confirm
 *   npm run db:migrate:web -- --env=PATH       read DATABASE_URL/DIRECT_URL from PATH
 *
 * Without --env it reads .env in the project root. The desktop app does
 * not need this: it applies prisma/migrations-sqlite itself on launch.
 *
 * Apply BEFORE deploying the web code that needs the change: the app selects
 * every column, so new code against an old database fails on every page.
 * Prisma's own `migrate deploy` does the work; this script only adds the
 * preview, the safety checks and the before/after status.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const envArg = args.find((a) => a.startsWith('--env='));
const envFile = path.resolve(root, envArg ? envArg.slice('--env='.length) : '.env');
const schema = path.join(root, 'prisma', 'schema.prisma');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!existsSync(envFile)) fail(`No env file at ${envFile}. Pass --env=<path to the .env with DATABASE_URL>.`);
process.loadEnvFile(envFile);

const url = process.env.DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\//.test(url)) fail('DATABASE_URL is not a Postgres URL. This script is for the web database only.');

// Say which database, without printing the password.
const target = (() => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(unreadable URL)';
  }
})();

function prisma(...command) {
  const result = spawnSync(process.execPath, [prismaCli, ...command, '--schema', schema], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Pending migration names, from `prisma migrate status`. */
function pendingMigrations() {
  const { out } = prisma('migrate', 'status');
  if (/failed/i.test(out) && !/not yet been applied/i.test(out)) {
    console.log(out);
    fail('A migration is marked as failed. Resolve it first (see the output above).');
  }
  if (/P1001|Can't reach database|P1000|Authentication failed/i.test(out)) {
    console.log(out);
    fail('Could not connect to the database.');
  }
  if (/up to date/i.test(out)) return [];
  const after = out.split(/not yet been applied:?/i)[1];
  if (!after) {
    console.log(out);
    fail('Could not read the migration status (see the output above).');
  }
  return after.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d{14}_[\w-]+$/.test(l));
}

console.log(`Database: ${target}`);
const pending = pendingMigrations();

if (pending.length === 0) {
  console.log('✔ Up to date. Nothing to apply.');
  process.exit(0);
}

console.log(`\n${pending.length} pending:\n`);
for (const name of pending) {
  const file = path.join(root, 'prisma', 'migrations', name, 'migration.sql');
  console.log(`── ${name}`);
  console.log(existsSync(file) ? readFileSync(file, 'utf8').trim() : '(migration.sql not found in this checkout)');
  console.log('');
}

if (!APPLY) {
  console.log('Nothing was changed. Run again with --apply to apply the migrations above.');
  process.exit(0);
}

console.log('Applying…');
const deploy = prisma('migrate', 'deploy');
console.log(deploy.out.trim());
if (deploy.code !== 0) fail('migrate deploy failed. The database was left as Prisma reported above.');

const left = pendingMigrations();
if (left.length) fail(`Still pending after deploy: ${left.join(', ')}`);
console.log(`\n✔ Applied ${pending.length}. ${target} is up to date.`);
