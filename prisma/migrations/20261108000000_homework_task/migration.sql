-- Additive: which schedule block a homework is planned into. Existing homework
-- keeps everything it had, with no block. Forward-only: old app code ignores it.
ALTER TABLE "Homework" ADD COLUMN "taskId" TEXT;
CREATE INDEX "Homework_taskId_idx" ON "Homework"("taskId");
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
