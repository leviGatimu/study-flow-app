-- One AI with modes, instead of three AI pages. See the Postgres migration of
-- the same name for why the table keeps its old name.

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'ASK';
ALTER TABLE "ChatSession" ADD COLUMN "subject" TEXT;
