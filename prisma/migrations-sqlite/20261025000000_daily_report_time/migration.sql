-- New app-created profiles get 23:58 from the generated Prisma client.
-- Keep the existing SQLite table intact: changing its physical DEFAULT would
-- require rebuilding a table that also holds credentials and progress.
-- Only migrate the old 21:00 value; other custom times and tombstones stay put.
-- This backfill is one-way because explicit 23:58 selections are indistinguishable
-- from upgraded values. syncedAt=NULL makes the preference a pending local edit.
UPDATE "UserProgress"
SET "dailySummaryTime" = '23:58',
    "updatedAt" = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    "syncedAt" = NULL
WHERE "dailySummaryTime" = '21:00' AND "deletedAt" IS NULL;
