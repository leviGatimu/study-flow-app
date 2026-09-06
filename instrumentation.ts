/**
 * Next.js startup hook, run once per server process before it serves traffic.
 *
 * Used by the desktop build to bring the user's local SQLite database up to
 * date after an app update. On the web build (Postgres) this does nothing -
 * that database is migrated deliberately, never on boot.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL?.startsWith('file:')) return;

  const { runSqliteMigrations } = await import('@/lib/sqlite-migrate');
  await runSqliteMigrations();
}
