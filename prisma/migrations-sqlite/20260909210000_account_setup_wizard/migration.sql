-- Record that an account has been through (or dismissed) the setup wizard. See
-- the Postgres migration of the same name for why only this one flag is stored
-- and everything else is derived.

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN "setupCompletedAt" DATETIME;

UPDATE "UserProgress" SET "setupCompletedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "setupCompletedAt" IS NULL;
