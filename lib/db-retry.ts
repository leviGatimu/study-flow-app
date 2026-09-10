/**
 * One refused connection should not be a broken app.
 *
 * The Supabase pooler is used in SESSION mode (port 5432) because transaction
 * mode measured 790ms per query against 180ms here - see the pooler note in
 * HANDOFF.md. The price of that choice is a hard ceiling: session mode pins one
 * server connection per client, and the tenant's pool is 15 wide. Go past it
 * and Supavisor does not queue, it refuses:
 *
 *   FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *
 * On 2026-09-10 at 06:25 that happened 65 times in five minutes. Every one of
 * them landed in the ROOT LAYOUT, which opens with four parallel queries, so a
 * refusal did not degrade a panel - it took out the entire document and showed
 * "Study Flow couldn't start". The pool was healthy again within seconds.
 *
 * A blip that short is worth waiting out rather than showing to a student mid
 * revision, which is all this does: two extra attempts, jittered, then the
 * original error.
 *
 * WHAT IS AND IS NOT RETRIED. Only failures that happen *before* the statement
 * reaches Postgres, so a retry cannot apply a write twice:
 *
 *   - the connection was refused or unreachable (P1001, and the connector's
 *     FATAL text, which is what pool exhaustion looks like from here)
 *   - Prisma's own pool timed out handing us a connection (P2024) - the query
 *     was still queued client-side
 *   - the server closed the connection (P1017), READS ONLY, because that one
 *     can also fire after a statement has been sent
 *
 * Anything else - a constraint violation, bad input, a timeout inside Postgres
 * - is a real answer and is passed straight through.
 *
 * Not covered, both deliberately:
 *
 *   - an operation inside an interactive $transaction. Its connection is
 *     already checked out by the time the callback runs, so these errors do
 *     not arise there; retrying one statement of an open transaction would be
 *     wrong.
 *   - $queryRaw / $executeRaw, which are client-level rather than model-level
 *     operations. The only raw query in the app reads Prisma's own migration
 *     table for the admin console, which nobody's page load depends on.
 */

/** Operations that cannot change data, and so are safe to send twice. */
const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Substrings that identify a connection that was never established. */
const NEVER_REACHED_THE_DATABASE = [
  'max clients reached',
  'max client connections reached',
  'Error in connector: FATAL',
  "Can't reach database server",
  'Timed out fetching a new connection from the connection pool',
];

const RETRYABLE_CODES = new Set(['P1001', 'P2024']);

/** P1017 only counts for reads - see the note at the top of the file. */
const READ_ONLY_RETRYABLE_CODES = new Set(['P1017']);

function isTransient(error: unknown, operation: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? '';
  const isRead = READ_OPERATIONS.has(operation);

  if (code && RETRYABLE_CODES.has(code)) return true;
  if (code && isRead && READ_ONLY_RETRYABLE_CODES.has(code)) return true;

  return NEVER_REACHED_THE_DATABASE.some((fragment) => message.includes(fragment));
}

/** Roughly 150ms then 400ms, jittered so a burst does not retry in lockstep. */
function backoffMs(attempt: number): number {
  return (attempt === 1 ? 150 : 400) + Math.floor(Math.random() * 120);
}

const MAX_ATTEMPTS = 3;

export function connectionRetryExtension() {
  return {
    name: 'connectionRetry',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          for (let attempt = 1; ; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (attempt >= MAX_ATTEMPTS || !isTransient(error, operation)) throw error;

              const wait = backoffMs(attempt);
              // Logged every time: a silent retry hides the fact that the
              // pool is at its limit, which is the thing worth knowing.
              console.warn(
                `[db] ${model ?? 'raw'}.${operation} failed to get a connection ` +
                  `(attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${wait}ms:`,
                (error as { message?: string }).message?.split('\n')[0]
              );
              await new Promise((resolve) => setTimeout(resolve, wait));
            }
          }
        },
      },
    },
  };
}
