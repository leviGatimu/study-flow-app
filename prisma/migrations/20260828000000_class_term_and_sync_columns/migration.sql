-- Phase 2: academic structure (Class + Term) and sync-readiness columns.
--
-- Purely ADDITIVE. No column is dropped, renamed or retyped, and no row is
-- moved or edited. Every new column is nullable or carries a default, so it
-- applies cleanly to the populated production tables (4 users, 357 tasks).
-- Safe to run more than once: every statement is IF NOT EXISTS guarded.
--
-- Rollback: see down.sql alongside this file.

-- 1. The two container tables -------------------------------------------

CREATE TABLE IF NOT EXISTS "Class" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Term" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Class_userId_status_idx" ON "Class"("userId", "status");
CREATE INDEX IF NOT EXISTS "Term_userId_status_idx" ON "Term"("userId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Term_classId_index_key" ON "Term"("classId", "index");

-- Match the RLS posture of every existing table in this database.
ALTER TABLE "Class" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Term"  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    ALTER TABLE "Class" ADD CONSTRAINT "Class_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Term" ADD CONSTRAINT "Term_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sync-readiness columns on every table -------------------------------
--
-- updatedAt is what last-writer-wins resolution compares; deletedAt is the
-- tombstone that lets a delete propagate instead of being resurrected by
-- the next device to sync. 15 tables had neither, including Task and
-- ScheduleTemplate, the two most-edited tables in the app.
--
-- Note: Task.isDeleted is NOT the same thing and is left untouched. It means
-- "the user removed this generated task, do not regenerate it". deletedAt
-- means "this row no longer exists".

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Song"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Playlist"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ReportCard"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "SubjectGrade"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Homework"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "StudioNote"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "TutorModule"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "QuizAttempt"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Project"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "ProjectDoc"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ChatSession"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ScheduleTemplate"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "MarkedDay"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "UserProgress"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Resource"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "ExamEvent"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "WeeklySummary"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "DailySummary"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "termId" TEXT;
ALTER TABLE "MasteryItem"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "StickyNote"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "AiNote"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "SubjectGoal"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Subject"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- 3. Scope foreign keys and their indexes --------------------------------
--
-- Nullable on purpose: existing rows are linked by the backfill script, not
-- by this migration, so the schema change and the data change stay separable
-- and independently reversible.

CREATE INDEX IF NOT EXISTS "ScheduleTemplate_classId_idx" ON "ScheduleTemplate"("classId");
DO $$ BEGIN
    ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Subject_classId_idx" ON "Subject"("classId");
DO $$ BEGIN
    ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "SubjectGoal_classId_idx" ON "SubjectGoal"("classId");
DO $$ BEGIN
    ALTER TABLE "SubjectGoal" ADD CONSTRAINT "SubjectGoal_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Resource_classId_idx" ON "Resource"("classId");
DO $$ BEGIN
    ALTER TABLE "Resource" ADD CONSTRAINT "Resource_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "MasteryItem_classId_idx" ON "MasteryItem"("classId");
DO $$ BEGIN
    ALTER TABLE "MasteryItem" ADD CONSTRAINT "MasteryItem_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "TutorModule_classId_idx" ON "TutorModule"("classId");
DO $$ BEGIN
    ALTER TABLE "TutorModule" ADD CONSTRAINT "TutorModule_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "StudioNote_classId_idx" ON "StudioNote"("classId");
DO $$ BEGIN
    ALTER TABLE "StudioNote" ADD CONSTRAINT "StudioNote_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AiNote_classId_idx" ON "AiNote"("classId");
DO $$ BEGIN
    ALTER TABLE "AiNote" ADD CONSTRAINT "AiNote_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Project_classId_idx" ON "Project"("classId");
DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Task_termId_idx" ON "Task"("termId");
DO $$ BEGIN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ExamEvent_termId_idx" ON "ExamEvent"("termId");
DO $$ BEGIN
    ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Homework_termId_idx" ON "Homework"("termId");
DO $$ BEGIN
    ALTER TABLE "Homework" ADD CONSTRAINT "Homework_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "DailySummary_termId_idx" ON "DailySummary"("termId");
DO $$ BEGIN
    ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "WeeklySummary_termId_idx" ON "WeeklySummary"("termId");
DO $$ BEGIN
    ALTER TABLE "WeeklySummary" ADD CONSTRAINT "WeeklySummary_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "MarkedDay_termId_idx" ON "MarkedDay"("termId");
DO $$ BEGIN
    ALTER TABLE "MarkedDay" ADD CONSTRAINT "MarkedDay_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ReportCard_termId_idx" ON "ReportCard"("termId");
DO $$ BEGIN
    ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

