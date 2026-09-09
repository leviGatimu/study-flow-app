-- Give the rows that already exist a place in the sync order.
--
-- 20260909120000_sync_cursor added syncedAt as NULL everywhere, on the reasoning
-- that "never synced" was a fine starting state. It is not. The pull cursor
-- selects `syncedAt > <cursor>` and, with no cursor, `syncedAt IS NOT NULL` -
-- so a NULL row has no position in the order and is never sent. A device
-- pairing with a server holding three years of work would have pulled exactly
-- nothing, and the endpoint would have looked like it was working.
--
-- THIS MIGRATION IS FOR THE SERVER ONLY, and there is deliberately no SQLite
-- twin. On a device NULL does not mean "no position", it means "this row has
-- local changes the server has not seen" - so running this against a desktop
-- database would mark every local row as already sent and it would never push
-- anything again. The two sides read the same column differently on purpose;
-- this is the one place that difference has teeth.
--
-- updatedAt rather than now(): it keeps the historical order, so a device
-- paging through a large account receives it roughly oldest-first, and it makes
-- the statement idempotent in value as well as in effect.

UPDATE "User" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "XpEvent" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "ReportCard" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "SubjectGrade" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Homework" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "StudioNote" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "ScheduleTemplate" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "SchoolLesson" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Task" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "MarkedDay" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "UserProgress" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Resource" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "ExamEvent" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "MasteryItem" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "SubjectGoal" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Subject" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Class" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
UPDATE "Term" SET "syncedAt" = "updatedAt" WHERE "syncedAt" IS NULL;
