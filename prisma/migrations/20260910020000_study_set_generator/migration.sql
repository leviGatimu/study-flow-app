-- AI Study becomes a generator, and these two orphaned tables become its store.
--
-- TutorModule and QuizAttempt were built for the AI Tutor, deleted this morning.
-- They kept their names on purpose: both are LOCAL_ONLY in the sync registry, so
-- renaming them would buy nothing and cost edits to three schema files, the sync
-- and soft-delete constants, the class backfill list, the desktop sanitiser,
-- global search and the export payload - with four sync tests re-deriving their
-- constants from the Prisma DMMF and failing on anything missed.
--
-- Reusing QuizAttempt has a second payoff. insights-actions.ts already reads it
-- for a per-subject quiz average, and 100 minus that average is the
-- second-heaviest signal in attentionScore, which drives weak-area detection
-- across the whole app. Nothing has written an attempt since the tutor went, so
-- that signal has been null for every user. The generator restores it.

-- The four legacy columns are NOT NULL with no default, so every insert had to
-- supply values for things this feature does not use.
ALTER TABLE "TutorModule" ALTER COLUMN "notes" SET DEFAULT '';
ALTER TABLE "TutorModule" ALTER COLUMN "videos" SET DEFAULT '';
ALTER TABLE "TutorModule" ALTER COLUMN "exercises" SET DEFAULT '';
ALTER TABLE "TutorModule" ALTER COLUMN "flashcards" SET DEFAULT '[]';

-- The extracted text, so more questions can be generated later without asking
-- the student to find the same PDF again. The file itself is never stored.
ALTER TABLE "TutorModule" ADD COLUMN IF NOT EXISTS "sourceText" TEXT;

-- What was asked for: count, types, focus notes. Kept so the request can be
-- repeated exactly.
ALTER TABLE "TutorModule" ADD COLUMN IF NOT EXISTS "config" TEXT;

-- PRACTICE marks as you go; EXAM stays silent until the paper is finished.
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'PRACTICE';
