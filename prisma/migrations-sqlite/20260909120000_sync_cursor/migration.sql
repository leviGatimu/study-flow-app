-- What the sync engine orders the world by. See the Postgres migration of the
-- same name for what syncedAt means on each side.
--
-- Additive statements only, no RedefineTables - the rule this SQLite history
-- keeps, because lib/sqlite-migrate.ts runs statements one at a time with no
-- transaction and its reconcileColumns() repair pass understands only
-- CREATE TABLE and ALTER TABLE ADD COLUMN.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "XpEvent" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "SubjectGrade" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Homework" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "StudioNote" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "ScheduleTemplate" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "SchoolLesson" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "MarkedDay" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "ExamEvent" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "MasteryItem" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "SubjectGoal" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Term" ADD COLUMN "syncedAt" DATETIME;

-- CreateIndex
CREATE INDEX "User_syncedAt_idx" ON "User"("syncedAt");

-- CreateIndex
CREATE INDEX "XpEvent_syncedAt_idx" ON "XpEvent"("syncedAt");

-- CreateIndex
CREATE INDEX "ReportCard_syncedAt_idx" ON "ReportCard"("syncedAt");

-- CreateIndex
CREATE INDEX "SubjectGrade_syncedAt_idx" ON "SubjectGrade"("syncedAt");

-- CreateIndex
CREATE INDEX "Homework_syncedAt_idx" ON "Homework"("syncedAt");

-- CreateIndex
CREATE INDEX "StudioNote_syncedAt_idx" ON "StudioNote"("syncedAt");

-- CreateIndex
CREATE INDEX "ScheduleTemplate_syncedAt_idx" ON "ScheduleTemplate"("syncedAt");

-- CreateIndex
CREATE INDEX "SchoolLesson_syncedAt_idx" ON "SchoolLesson"("syncedAt");

-- CreateIndex
CREATE INDEX "Task_syncedAt_idx" ON "Task"("syncedAt");

-- CreateIndex
CREATE INDEX "MarkedDay_syncedAt_idx" ON "MarkedDay"("syncedAt");

-- CreateIndex
CREATE INDEX "UserProgress_syncedAt_idx" ON "UserProgress"("syncedAt");

-- CreateIndex
CREATE INDEX "Resource_syncedAt_idx" ON "Resource"("syncedAt");

-- CreateIndex
CREATE INDEX "ExamEvent_syncedAt_idx" ON "ExamEvent"("syncedAt");

-- CreateIndex
CREATE INDEX "MasteryItem_syncedAt_idx" ON "MasteryItem"("syncedAt");

-- CreateIndex
CREATE INDEX "SubjectGoal_syncedAt_idx" ON "SubjectGoal"("syncedAt");

-- CreateIndex
CREATE INDEX "Subject_syncedAt_idx" ON "Subject"("syncedAt");

-- CreateIndex
CREATE INDEX "Class_syncedAt_idx" ON "Class"("syncedAt");

-- CreateIndex
CREATE INDEX "Term_syncedAt_idx" ON "Term"("syncedAt");

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "cursor" DATETIME,
    "cursorId" TEXT,
    "serverUrl" TEXT,
    "token" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "lastPushed" INTEGER NOT NULL DEFAULT 0,
    "lastPulled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_userId_deviceId_key" ON "SyncState"("userId", "deviceId");
