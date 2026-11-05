-- Additive: optional fields for what was set and the student's answers.
-- Existing homework keeps everything it had. Forward-only: old app code ignores them.
ALTER TABLE "Homework" ADD COLUMN "briefFileUrl" TEXT;
ALTER TABLE "Homework" ADD COLUMN "answer" TEXT;
ALTER TABLE "Homework" ADD COLUMN "answerFileUrl" TEXT;
