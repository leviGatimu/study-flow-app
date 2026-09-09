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

  // Tombstones are only useful until every device has heard about the deletion.
  // Launch is the natural moment to sweep the expired ones: the database is
  // already open, nothing is reading it yet, and a desktop app starts often
  // enough that the table never gets far ahead of the broom.
  //
  // Deliberately desktop-only. On Vercel this hook runs per serverless
  // instance, which would mean sweeping the shared database from many places at
  // once for no benefit; the web side purges from scripts/purge-tombstones.mjs.
  try {
    const [{ prisma, PRISMA_MODELS }, { purgeTombstones }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/soft-delete'),
    ]);
    const removed = await purgeTombstones(prisma, PRISMA_MODELS);
    const total = Object.values(removed).reduce((a, b) => a + b, 0);
    if (total > 0) console.log(`[purge] removed ${total} expired tombstones`);
  } catch (error) {
    // A failed sweep is not a reason to refuse to start the app.
    console.error('[purge] skipped:', error);
  }

  // Keep this install in step with the website by itself: once shortly after
  // launch, again after any local edit settles, and on a timer as the safety
  // net. Desktop only, like everything above - on the web this process IS the
  // thing devices sync to.
  try {
    const { startSyncScheduler } = await import('@/lib/sync/scheduler');
    startSyncScheduler();
  } catch (error) {
    // A device that cannot schedule syncs still works; it just falls back to
    // the button in Settings. Never a reason to refuse to start.
    console.error('[sync] scheduler did not start:', error);
  }
}
