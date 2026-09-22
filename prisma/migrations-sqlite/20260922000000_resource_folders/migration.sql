-- Resources become a file explorer. See the Postgres migration of the same name.

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "folder" TEXT NOT NULL DEFAULT '';
