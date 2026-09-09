-- Record that an account has been through (or dismissed) the setup wizard.
--
-- Registration used to create an account, a silent "Year 1 / Term 1" nobody
-- chose, and nothing else - then drop the user on a dashboard that assumed they
-- already knew what a schedule template was and that the AI needed a key. This
-- column is what lets the app tell a configured account from a raw one.
--
-- Only "stop asking me" is stored. Whether any individual step is done is
-- derived from the data it would have created, so the checklist cannot go on
-- claiming a step is finished after the subject or key it created was deleted.
--
-- Backfilled: every account that exists today set itself up by hand, before any
-- wizard existed. Sending them through one now would be a bug, not a feature.

ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "setupCompletedAt" TIMESTAMP(3);

UPDATE "UserProgress" SET "setupCompletedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "setupCompletedAt" IS NULL;
