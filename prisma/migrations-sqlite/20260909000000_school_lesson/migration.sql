-- The school day, per user. See the Postgres migration of the same name for why
-- this exists.
--
-- Hand-written rather than `prisma migrate diff` output, following the rule
-- this project's SQLite history keeps: additive statements only, no
-- RedefineTables. lib/sqlite-migrate.ts runs statements one at a time with no
-- surrounding transaction, and its reconcileColumns() repair pass understands
-- only CREATE TABLE and ALTER TABLE ADD COLUMN. A plain CREATE TABLE is both.

-- CreateTable
CREATE TABLE "SchoolLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "classId" TEXT,
    CONSTRAINT "SchoolLesson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolLesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchoolLesson_userId_dayOfWeek_idx" ON "SchoolLesson"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "SchoolLesson_classId_idx" ON "SchoolLesson"("classId");
