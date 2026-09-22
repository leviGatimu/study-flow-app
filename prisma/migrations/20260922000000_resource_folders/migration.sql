-- Resources become a file explorer.
--
-- `folder` is the path inside the subject a resource sits in ("" = the subject
-- root, "Chapter 1/Worksheets" = nested). A new type, FOLDER, is how an empty
-- folder exists and syncs: on the desktop the library reconciler turns such a
-- row into a real directory under Documents\Study Tracker.
--
-- Additive, so a deployed build that predates the column keeps working.
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "folder" TEXT NOT NULL DEFAULT '';
