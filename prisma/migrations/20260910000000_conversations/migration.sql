-- People, talking to each other, inside the app.
--
-- Server-only by design: these tables are absent from the sync engine's model
-- registry, so nothing about them ever travels to a desktop SQLite file. That
-- engine resolves conflicts by last-writer-wins with per-field rules, which is
-- correct for a study timetable and wrong for a conversation - a merge that
-- "won" would rewrite what somebody said.
--
-- pairKey is what stops two people who open a chat with each other at the same
-- moment from ending up with two threads and half a conversation each.

CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DIRECT',
    "title" TEXT,
    "createdById" TEXT NOT NULL,
    "pairKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shareKind" TEXT,
    "shareTitle" TEXT,
    "sharePayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_pairKey_key" ON "Conversation"("pairKey");
CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "ConversationMember_userId_idx" ON "ConversationMember"("userId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
