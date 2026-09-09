-- Rollback for 20260908000000_scope_remaining_models_to_class.
-- Dropping these columns loses the backfilled year assignment for grades, quiz
-- attempts, chat sessions and sticky notes. Nothing else is affected: the rows
-- themselves, and every parent link they already had, survive untouched, and
-- scripts/backfill-class-scope.mjs can rederive the values.
ALTER TABLE "SubjectGrade" DROP CONSTRAINT IF EXISTS "SubjectGrade_classId_fkey";
ALTER TABLE "QuizAttempt"  DROP CONSTRAINT IF EXISTS "QuizAttempt_classId_fkey";
ALTER TABLE "ChatSession"  DROP CONSTRAINT IF EXISTS "ChatSession_classId_fkey";
ALTER TABLE "StickyNote"   DROP CONSTRAINT IF EXISTS "StickyNote_classId_fkey";

DROP INDEX IF EXISTS "SubjectGrade_classId_idx";
DROP INDEX IF EXISTS "QuizAttempt_classId_idx";
DROP INDEX IF EXISTS "ChatSession_classId_idx";
DROP INDEX IF EXISTS "StickyNote_classId_idx";

ALTER TABLE "SubjectGrade" DROP COLUMN IF EXISTS "classId";
ALTER TABLE "QuizAttempt"  DROP COLUMN IF EXISTS "classId";
ALTER TABLE "ChatSession"  DROP COLUMN IF EXISTS "classId";
ALTER TABLE "StickyNote"   DROP COLUMN IF EXISTS "classId";
