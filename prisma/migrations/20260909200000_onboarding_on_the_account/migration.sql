-- Remember the welcome tour on the ACCOUNT, not in the browser.
--
-- The flag lived in localStorage under 'study-flow-onboarded'. On the desktop
-- app that is a per-ORIGIN store, and desktop-app/main.js binds the first free
-- port from 3000 - so an install that started on :3000 one day and :3001 the
-- next was a different origin with different storage, and the tour greeted a
-- user who had already dismissed it many times.
--
-- Backfilled to createdAt rather than left NULL: every account that exists
-- today has been using the app for weeks or months, and NULL would mean "show
-- them the tour", which is the same bug wearing a different hat. Only accounts
-- created after this point start NULL and see it once.

ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);

UPDATE "UserProgress" SET "onboardedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "onboardedAt" IS NULL;
