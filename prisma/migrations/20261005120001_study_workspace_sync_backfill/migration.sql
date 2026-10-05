-- POSTGRES ONLY - deliberately no SQLite twin (same rule as
-- 20260909130000_sync_cursor_backfill). On the SERVER, syncedAt is the write
-- time the pull cursor orders by; rows that existed before these tables
-- synced need one, or no device would ever pull them. On a DEVICE the same
-- statement would mean "already sent" and those rows would never push.
UPDATE "ChatSession" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "ChatMessage" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "TutorModule" SET "syncedAt" = COALESCE("updatedAt", "createdAt") WHERE "syncedAt" IS NULL;
UPDATE "QuizAttempt" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
