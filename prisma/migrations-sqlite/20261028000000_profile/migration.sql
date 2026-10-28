-- Additive; no table rebuild and no existing data changes.
ALTER TABLE "UserProgress" ADD COLUMN "bio" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "school" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "avatarUrl" TEXT;
