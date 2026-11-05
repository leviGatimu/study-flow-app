-- Additive: a nullable label grouping exams across subjects ("Midterm 1").
-- Existing exams start uncategorised. Forward-only: old app code ignores the column.
ALTER TABLE "ExamEvent" ADD COLUMN "category" TEXT;
