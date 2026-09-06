-- An append-only ledger of every XP grant.
--
-- Purely additive: nothing is dropped, renamed or retyped, and UserProgress
-- keeps its xp/level columns, which become a cache recomputed from this table.
-- Guarded throughout so it is safe to run twice.

CREATE TABLE IF NOT EXISTS "XpEvent" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "source"    TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- The idempotency key. This is the constraint that makes a grant happen at
-- most once per user, no matter how often the code path runs or how many
-- devices replay the same row.
CREATE UNIQUE INDEX IF NOT EXISTS "XpEvent_userId_sourceKey_key"
    ON "XpEvent"("userId", "sourceKey");

CREATE INDEX IF NOT EXISTS "XpEvent_userId_createdAt_idx"
    ON "XpEvent"("userId", "createdAt");

DO $$
BEGIN
    ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
