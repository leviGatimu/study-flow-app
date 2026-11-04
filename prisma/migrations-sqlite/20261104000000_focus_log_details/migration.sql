-- SQLite supports an optional reference through ADD COLUMN; no table rebuild needed.
-- Forward-only: roll back app code while retaining these nullable columns and measurements.
ALTER TABLE "XpEvent" ADD COLUMN "focusSeconds" INTEGER CHECK ("focusSeconds" >= 0);
ALTER TABLE "XpEvent" ADD COLUMN "taskId" TEXT REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "XpEvent_userId_taskId_createdAt_idx" ON "XpEvent"("userId", "taskId", "createdAt");
