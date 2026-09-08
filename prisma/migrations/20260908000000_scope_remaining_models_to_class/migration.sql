-- Scope the last four unscoped models to an academic year.
--
-- 17 models already carry classId or termId; these four carried nothing, so
-- there was no way to filter them by year at all. SubjectGrade and QuizAttempt
-- could in principle be reached through a parent (ReportCard -> Term, and
-- TutorModule), but every scoped read would then need a two- or three-table
-- join; the column is denormalised for the same reason Term.userId is.
--
-- ChatMessage deliberately gets NOTHING: it hangs off ChatSession and is
-- scoped through it.
--
-- The columns are NULLABLE so this can be applied to the populated production
-- tables before scripts/backfill-class-scope.mjs has run. Purely additive:
-- nothing is dropped, renamed or retyped, and every statement is guarded, so
-- it is safe to run twice.

ALTER TABLE "SubjectGrade" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "QuizAttempt"  ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "ChatSession"  ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "StickyNote"   ADD COLUMN IF NOT EXISTS "classId" TEXT;

CREATE INDEX IF NOT EXISTS "SubjectGrade_classId_idx" ON "SubjectGrade"("classId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_classId_idx"  ON "QuizAttempt"("classId");
CREATE INDEX IF NOT EXISTS "ChatSession_classId_idx"  ON "ChatSession"("classId");
CREATE INDEX IF NOT EXISTS "StickyNote_classId_idx"   ON "StickyNote"("classId");

-- ON DELETE CASCADE, matching every other classId FK in the schema: deleting an
-- academic year removes the work that belonged to it.
DO $$
BEGIN
    ALTER TABLE "SubjectGrade" ADD CONSTRAINT "SubjectGrade_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
