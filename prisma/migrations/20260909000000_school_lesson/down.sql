-- Reverses 20260909000000_school_lesson.
--
-- DESTRUCTIVE: this drops every school timetable every user has entered. The
-- data existed nowhere before this migration, so there is nothing to fall back
-- to. Take a dump of "SchoolLesson" first if the rows matter.

DROP TABLE IF EXISTS "SchoolLesson";
