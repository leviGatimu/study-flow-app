-- Additive: existing grants remain unmeasured. No historical durations are guessed.
-- Forward-only: roll back app code while retaining these nullable columns and measurements.
ALTER TABLE "XpEvent" ADD COLUMN "focusSeconds" INTEGER CHECK ("focusSeconds" >= 0);
ALTER TABLE "XpEvent" ADD COLUMN "taskId" TEXT;
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "XpEvent_userId_taskId_createdAt_idx" ON "XpEvent"("userId", "taskId", "createdAt");
