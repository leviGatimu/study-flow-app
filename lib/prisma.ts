import { PrismaClient } from '../node_modules/.prisma/client-custom-v8';

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.PRISMA_LOG === '1'
      ? { log: [{ emit: 'stdout', level: 'query' }] }
      : undefined
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * True when this build is talking to the desktop's local SQLite file rather
 * than Postgres. Same test the launcher and the migration runner use.
 */
export const IS_SQLITE = (process.env.DATABASE_URL ?? '').startsWith('file:');

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
