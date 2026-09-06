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
