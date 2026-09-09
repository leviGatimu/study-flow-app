-- AI Study becomes a generator. See the Postgres migration of the same name.
--
-- SQLite cannot ALTER a column's default, so the four legacy columns keep their
-- NOT NULL shape here and the application supplies '' / '[]' on insert. That is
-- the same value the Postgres default writes, so both databases end up
-- identical - only the place the value comes from differs.

-- AlterTable
ALTER TABLE "TutorModule" ADD COLUMN "sourceText" TEXT;
ALTER TABLE "TutorModule" ADD COLUMN "config" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'PRACTICE';
