-- One AI with modes, instead of three AI pages.
--
-- AI Buddy, AI Tutor and AI Notes were three destinations that each knew
-- nothing about the student. They are now one page whose modes - ask, teach,
-- practice, mock exam, review notes - are the same assistant behaving
-- differently over the same context. A session therefore has to record which
-- mode it is in, and the subject it is about when there is one.
--
-- The table keeps its name. It holds more than chat now, but the sync engine
-- keys devices on model names, so renaming it would strand every 1.0.x desktop
-- install for a cosmetic gain.
--
-- Existing rows are all plain conversations, which is exactly what ASK means,
-- so the default backfills them correctly.

ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'ASK';
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "subject" TEXT;
