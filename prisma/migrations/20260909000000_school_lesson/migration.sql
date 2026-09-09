-- The school day, per user, instead of one student's hardcoded into the app.
--
-- Until now the lessons a student attends lived in a `SCHOOL_DATA` array inside
-- components/SchoolTimetable.tsx - one real person's real timetable, imported
-- by the dashboard status card, the lesson notifications and the week view. So
-- every account on the deployment saw the same lessons, and nobody could change
-- them without a code change.
--
-- Class-scoped, like ScheduleTemplate: the school timetable belongs to an
-- academic year and a new year legitimately starts empty. classId is NULLABLE
-- for the same reason every other scope column is - the app must survive an
-- account that has no Class row yet.
--
-- Purely additive and guarded throughout, so it is safe to run twice.

CREATE TABLE IF NOT EXISTS "SchoolLesson" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime"   TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "isBreak"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "classId"   TEXT,

    CONSTRAINT "SchoolLesson_pkey" PRIMARY KEY ("id")
);

-- The one query the app runs constantly: "what does today look like for me".
CREATE INDEX IF NOT EXISTS "SchoolLesson_userId_dayOfWeek_idx"
    ON "SchoolLesson"("userId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "SchoolLesson_classId_idx"
    ON "SchoolLesson"("classId");

-- No unique constraint on (userId, dayOfWeek, startTime). Two lessons can
-- genuinely share a start time - a split class, a timetable being edited - and
-- a constraint here would reject the edit rather than let the user fix it.
-- Sync matches these rows on a natural key instead; see lib/sync/identity.ts.

DO $$
BEGIN
    ALTER TABLE "SchoolLesson" ADD CONSTRAINT "SchoolLesson_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "SchoolLesson" ADD CONSTRAINT "SchoolLesson_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
