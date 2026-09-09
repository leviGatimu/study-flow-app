-- Reverses 20260909200000_onboarding_on_the_account.
-- Every account then looks new to the tour again.

ALTER TABLE "UserProgress" DROP COLUMN IF EXISTS "onboardedAt";
