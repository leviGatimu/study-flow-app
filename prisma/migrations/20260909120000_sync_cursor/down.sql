-- Reverses 20260909120000_sync_cursor.
--
-- Dropping syncedAt makes every device forget what the server has seen, so the
-- next sync after re-applying re-pushes everything. That is noisy but not
-- lossy: the merge is idempotent.

DROP TABLE IF EXISTS "SyncState";

ALTER TABLE "User" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "XpEvent" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "ReportCard" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "SubjectGrade" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Homework" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "StudioNote" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "ScheduleTemplate" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "SchoolLesson" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "MarkedDay" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "UserProgress" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Resource" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "MasteryItem" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "SubjectGoal" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Class" DROP COLUMN IF EXISTS "syncedAt";
ALTER TABLE "Term" DROP COLUMN IF EXISTS "syncedAt";
