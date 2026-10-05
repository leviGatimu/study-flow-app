-- Study workspace (docs/STUDY_WORKSPACE_PLAN.md): chat branches, idempotent
-- turns, attempt drafts, AI action receipts, marking status, and syncedAt
-- columns so chats and practice sync between desktop and web. Additive only.

-- AlterTable
ALTER TABLE "TutorModule" ADD COLUMN     "coverage" TEXT,
ADD COLUMN     "sourceResourceId" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "markingStatus" TEXT NOT NULL DEFAULT 'FINAL',
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "artifactId" TEXT,
ADD COLUMN     "branchKind" TEXT,
ADD COLUMN     "parentMessageId" TEXT,
ADD COLUMN     "parentSessionId" TEXT,
ADD COLUMN     "resultSummary" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "sources" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DONE',
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AttemptDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "answers" TEXT NOT NULL DEFAULT '{}',
    "flags" TEXT NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "deadlineAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "classId" TEXT,

    CONSTRAINT "AttemptDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "tool" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "result" TEXT,
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "classId" TEXT,

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "QuizAttempt_syncedAt_idx" ON "QuizAttempt"("syncedAt");

-- CreateIndex
CREATE INDEX "ChatSession_parentSessionId_idx" ON "ChatSession"("parentSessionId");

-- CreateIndex
CREATE INDEX "ChatSession_syncedAt_idx" ON "ChatSession"("syncedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_syncedAt_idx" ON "ChatMessage"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_sessionId_requestId_key" ON "ChatMessage"("sessionId", "requestId");

-- AddForeignKey
ALTER TABLE "AttemptDraft" ADD CONSTRAINT "AttemptDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptDraft" ADD CONSTRAINT "AttemptDraft_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TutorModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptDraft" ADD CONSTRAINT "AttemptDraft_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

