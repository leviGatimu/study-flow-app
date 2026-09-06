-- Explicit rollback for 20260829000000_exam_assessment_fields_and_revision_link.
-- Prisma does not generate these. Dropping these columns loses every exam
-- score, weight and revision link recorded since Phase 5.
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_examId_fkey";
DROP INDEX IF EXISTS "Task_examId_idx";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "examId";

ALTER TABLE "ExamEvent" DROP CONSTRAINT IF EXISTS "ExamEvent_subjectId_fkey";
DROP INDEX IF EXISTS "ExamEvent_subjectId_idx";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "subjectId";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "endTime";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "room";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "kind";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "weight";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "score";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "maxScore";
ALTER TABLE "ExamEvent" DROP COLUMN IF EXISTS "notes";
