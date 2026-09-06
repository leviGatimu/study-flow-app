-- Phase 5: turn ExamEvent into a real assessment record and let a Task point
-- back at the exam its revision was planned for.
--
-- This migration reconstructs, as a file, a change that was applied directly to
-- the database during Phase 5 and never written down. It is additive and every
-- statement is guarded, so it is safe to run against a database that already
-- has these columns (production) and against one that does not (a fresh
-- install, or the shadow database).

-- ExamEvent: link to the subject being assessed.
-- Before this column existed the exam TITLE was used as the subject key, so an
-- exam called "Physics Paper 1" silently returned zero preparation stats.
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

-- ExamEvent: when and where.
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "endTime" TEXT;
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "room" TEXT;

-- ExamEvent: what kind of assessment, and how much it counts for.
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'EXAM';
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;

-- ExamEvent: the result, filled in after the exam is sat. Feeds Marks/Insights.
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "score" DOUBLE PRECISION;
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "maxScore" DOUBLE PRECISION;
ALTER TABLE "ExamEvent" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Task: the exam this revision block was planned for.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "examId" TEXT;

CREATE INDEX IF NOT EXISTS "ExamEvent_subjectId_idx" ON "ExamEvent"("subjectId");
CREATE INDEX IF NOT EXISTS "Task_examId_idx" ON "Task"("examId");

-- Both foreign keys are ON DELETE SET NULL, deliberately, not Cascade:
-- deleting an exam must not delete the revision you already did for it, and
-- deleting a subject must not delete its exam history.
DO $$
BEGIN
    ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_examId_fkey"
        FOREIGN KEY ("examId") REFERENCES "ExamEvent"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
