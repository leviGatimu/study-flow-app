-- Destructive rollback, manual only: export profile fields before running.
ALTER TABLE "UserProgress" DROP COLUMN "avatarUrl";
ALTER TABLE "UserProgress" DROP COLUMN "school";
ALTER TABLE "UserProgress" DROP COLUMN "bio";
