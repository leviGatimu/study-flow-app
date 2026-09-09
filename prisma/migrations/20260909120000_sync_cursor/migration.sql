-- What the sync engine orders the world by.
--
-- `syncedAt` is written by the SERVER and only by the server. On the server it
-- is the moment that row last changed there, so a device can ask "everything
-- since X" and get a stable, gap-free answer no matter how wrong its own clock
-- is. On a device the column holds the server's stamp for the version it last
-- exchanged, and NULL means "this row has local edits the server has not seen"
-- - a dirty bit that needs no clock comparison at all.
--
-- Nullable on purpose: every existing row starts NULL, which on the server is
-- read as "never synced" and simply means the first pull from any device
-- carries it. No backfill is needed or wanted.
--
-- SyncState is per device and never syncs. On the server it stays empty - the
-- server has no cursor, being the thing everyone else is catching up to.
--
-- Purely additive and guarded, so it is safe to run twice.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "XpEvent" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "ReportCard" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "SubjectGrade" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "StudioNote" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "ScheduleTemplate" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "SchoolLesson" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "MarkedDay" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "MasteryItem" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "SubjectGoal" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_syncedAt_idx" ON "User"("syncedAt");
CREATE INDEX IF NOT EXISTS "XpEvent_syncedAt_idx" ON "XpEvent"("syncedAt");
CREATE INDEX IF NOT EXISTS "ReportCard_syncedAt_idx" ON "ReportCard"("syncedAt");
CREATE INDEX IF NOT EXISTS "SubjectGrade_syncedAt_idx" ON "SubjectGrade"("syncedAt");
CREATE INDEX IF NOT EXISTS "Homework_syncedAt_idx" ON "Homework"("syncedAt");
CREATE INDEX IF NOT EXISTS "StudioNote_syncedAt_idx" ON "StudioNote"("syncedAt");
CREATE INDEX IF NOT EXISTS "ScheduleTemplate_syncedAt_idx" ON "ScheduleTemplate"("syncedAt");
CREATE INDEX IF NOT EXISTS "SchoolLesson_syncedAt_idx" ON "SchoolLesson"("syncedAt");
CREATE INDEX IF NOT EXISTS "Task_syncedAt_idx" ON "Task"("syncedAt");
CREATE INDEX IF NOT EXISTS "MarkedDay_syncedAt_idx" ON "MarkedDay"("syncedAt");
CREATE INDEX IF NOT EXISTS "UserProgress_syncedAt_idx" ON "UserProgress"("syncedAt");
CREATE INDEX IF NOT EXISTS "Resource_syncedAt_idx" ON "Resource"("syncedAt");
CREATE INDEX IF NOT EXISTS "ExamEvent_syncedAt_idx" ON "ExamEvent"("syncedAt");
CREATE INDEX IF NOT EXISTS "MasteryItem_syncedAt_idx" ON "MasteryItem"("syncedAt");
CREATE INDEX IF NOT EXISTS "SubjectGoal_syncedAt_idx" ON "SubjectGoal"("syncedAt");
CREATE INDEX IF NOT EXISTS "Subject_syncedAt_idx" ON "Subject"("syncedAt");
CREATE INDEX IF NOT EXISTS "Class_syncedAt_idx" ON "Class"("syncedAt");
CREATE INDEX IF NOT EXISTS "Term_syncedAt_idx" ON "Term"("syncedAt");

CREATE TABLE IF NOT EXISTS "SyncState" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "deviceId"   TEXT NOT NULL,
    "cursor"     TIMESTAMP(3),
    "cursorId"   TEXT,
    "serverUrl"  TEXT,
    "token"      TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError"  TEXT,
    "lastPushed" INTEGER NOT NULL DEFAULT 0,
    "lastPulled" INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyncState_userId_deviceId_key"
    ON "SyncState"("userId", "deviceId");
