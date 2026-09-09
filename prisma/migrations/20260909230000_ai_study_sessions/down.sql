-- Reverses 20260909230000_ai_study_sessions.
-- Every session then looks like a plain chat again.

ALTER TABLE "ChatSession" DROP COLUMN IF EXISTS "mode";
ALTER TABLE "ChatSession" DROP COLUMN IF EXISTS "subject";
