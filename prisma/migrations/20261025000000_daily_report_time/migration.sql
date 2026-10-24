-- New accounts report near the end of the day, in their configured timezone.
ALTER TABLE "UserProgress" ALTER COLUMN "dailySummaryTime" SET DEFAULT '23:58';

-- Move only the old 21:00 value; retain other custom times and tombstones.
-- Stamp the change so desktop clients receive it on their next successful sync.
-- This data backfill is intentionally one-way: a rollback cannot distinguish
-- an upgraded value from a user who deliberately selected 23:58.
UPDATE "UserProgress"
SET "dailySummaryTime" = '23:58',
    "updatedAt" = CURRENT_TIMESTAMP,
    "syncedAt" = CURRENT_TIMESTAMP
WHERE "dailySummaryTime" = '21:00' AND "deletedAt" IS NULL;
