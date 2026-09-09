-- Reverses 20260909210000_account_setup_wizard.
-- Every account then looks unconfigured to the setup checklist again.

ALTER TABLE "UserProgress" DROP COLUMN IF EXISTS "setupCompletedAt";
