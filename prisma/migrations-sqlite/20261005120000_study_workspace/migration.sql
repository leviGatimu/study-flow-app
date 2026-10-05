-- Study workspace: SQLite twin of prisma/migrations/20261005120000_study_workspace.

-- AlterTable
ALTER TABLE "TutorModule" ADD COLUMN "coverage" TEXT;
ALTER TABLE "TutorModule" ADD COLUMN "sourceResourceId" TEXT;
ALTER TABLE "TutorModule" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "artifactId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "branchKind" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "parentMessageId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "parentSessionId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "resultSummary" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "syncedAt" DATETIME;

-- CreateTable
CREATE TABLE "AttemptDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "answers" TEXT NOT NULL DEFAULT '{}',
    "flags" TEXT NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "deadlineAt" DATETIME,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "syncedAt" DATETIME,
    "classId" TEXT,
    CONSTRAINT "AttemptDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptDraft_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TutorModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptDraft_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "tool" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "result" TEXT,
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "syncedAt" DATETIME,
    "classId" TEXT,
    CONSTRAINT "AiAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiAction_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (ADD COLUMN, not a table rebuild: SQLite accepts NOT NULL with
-- a constant default, and existing desktop rows are never copied or dropped)
ALTER TABLE "QuizAttempt" ADD COLUMN "markingStatus" TEXT NOT NULL DEFAULT 'FINAL';
ALTER TABLE "QuizAttempt" ADD COLUMN "syncedAt" DATETIME;
ALTER TABLE "ChatMessage" ADD COLUMN "requestId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE';
ALTER TABLE "ChatMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "ChatMessage" ADD COLUMN "sources" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "syncedAt" DATETIME;

-- CreateIndex
CREATE INDEX "QuizAttempt_syncedAt_idx" ON "QuizAttempt"("syncedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_syncedAt_idx" ON "ChatMessage"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_sessionId_requestId_key" ON "ChatMessage"("sessionId", "requestId");

-- CreateIndex
CREATE INDEX "AttemptDraft_classId_idx" ON "AttemptDraft"("classId");

-- CreateIndex
CREATE INDEX "AttemptDraft_syncedAt_idx" ON "AttemptDraft"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptDraft_userId_moduleId_mode_key" ON "AttemptDraft"("userId", "moduleId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "AiAction_idempotencyKey_key" ON "AiAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiAction_userId_status_idx" ON "AiAction"("userId", "status");

-- CreateIndex
CREATE INDEX "AiAction_sessionId_idx" ON "AiAction"("sessionId");

-- CreateIndex
CREATE INDEX "AiAction_classId_idx" ON "AiAction"("classId");

-- CreateIndex
CREATE INDEX "AiAction_syncedAt_idx" ON "AiAction"("syncedAt");

-- CreateIndex
CREATE INDEX "TutorModule_syncedAt_idx" ON "TutorModule"("syncedAt");

-- CreateIndex
CREATE INDEX "ChatSession_parentSessionId_idx" ON "ChatSession"("parentSessionId");

-- CreateIndex
CREATE INDEX "ChatSession_syncedAt_idx" ON "ChatSession"("syncedAt");

