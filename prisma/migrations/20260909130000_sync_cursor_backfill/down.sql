-- Reverses 20260909130000_sync_cursor_backfill.
--
-- Clearing syncedAt on the server makes every row invisible to a pull again.
-- Only meaningful alongside reverting 20260909120000_sync_cursor.

UPDATE "User" SET "syncedAt" = NULL;
UPDATE "XpEvent" SET "syncedAt" = NULL;
UPDATE "ReportCard" SET "syncedAt" = NULL;
UPDATE "SubjectGrade" SET "syncedAt" = NULL;
UPDATE "Homework" SET "syncedAt" = NULL;
UPDATE "StudioNote" SET "syncedAt" = NULL;
UPDATE "ScheduleTemplate" SET "syncedAt" = NULL;
UPDATE "SchoolLesson" SET "syncedAt" = NULL;
UPDATE "Task" SET "syncedAt" = NULL;
UPDATE "MarkedDay" SET "syncedAt" = NULL;
UPDATE "UserProgress" SET "syncedAt" = NULL;
UPDATE "Resource" SET "syncedAt" = NULL;
UPDATE "ExamEvent" SET "syncedAt" = NULL;
UPDATE "MasteryItem" SET "syncedAt" = NULL;
UPDATE "SubjectGoal" SET "syncedAt" = NULL;
UPDATE "Subject" SET "syncedAt" = NULL;
UPDATE "Class" SET "syncedAt" = NULL;
UPDATE "Term" SET "syncedAt" = NULL;
