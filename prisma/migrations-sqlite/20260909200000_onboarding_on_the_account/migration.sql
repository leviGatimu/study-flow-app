-- Remember the welcome tour on the account. See the Postgres migration of the
-- same name for why the browser was the wrong place for it.
--
-- The backfill matters MORE here than on the server: the desktop is where the
-- shifting port made the old flag useless, so these are exactly the accounts
-- that have seen the tour most and want it least.

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN "onboardedAt" DATETIME;

UPDATE "UserProgress" SET "onboardedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "onboardedAt" IS NULL;
