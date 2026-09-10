import { PrismaClient, Prisma } from '../node_modules/.prisma/client-custom-v8';
import { softDeleteExtension } from './soft-delete';
import { syncStampExtension } from './sync/stamp';
import { connectionRetryExtension } from './db-retry';

/**
 * How many pooler slots one serverless instance is allowed to hold.
 *
 * The session-mode pooler this app uses is 15 clients wide for the whole
 * tenant, and every Vercel instance holds its share for as long as it stays
 * warm. Left unset, Prisma sizes the pool from the CPU count, which on Vercel
 * means three to five connections per instance - so four or five simultaneous
 * instances exhaust the tenant and the next request is refused outright. That
 * is the 2026-09-10 outage.
 *
 * Three is the smallest number that still lets the root layout's four parallel
 * queries overlap usefully, and it makes the ceiling arithmetic explicit:
 * 15 / 3 = five concurrent instances, rather than whatever the platform
 * happened to report. Raise the tenant's pool size before raising this.
 *
 * Only applied when nothing is set in the URL, so the environment can still
 * override it without a deploy.
 */
const SERVERLESS_CONNECTION_LIMIT = 3;

function connectionUrl(): string | undefined {
  const url = process.env.DATABASE_URL;

  // Not serverless, SQLite (the desktop build), or already deliberate: leave
  // the URL exactly as the environment set it.
  if (!process.env.VERCEL || !url || url.startsWith('file:')) return undefined;
  if (/[?&]connection_limit=/.test(url)) return undefined;

  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${SERVERLESS_CONNECTION_LIMIT}&pool_timeout=20`;
}

/**
 * A single PrismaClient for the whole process.
 *
 * This cache is not an optimisation, it is a correctness requirement in dev.
 * Next.js hot-reloads this module on every edit, and each `new PrismaClient()`
 * opens its own connection pool that the discarded instance never closes. After
 * enough reloads the Supabase pooler hits its limit and every query fails with:
 *
 *   Error in connector: FATAL: (EMAXCONN) max client connections reached, limit: 200
 *
 * Caching on globalThis survives hot reload, so an editing session uses one
 * pool instead of dozens. (It was previously disabled with the note "bypassing
 * global cache once to force refresh with new models" - if you ever need that
 * again to pick up a regenerated client, restart the dev server instead.)
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The connection pool is cached; the extension is not.
 *
 * $extends returns a new façade over the SAME pool, so re-applying it on every
 * module evaluation costs nothing, while the base client underneath stays the
 * single cached instance the note above is about.
 */
const budgetedUrl = connectionUrl();

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.PRISMA_LOG === '1'
      ? { log: [{ emit: 'stdout' as const, level: 'query' as const }] }
      : {}),
    ...(budgetedUrl ? { datasourceUrl: budgetedUrl } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = base;
}

/**
 * True when this build is talking to the desktop's local SQLite file rather
 * than Postgres. Same test the launcher and the migration runner use.
 *
 * Declared before the client because the sync extension needs it: the server
 * stamps syncedAt with its own clock, a device clears it to mean "not sent
 * yet", and which of those applies is decided here, once.
 */
export const IS_SQLITE = (process.env.DATABASE_URL ?? '').startsWith('file:');

/**
 * Reads never see tombstoned rows, and every write records where the row stands
 * with the server. See lib/soft-delete.ts and lib/sync/stamp.ts for why both are
 * central rather than per call site.
 *
 * Order matters: the stamp goes on first so the tombstone filter wraps it and
 * a soft-deleted row is still marked as needing to be sent - a deletion nobody
 * is told about is the failure the tombstones exist to prevent.
 *
 * The retry goes on LAST, which puts it OUTERMOST: a refused connection is
 * retried as the whole operation, stamping and filtering included, rather than
 * half of it. See lib/db-retry.ts.
 */
export const prisma = base
  .$extends(syncStampExtension(!IS_SQLITE))
  .$extends(softDeleteExtension())
  .$extends(connectionRetryExtension());

/**
 * A case-insensitive "contains" filter that behaves the same on both providers.
 *
 * `contains` alone is case-SENSITIVE on Postgres but case-INsensitive on
 * SQLite, so the same search returned different results on the web and on the
 * desktop app. Prisma's `mode: 'insensitive'` fixes Postgres but is rejected
 * outright by SQLite, hence the switch.
 *
 * SQLite's LIKE only folds case for ASCII, which is close enough here - it is
 * the same limitation the rest of the desktop build lives with.
 */
export function containsInsensitive(value: string) {
  return IS_SQLITE
    ? { contains: value }
    : { contains: value, mode: 'insensitive' as const };
}

/**
 * Every model in the schema, named the way you would reach it on the client
 * (`prisma.scheduleTemplate`), read off the client's own metadata.
 *
 * This module is the only place allowed to know where the generated client
 * lives - its path is relative to lib/, so importing it from anywhere else
 * silently resolves somewhere outside the repo. Callers that need to walk every
 * model (the tombstone purge) take the list from here instead.
 */
export const PRISMA_MODELS: string[] = Prisma.dmmf.datamodel.models.map(
  (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)
);
