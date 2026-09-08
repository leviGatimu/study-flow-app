-- Scope the last four unscoped models to an academic year. See the Postgres
-- migration of the same name for why these columns exist.
--
-- WRITTEN BY HAND, NOT BY `prisma migrate diff`. The generated SQLite diff for
-- an added foreign-key column is a RedefineTables block: CREATE new_X, INSERT
-- SELECT, DROP X, RENAME. That is wrong for this project twice over -
-- lib/sqlite-migrate.ts executes statements one at a time with no surrounding
-- transaction, so a failure halfway through the dance destroys the table it was
-- copying; and its reconcileColumns() repair pass only understands CREATE TABLE
-- and ALTER TABLE ADD COLUMN, so a redefine leaves a database that skipped the
-- migration with no way to heal itself.
--
-- SQLite accepts a REFERENCES clause in ADD COLUMN as long as the column
-- defaults to NULL, which is exactly the shape here, so nothing is lost by
-- doing it additively.

-- AlterTable
ALTER TABLE "SubjectGrade" ADD COLUMN "classId" TEXT REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN "classId" TEXT REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "classId" TEXT REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "StickyNote" ADD COLUMN "classId" TEXT REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SubjectGrade_classId_idx" ON "SubjectGrade"("classId");

-- CreateIndex
CREATE INDEX "QuizAttempt_classId_idx" ON "QuizAttempt"("classId");

-- CreateIndex
CREATE INDEX "ChatSession_classId_idx" ON "ChatSession"("classId");

-- CreateIndex
CREATE INDEX "StickyNote_classId_idx" ON "StickyNote"("classId");
