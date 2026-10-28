-- Additive: existing accounts retain their name, preferences and progress.
ALTER TABLE "UserProgress" ADD COLUMN "bio" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "school" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "avatarUrl" TEXT;
