-- Revert the default only. Keep saved preferences: the one-way data backfill
-- cannot be reversed without also overwriting explicit user selections.
ALTER TABLE "UserProgress" ALTER COLUMN "dailySummaryTime" SET DEFAULT '21:00';
