# HANDOFF

## Current Task
PHASE 9 IS BUILT. Stages 0-5 are done and committed (18c2787). The desktop app
and the website now hold the same data, and the desktop still works with no
network. Levi asked for this on 2026-09-09: "both web and desktop are on sync".

WHAT REMAINS IS VERIFICATION ON A REAL DESKTOP INSTALL, which needs Levi:
  1. npm run build:desktop, then npm run pack in desktop-app/, and install it.
  2. Settings -> Sync with the website -> address, username, password ->
     Connect this device. It pairs, then immediately pulls.
  3. Add an assignment on the desktop and DO NOT press anything. It should be on
     the website within a couple of seconds.
  4. Change something on the website; the desktop should notice within 20s,
     refresh itself and say so.
  5. Pull the network cable, keep working, plug it back in - the backlog should
     go up on its own.
Nothing has been through those four steps. Everything else IS verified - see
"how it was proven" below.

### The shape of it, in one screen

  syncedAt         a new column on all 18 synced models. ON THE SERVER it is the
                   write time and the pull cursor orders by it. ON A DEVICE null
                   means "this row has local changes the server has not seen".
                   Two meanings on purpose: a device never has to compare its
                   clock with the server's, which is the one comparison clock
                   skew silently gets wrong.
  lib/sync/stamp.ts    maintains that column on both sides, as a client
                   extension in lib/prisma.ts, next to the tombstone filter.
                   One forgotten stamp on the server is a row nobody ever pulls;
                   one forgotten clear on a device is an edit that never leaves.
  lib/sync/merge.ts    THE ONLY FILE THAT DECIDES WHO WINS, and it runs
                   unchanged on both sides. Match by id or natural key; a
                   tombstone beats a live row whatever the clocks say; isDone
                   never goes backwards; monotonic/accumulated take max(); the
                   rest is LWW with a device-id tiebreak so both sides reach the
                   SAME answer rather than each preferring itself forever.
                   APPLY_ORDER is explicit - identity.ts lists task before
                   examEvent, and Task.examId references ExamEvent.
  lib/sync/protocol.ts cursor is (syncedAt, id). The id is not optional: many
                   rows share a millisecond, and a bare timestamp cursor either
                   repeats the tie forever or steps over it and loses rows.
  app/api/sync         GET pulls a page, POST pushes. Every query scoped to the
                   signed-in user; a pushed userId is OVERWRITTEN, not checked.
  app/api/sync/session POST username+password -> bearer token. THE ONLY STEP
                   THAT MUST BE ONLINE. Everything after it is local.
  lib/sync/client.ts   the device half. Push, adopt remaps, pull in pages, then
                   files. Push BEFORE pull, always: pulling first applies the
                   server's version locally and pushes it straight back, which
                   looks like it worked and discards the local edit.
  lib/sync/files.ts    uploads, lazily and never fatally.
  components/SyncPanel.tsx  Settings. Leads with "N changes still only on this
                   device", because that is the question people actually have.

### Three bugs the two-device harness caught. Do not reintroduce them.

  MARKING A ROW SYNCED COUNTED AS EDITING IT. updatedAt is @updatedAt, so the
  bookkeeping write after a push moved the pusher's row into the future; the
  next pull then found the server's newer content "older" and rejected it. Two
  devices synced cleanly, reported no errors, and permanently disagreed. Fixed
  by markSynced(), which writes the row's existing updatedAt back explicitly.
  Prisma honours an explicit value on an @updatedAt field - the engine depends
  on that, and the tests fail loudly if it ever stops being true.

  A RE-KEYED PARENT ORPHANED ITS CHILDREN MID-BATCH. B pushes its own duplicate
  "Maths" template plus the completed task under it; the server folds the
  template into one it already had, and the task that follows still points at an
  id the server has never heard of. The foreign key rejects it and the work
  never arrives. Fixed by FK_TO_PARENT plus a remap table carried through the
  batch.

  APPLY ORDER IS NOT DECLARATION ORDER. A test re-derives the constraint from
  the client's relation metadata now.

### The backfill migration, and why it is Postgres-only

20260909130000_sync_cursor_backfill exists because the first pull against the
REAL database returned zero rows while looking perfectly healthy. syncedAt
started NULL everywhere, and a NULL row has no position in the cursor's order,
so a device pairing with three years of work would have received nothing.

IT MUST NEVER BE RUN ON A DESKTOP DATABASE. There NULL means "not yet sent", so
backfilling would mark every local row as already synced and that device would
never push anything again. There is deliberately no SQLite twin.

### How it was proven

78 tests (npm run test:sync), including a server and two devices diverging
offline and reconnecting: a deletion that stays deleted, a completed task a
stale device cannot untick, both devices inventing "Physics" separately and
ending with one, and a duplicate template reconciled without destroying the
completed work under it.

Then against the live database, through the real HTTP route:
  - Levi's pull: 584 rows over two pages, cursor advances, zero overlap,
    hasMore goes false and it terminates.
  - John's pull: 44 rows, one owner id in the whole payload.
  - A row pushed with John's token while claiming Levi's userId landed under
    JOHN. That probe row was removed afterwards.

### Automatic sync (ccbb81e)

Levi: "i dont want sync to be manual it has to be automatic ... things should
sync every time something changes ... plus it should send notification".

  lib/sync/scheduler.ts   every local change pushes itself, debounced 1.5s.
                   Plus once ~8s after launch, a 5-minute safety-net timer, and
                   a nudge on focus/`online`. One sync at a time (all entry
                   points share one promise); the interval doubles to an hour
                   while failing and snaps back on success; nothing throws.
  lib/sync/notify.ts      a one-listener registry, and it exists ONLY to break a
                   cycle: lib/prisma.ts imports the stamp extension, so the
                   extension cannot import the scheduler, which imports
                   lib/prisma.ts.
  components/SyncWatcher.tsx  mounted in AppShell. A background push is
                   invisible to the window, so this polls a cheap pulse, calls
                   router.refresh() when rows actually arrived, and raises a
                   toast plus a desktop notification (only when the window is
                   NOT in front). Errors reported once per distinct problem, not
                   once per poll. Stops polling entirely on the web build and on
                   an unpaired install.

THE INVARIANT THAT MAKES IT SAFE, and the thing to check first if the desktop
ever gets hot and busy: APPLYING A PULL MUST NOT COUNT AS A LOCAL CHANGE. The
stamp extension treats a write carrying an explicit syncedAt as the engine's own
and stays silent. If that regresses, every sync schedules the next one and the
app syncs in a tight loop forever while looking perfectly healthy. Six tests in
test/sync/scheduler.test.mjs cover exactly that line.

### What is NOT done

  FILE SYNC IS HALF A FEATURE, and it cannot be finished from here. The web has
  no durable file store until SUPABASE_STORAGE_BUCKET plus the two keys are set
  on Vercel and the bucket exists (phase 8, written 2026-08-29, still not
  enabled). So device-to-server upload works and server-to-device finds nothing
  to fetch, and /api/sync/file refuses with 501 when remote storage IS
  configured - phase 8 mints its own filenames and would break the URL the
  synced row already carries. Enable the bucket, then reconcile the two naming
  schemes.

  (Sync being manual WAS listed here. It is not any more - see below.)

  focusSessions and totalFocusMinutes still merge as max(), not as a sum. They
  are bare counters with no ledger. xpEvent shows the right answer - an
  append-only row per grant, summed - and they need the same treatment.

  A RESTORE FROM BACKUP IS STILL INVISIBLE TO SYNC. importUserData hard-deletes
  (allow-listed in the soft-delete drift test), so the server never learns those
  rows went away and a later pull brings the pre-import data back. Either give
  importUserData a per-user epoch that forces a full re-sync, or tombstone.

  THE DESKTOP DATABASE STILL NEEDS scripts/clear-seeded-timetable.mjs --user John
  and scripts/backfill-class-scope.mjs, both pointed at the SQLite file. Sync
  will happily carry the un-repaired rows in either direction.

## Also done 2026-09-09: the school timetable is per-user now

Levi: "clear school portal data on everyone page they are getting same school
portal data for some reason". The cause was not a query bug. `SCHOOL_DATA` in
components/SchoolTimetable.tsx was a hardcoded array - Levi's real school week -
imported directly by the dashboard status card, the lesson notifier and
/timetable. Every account saw it, and only a code change could alter it.

  prisma  SchoolLesson: userId + nullable classId (both ON DELETE CASCADE),
          dayOfWeek 0=Sunday like ScheduleTemplate, startTime/endTime "HH:MM",
          subject, isBreak, plus createdAt/updatedAt/deletedAt.
          20260909000000_school_lesson APPLIED TO PRODUCTION. The SQLite twin is
          hand-written (additive CREATE TABLE, no RedefineTables - same rule the
          rest of that history follows); `db:sqlite:migration` prints "This is an
          empty migration", so there is no drift.
  lib/school.ts         lessonAt / nextLessonAfter / schoolDayBounds /
                        lessonsOn / toMinutes. "Which lesson is on now" existed
                        in three copies; intervals are half-open so two lessons
                        cannot both light up at a changeover.
  lib/school-actions.ts CRUD + replaceSchoolTimetable + extractSchoolTimetable.
                        updateSchoolLesson uses updateMany filtered by userId -
                        `where: { id }` alone is the exact hole found on subject
                        grades and flashcard reviews. Times are validated
                        against /^([01]\d|2[0-3]):[0-5]\d$/ at the boundary
                        because every consumer compares these strings rather
                        than parsing them, so "9:00" would sort wrong silently.
  /school -> /school-timetable, and NO LONGER ADMIN-ONLY. There is nothing to
          restrict once the page shows you your own week. Upload a photo (or
          PDF/DOCX) -> the model reads it -> an EDITABLE review list -> nothing
          is written until you press the button. Unreadable rows are dropped AND
          COUNTED, so the screen says "3 rows could not be read" rather than
          showing a lesson at the wrong time.
  components/useTimetableSync.ts   the lesson-tracking flag was two localStorage
          effects that could disagree about what "unset" means; now one
          useSyncExternalStore hook, the same pattern as the sidebar pin.
  /timetable  the "School Hours" band was two constants (07:30-17:20 Mon-Fri,
          08:00-14:00 Sat) drawn on everyone's week. It is now the span of the
          user's own first and last lesson, and a day with none draws nothing.
  NotificationManager  was comparing wall-clock time while the card beside it
          used the user's configured timezone. Now getRwandaTime for both. NOTE
          it is still not mounted anywhere - same standing question as
          ReminderManager: wire it up or delete it.

VERIFIED AGAINST THE LIVE DATABASE: levi has 44 lessons in Year 2; kenny, John,
Brian, Briann and Neymar have none, so their dashboards, week views and portals
show nothing. /school-timetable renders levi's week with the upload and add
controls, /timetable draws one derived band and no 08:00 Saturday, and /school
is a 404. NOT VISUALLY CONFIRMED - see the loopback note below; Levi has to look
at it himself.

scripts/seed-school-lessons.mjs moved Levi's hardcoded 44 lessons into his own
account. ONE-OFF and idempotent. Nobody else should ever be seeded with it. Run
it against the desktop database too, with DATABASE_URL pointing at the file.

## Previously (same day)
ACADEMIC YEAR SCOPING (2026-09-08). Levi: "i hate that we still got some year 1
data yet i said when new class started it starts fresh, same as the school
portal". He listed milestones, homework, resources, progress, history, marks,
goals, summaries, daily summaries, AI tutor, AI notes and sticky notes.

THE DIAGNOSIS, and it was not what it looked like: Year 2 had not inherited
anything. ~116 queries across 14 models, of which about 5 filtered by year at
all - so every page had ALWAYS shown lifetime data, and starting a new class
was never going to change that. An audit of the live database found every one
of the 17 already-scoped models had a correct classId/termId on every row:
the data was right, the queries never asked.

Done in four lanes (schema, lib queries, UI, write guards - see the sections
below), then verified end to end in a browser against the real database:
  Year 2  -> /exams has no Completed Milestones, /marks has no Year 1 standing
  Year 1  -> banner "Viewing Year 1 - a finished year. Everything here is
             read-only", 27 milestones, Term 3 at 90.1% First Class Honors
  Back to Year 2 -> clean slate again
Counts per year for levi are in "THE LAST FOUR UNSCOPED MODELS" below.

TWO SECURITY HOLES FOUND ON THE WAY, both pre-existing, both fixed:
  - updateSubjectGrade / deleteSubjectGrade used `where: { id }` with no owner
    check: any signed-in user could rewrite or delete anyone's marks.
  - updateFlashcardsReview did the same on tutorModule. Now an updateMany
    filtered by { id, userId }.

ALSO FIXED: every /exams request threw `ReferenceError: DOMMatrix is not
defined` server-side. 'use client' does not mean client-only - Next evaluates
the module on the server to render it, and pdf.js builds a DOMMatrix at import
time. lib/file-extract.ts now imports pdf.js lazily inside the function.

STILL OPEN, needs Levi's call:
  - Subject / SubjectGoal / StudioNote are unique on (userId, name), a
    constraint predating academic years, so a subject can exist only ONCE per
    account ever. Adding "Physics" in Year 2 hits "already exists" against an
    empty-looking list. Current behaviour: the row is ADOPTED into the writing
    year, which unblocks the user but removes it from the archive's list. The
    real fix is widening those constraints to (userId, classId, name) plus an
    update to lib/sync/identity.ts, which treats them as natural keys.
  - User.currentTerm is a legacy free-text field: /marks still says "Term 3"
    in Year 2. Cosmetic, unscoped by design, but wrong-looking.
  - /focus and FocusSessionUI are the known un-gated write surface in an
    archive (FocusSessionUI is off-limits per docs/ui-contract.md).

Before that, same day: desktop packaging pass (2026-09-08), on Levi's ask: "package this and put into
desktop ... ensure that UI is fine ... ensure the app is fine in production
mode ready for all users ... also receiving updates, user can click button to
update the app."

Shipped in this pass:
  - Status card shrunk twice on request, ending at `lg:min-h-[19rem]` (304px,
    verified against the live DOM). Sidebar rebuilt as a hover/pin-expanding
    rail and verified: 64px collapsed, 240px overlay on hover with the aside
    still 64 so the page does not shift, sub-pages inline, pin persisted.
  - An in-app update control: `desktop-app/main.js` tracks a real update phase
    and pushes it to the renderer, `preload.js` exposes electron.updates on the
    existing allow-list, and `components/DesktopUpdater.tsx` renders in
    Settings -> Desktop app (Check for updates -> Downloading N% -> Restart and
    update). It only renders inside the Electron shell.
  - Window floor of 960x640 (below md the app silently switches to its phone
    layout, and a desktop window can be dragged to any size); desktop.css
    scrollbars restored from width:0 to thin; the global desktop-only
    button:active scale(0.97) removed.

THREE PACKAGING BUGS FOUND AND FIXED - all of them shipped in 1.0.0:
  1. `.next/standalone` was 3.8 GB. outputFileTracingRoot is the repo root, so
     Next traced `desktop-app/dist` - the PREVIOUS packaged build, which
     contains a copy of a previous standalone server. Every build nested the
     last one inside itself (2.9 GB of the 3.8). Fixed with
     outputFileTracingExcludes in next.config.ts; standalone is now 78 MB.
  2. The installer shipped Levi's private data: `public/uploads` (71 MB of his
     own PDFs, audio and proof-of-work images) and `prisma/dev.db` plus two
     .bak copies. Neither is read at runtime - uploads live in userData via
     UPLOADS_DIR, and a user's database is built by the migrations on first
     boot. Both now filtered out of extraResources.
  3. The 1.0.0 installer in desktop-app/dist was BROKEN: a 208 KB
     StudyTrackerSetup.exe beside a 2.16 GB .nsis.7z, i.e. the run died before
     embedding the payload. Anyone who ran that setup got nothing.

DESKTOP DB UPGRADE BUG - FOUND AND FIXED (this is the big one). The packaged
app booted to its 503 page and every query died with
  P2022: The column `main.User.isAdmin` does not exist in the current database.
Cause: lib/sqlite-migrate.ts skips a statement whose object "already exists" -
right in itself, the table IS there - but on a database predating the migration
ledger that left every such table at its old shape while still recording the
migration as applied. A real install had 20 tables missing 64 columns. New
installs were fine, which is why it survived: only upgraders were broken.
Fixed by a reconcileColumns() pass that runs after the migrations on every
boot, diffing the CREATE TABLE / ADD COLUMN statements against PRAGMA
table_info and adding what is missing - nullable-plus-backfill for the two
shapes SQLite refuses in ALTER TABLE ADD COLUMN (CURRENT_TIMESTAMP defaults,
and NOT NULL with no default). Proven on a copy AND on Levi's live database:
64 columns, no drift left, 2 users and 241 tasks intact. Backup kept at
%APPDATA%/study-tracker-desktop/backups/database-before-column-repair.db.

UPDATE CHANNEL - LIVE, TWO RELEASES DEEP. v1.0.2 is published at
https://github.com/leviGatimu/Study-Flow/releases/tag/v1.0.2 with both assets
(StudyTrackerSetup.exe 103,494,164 bytes + latest.yml), not a draft, not a
pre-release, marked Latest - so a 1.0.1 install finally has something higher to
find. It carries all of the academic-year scoping work. v1.0.1 is still up.
setup/ holds a byte-identical copy of the published exe (sha512 verified
against latest.yml before upload). WATCH OUT: the code repo is
leviGatimu/study-flow-app but every shipped build is compiled to check
leviGatimu/Study-Flow - `gh release create` without --repo goes to the wrong one
and reaches nobody. Documented in setup/README.txt. `gh` on this machine IS
authenticated now (account leviGatimu, scopes repo/workflow) - an older note in
this file saying "Bad credentials" is stale.

ONE-OFF SUPABASE -> DESKTOP IMPORT (2026-09-08). Levi hit "desktop doesn't
have Year 2" and chose a one-off import over building Phase 9 now. The two
databases had never been connected: web = Supabase Postgres, desktop = its own
SQLite in userData, seeded empty on first launch. Every model was dumped with
the app's own Prisma client and inserted into the desktop database wholesale -
27 non-empty models, 365 tasks, 5 users, 36 subjects, 5 classes including
Year 2 - after wiping the desktop's own rows (241 tasks, 2 users), which is
sound only because those rows had never been anyone's source of truth.
_local_migrations was deliberately left alone; it describes the schema, not
the data. public/uploads (56 files, 71 MB) was copied to
%APPDATA%/study-tracker-desktop/uploads so the imported rows' PDF and audio
links resolve. Backup: backups/database-before-supabase-import.db.
Scripts kept in the session scratchpad (export-supabase.mjs,
import-to-sqlite.py) - they are one-off tools, not a sync engine.

THIS IS A SNAPSHOT, NOT SYNC. The two databases drift apart again on the next
edit to either side. Phase 9 remains the real fix, and its Stage 0 (identity
map + hazard tests) is already done.

STILL UNVERIFIED: the dashboard and Settings UI inside the packaged app (needs
a login, which Claude does not do), and an actual download-and-restart. The
second release now exists, so the restart path is finally testable: Settings ->
Desktop app -> Check for updates on the installed 1.0.1.

PREVIOUS OPEN ITEM, now closed: `leviGatimu/Study-Flow` is public but has ZERO
releases, so `releases/latest` 404s and every update check fails no matter how
good the client code is. `gh` on this machine is not authenticated ("Bad
credentials"), and Levi chose "you publish, I prep everything". Desktop version
bumped to 1.0.1 so anyone on 1.0.0 sees an update once the release exists.

Before that, same day: the status card's two SCHOOL states (the ones timetable
sync switches on) brought onto the same look AND the same footprint as the
break state - Levi screenshotted school-in-session and asked for it to look
like "the non timetable sync one", then for both to be the same size.

Before that, same day: remodelled the break/empty state, on Levi's request -
it looked "too basic" and had no way to act on it.

Before that: closing out every loose end left by Phases 0-8 (2026-09-06).
Phase 9 is the only phase not started, deliberately - Levi chose "loose ends
first, then decide" rather than starting the sync engine.

## THE LAST FOUR UNSCOPED MODELS - DONE (2026-09-08)

Phase 2 scoped 17 models but left four with no scope column at all, so they
could not be filtered by year even once the queries were fixed. They now have
one, backfilled and verified against production.

  prisma/schema.prisma
      + nullable classId + Class relation + @@index([classId]) on SubjectGrade,
        QuizAttempt, ChatSession and StickyNote, and the four inverse relations
        on Class. FK is ON DELETE CASCADE, matching every other classId FK.
      ChatMessage deliberately gets NOTHING: it hangs off ChatSession and is
      scoped through it. Do not "fix" that by adding a column.
  prisma/migrations/20260908000000_scope_remaining_models_to_class/
      ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + guarded FKs, plus
      a down.sql. APPLIED to production with `prisma migrate deploy`; 5
      migrations, "Database schema is up to date!".
  prisma/migrations-sqlite/20260908000000_scope_remaining_models_to_class/
      HAND-WRITTEN, not `prisma migrate diff` output. The generated SQLite diff
      for an added FK column is a RedefineTables block (CREATE new_X, INSERT
      SELECT, DROP X, RENAME). That is wrong here twice: lib/sqlite-migrate.ts
      runs statements one at a time with no surrounding transaction, so a
      failure mid-dance destroys the table it is copying, and reconcileColumns()
      only understands CREATE TABLE / ALTER TABLE ADD COLUMN, so a redefine
      leaves a database that skipped the migration unable to heal itself.
      SQLite accepts REFERENCES in ADD COLUMN when the column defaults to NULL,
      which it does here, so nothing is lost by staying additive. Proven on a
      scratch database built from all four SQLite migrations: 30 tables, the FKs
      register in PRAGMA foreign_key_list, enforce, and cascade.
      `npm run db:sqlite:migration` now prints "This is an empty migration." -
      the SQLite history and the schema agree, no drift.
  scripts/backfill-class-scope.mjs   (--dry-run to preview)
      SubjectGrade takes reportCard.termRef.classId; QuizAttempt inherits
      module.classId; ChatSession and StickyNote use the date rule (the class
      whose [startedAt, completedAt) window holds createdAt, falling back to the
      user's FIRST class for anything older than it). Idempotent: reads and
      writes both filter on classId IS NULL, so a re-run is a no-op and a
      hand-corrected row is never overwritten.

RESULT, all 76 rows on levi's "Year 1" (the expected answer - the Class rows
were minted 2026-08-28/29 but the data goes back to May, so everything predates
the first class): SubjectGrade 42, ChatSession 26, QuizAttempt 7, StickyNote 1.
Zero NULLs left in all four tables; zero rows scoped to another user's class;
zero grades disagreeing with their report card's term class. Re-ran the script
to prove the no-op. `npm run test:sync` still 54/54.

NOTE for whoever adds the next user-facing feature: user "Briann" has NO Class
row at all (the other four users do). Nothing in these four models belongs to
him, so the backfill was unaffected, but any code that assumes every user has a
class will break on him.

  EPERM TRAP, worked around, worth knowing: `npm run db:postgres` failed with
  the documented EPERM on query_engine-windows.dll.node because the dev server
  was up, and it dies BEFORE writing any client files - so the client was left
  stale, not broken. The engine binary it could not rename was byte IDENTICAL
  (same Prisma version, same provider), i.e. the only thing the lock blocks is a
  no-op copy. Worked around by generating to a scratch output path and copying
  everything except the .node file over client-custom-v8, then rewriting the
  embedded output-path string back. Shared client verified afterwards:
  activeProvider postgresql, new fields present, a real production query
  returns. THE RUNNING DEV SERVER STILL HOLDS THE OLD CLIENT IN MEMORY -
  restart it to pick up the new fields.

## READ-ONLY YEAR ARCHIVE - UI (2026-09-08)

Levi: "classify it as year 1 data, and when we click open year 1 it opens same
interface just year 1 information loaded into, then go back to Year & terms then
back to year 2 ... when a new class starts it starts fresh, same as the school
portal". He chose a READ-ONLY archive: browsing a finished year shows
everything and changes nothing.

This is the UI half. lib/scope.ts owns which year every query reads from; that
work and the four new classId columns are in their own sections.

### How it works
  app/archive-actions.ts    NEW. openArchivedYear(formData) validates the class
      is the user's own, sets the viewingClassId cookie (httpOnly, 30d, same
      options as the session cookie) and redirects to the dashboard.
      exitArchive() clears it. Both are <form action> submits, not transitions:
      the cookie changes what EVERY page reads, so the whole app has to
      re-render. Choosing the ACTIVE class DELETES the cookie rather than
      pinning its id - pinning would silently become an archive as soon as the
      next year starts.
  components/ArchiveContext.tsx   NEW. ArchiveProvider / useArchive /
      useIsArchived / useArchiveReason / <ArchiveGate>. Any client component
      can ask "am I in an archive" without another round trip.
  components/ArchiveBanner.tsx    NEW. The bar under the header. Rendered in
      AppShell OUTSIDE <main>, so it survives navigation and never scrolls
      away. Always offers a way out - "Back to Year 2", or "Leave archive" when
      there is no active year, which is a real state (finish a year, do not
      start the next one) and would otherwise strand the user.
  app/layout.tsx    computes the scope once and passes it into AppShell. The
      ACTIVE year's label costs a second query, so it is only fetched when an
      archive is actually open.

### Page-level queries scoped (the ones that bypass lib/)
  app/subjects/page.tsx    Resource, SubjectGoal, TutorModule, StudioNote by
                           class; Homework, ReportCard by term.
  app/streak/page.tsx      the activity calendar's Task query, by term.
  app/timetable/page.tsx   this week's Task query, by term.
  app/school/page.tsx      left alone - it only reads User.

### The switcher
Year & Terms: each finished year now has "Open <label>" (primary) beside a
"Report" toggle, which is the old inline summary renamed. The year you are
inside is badged "Open now" and its button becomes "Close <label>". While an
archive is open the ACTIVE year's controls on that page are hidden too - they
write to a year you are not looking at.

### Write affordances gated
Gated inside the shared component wherever possible, so one edit covers every
call site: QuickAddForm (sidebar, header, calendar, dashboard, manage),
UploadTimetableDialog, ManageForm, EditTemplateForm, AddResourceForm,
AddMasteryForm, ExamsClient + DeleteExamButton, ExamCountdown, ExamPlanner,
MasteryList, DeleteTask/Template/Resource/SubjectButton, TaskCheckbox,
TaskList's attach-proof, CalendarGrid (mark day, last day, per-session edit and
delete), StickyNotesContainer (including DRAG, which persists a position),
StudioWorkspace (autosave, Ctrl+S and the save button all funnel through
doSave, which is guarded once), TutorSetupForm + TutorClient, AiNotesInterface,
SubjectsClient (including the notes autosave effect), MarksClient, GoalsClient,
HomeworkList/HomeworkCard, projects.

Two deliberate exceptions, both because they carry information as well as an
action: TaskCheckbox and MasteryList's checkbox stay VISIBLE but disabled - the
tick is the record of what was done. Everything else is hidden, since the
banner already says why. The sidebar's "Add a task" is replaced by an
explained, aria-disabled "Read-only year" button rather than vanishing, because
an empty primary slot reads as a bug.

### NOT gated - known, deliberate
  - /focus and FocusSessionUI. Starting a session on an archived task would
    write to it. FocusSessionUI is off limits in the UI contract and focus is
    reached from a task row, so it needs its own pass.
  - The AI chat surfaces (app/ai, StudioWorkspace's panel, SubjectsClient's
    chat tab, ProjectInterface). askAIBuddy grants XP and can write ChatMessage
    rows. XP is lifetime rather than year-scoped, so this is arguable; it was
    left alone rather than removing the ability to ask questions about work you
    are reading.
  - app/settings. Account-level, not year-scoped. Correct as is.

### Verified / not verified
  npx tsc --noEmit clean. NOT run in a browser - the flow that still needs
  eyeballing is: Year & Terms -> Open Year 1 -> banner appears -> dashboard,
  exams, subjects and marks all show Year 1 -> Back to Year 2.

  While fixing a build break: StickyNotesContainer's optimistic new-note object
  literal did not have the classId the schema agent had just added. It now
  passes classId: null (the server fills the real one).

## Status
Phases 0-7 COMPLETE. Phase 8 code COMPLETE, still not enabled (needs Levi's
keys). Phase 9 not started. Typecheck clean; `next build` passes.

EVERYTHING IS NOW COMMITTED, on branch `phase-0-8-restructure`. Before
2026-09-06 all of it - seven phases - existed only as uncommitted working-tree
changes, one bad checkout from being lost. `main` is still at a353a40 (June),
untouched, so nothing deploys differently until you merge:
    git checkout main && git merge --ff-only phase-0-8-restructure

## THE BACKLOG, from five audits on 2026-09-06

Ordered by severity. Everything below is verified in-tree; nothing is a guess.
Items marked DONE were fixed the same day.

### Security
- [x] Desktop installer shipped the production JWT_SECRET + Postgres password
      in plain text (resources/server/.env). FIXED.
- [x] AI API keys shipped to the browser on /ai, /history, /ranks, /streak,
      /exams via syncStreak's unfiltered findUnique. FIXED - see
      SafeUserProgress in lib/types.ts.
- [x] Levi's personal timetable was hardcoded and sent to every user's AI.
      FIXED: buildSchoolTimetable() reads the user's own ScheduleTemplate.
      Verified John now gets his own 17 blocks, not Levi's 20.
- [ ] Quiz self-grading embeds raw student answers in the grading prompt
      (lib/tutor-actions.ts:328-351). Harmless while single-user; delimit the
      answers before this is ever exposed to other students.

### Data integrity
- [x] toggleTaskDone paid +100 XP on every call; completeHomework +200. FIXED
      by the XP ledger's idempotency key.
- [x] Model output written straight to the DB with no validation. FIXED: all
      4 copy-pasted parsers replaced by lib/ai-parse.ts (parseJsonLoose +
      sanitizeGrades/sanitizeQuestions/asString/asNumber). A malformed grade
      is now dropped and counted, not stored; a quiz that fails to parse no
      longer loses the student's submitted answers.
- [ ] Anthropic/Groq keys are silently stored in the geminiApiKey column
      (ai-actions.ts:816-819), permanently breaking that key. ~150 lines of
      askAnthropic/askGroq are unreachable dead code. Wire them up or delete.

### Correctness / cost
- [x] A desktop build left the WEB app permanently broken: both targets generate
      the Prisma client to node_modules/.prisma/client-custom-v8, so after
      `npm run build:desktop` every web query died with "the URL must start with
      the protocol `file:`". FIXED 2026-09-08 - scripts/build-desktop.mjs always
      restores Postgres, and packaging now reads its own SQLite snapshot. Full
      write-up in "The shared-Prisma-client clash" below.
- [x] No Range support, so audio seeking was broken. FIXED: the uploads route
      now parses Range, answers 206 with Content-Range, advertises
      Accept-Ranges, and 416s an unsatisfiable range. 10 tests cover the
      boundaries. This also unblocks progressive PDF loading for the viewer.
- [ ] askGemini has NO timeout at all; OpenAI/Groq inherit a 10s default that
      is too short for vision calls. Ollama correctly uses 120s.
- [ ] getScheduleSummary sends EVERY task the user has ever had to the model
      (getAllTasks has no date filter) - grows forever, costs forever.
- [ ] Several prompts have no size cap: generateAiNoteFromText, the chat's
      document context, createTutorModule, uploadReportCard. The 25MB limit in
      UploadTimetableDialog is fictional - nothing checks file.size.

### Known-dead or duplicated
- [ ] components/PDFViewer.tsx is never imported. Every "open file" in the app
      is a plain <a target="_blank">, so there is no in-app viewer at all.
- [ ] Three separate chat UIs over one askAIBuddy (app/ai, StudioWorkspace,
      ProjectInterface) could share one panel.

## WHEN YOU WAKE UP - three things need YOU, not me

1. VERCEL DATABASE_URL still points at port 6543 (transaction pooler), which
   measured 828ms per query vs 165ms on 5432. Local .env is already switched.
   The deployed site is still 5x slower than it needs to be.

2. UPLOADS: create the bucket. Supabase dashboard -> Storage -> New bucket,
   named "uploads", LEAVE IT PRIVATE (the app serves files through its own
   authenticated /uploads route now, so a public bucket would only expose your
   report cards). Then set the three variables from .env.example on VERCEL
   ONLY. I could not create the bucket - writing to the production Supabase
   project was blocked by the permission classifier. Files uploaded to Vercel
   before this are gone regardless.

3. THE ELECTRON APP HAS STILL NEVER BEEN LAUNCHED. What IS now verified is
   everything below Electron: the SQLite migrations apply cleanly (29 tables,
   31 indexes), and the real Prisma client does real app-shaped work against a
   real SQLite file - Class/Term/Subject/Template/Exam/Task with nested
   relations and groupBy. What remains unproven is only electron-builder
   packaging and the window launch.
   I could NOT run it because YOUR DEV SERVER WAS RUNNING: `npm run db:sqlite`
   dies with EPERM while node holds the Prisma query-engine DLL, and switching
   the client to SQLite would have broken the app you had open. Stop the dev
   server first, then `npm run build:desktop`, `npm run pack` in desktop-app/,
   open it - and run `npm run db:postgres` afterwards or `npm run dev` breaks.
   SAFE TO PACK NOW: until 2026-09-06 an installer built from this tree shipped
   the production JWT_SECRET and Postgres password in plain text inside
   resources/server/.env. That is fixed (the .env is excluded and the desktop
   app mints its own signing secret per install) - but if you built and
   distributed an installer BEFORE that fix, rotate JWT_SECRET and the database
   password, because anyone holding that file can forge a login for the live
   site or connect straight to the database.

## PHASE 9 - two-way sync. STARTED 2026-09-06 (Levi approved Stage 0)

Still true: a partial sync engine corrupts data rather than merely annoying
you. It ships when it is proven, not when it runs once.

### The plan changed after reading the schema. Read this before writing code.

The original plan was "outbox + cursor + last-writer-wins on updatedAt". That
is the right TRANSPORT but it cannot work on this schema, for two reasons that
are already verified:

1. SEVEN OF THE NINE UNIQUE CONSTRAINTS ARE NATURAL KEYS THAT BOTH DEVICES CAN
   CREATE INDEPENDENTLY:
       Subject(userId,name)         DailySummary(userId,date)
       MarkedDay(userId,date)       StudioNote(userId,subject)
       SubjectGoal(userId,subject)  WeeklySummary(userId,startDate,endDate)
       Term(classId,index)
   Each device mints its own cuid, so LWW-by-id never realises the two rows are
   the same thing, and the merge dies on a constraint violation.
   Subject is the CERTAIN one: seedSubjectsIfEmpty() populates the subject list
   on a fresh desktop install BEFORE it has ever synced, so first sync collides
   every single time.

2. TASKS WOULD DUPLICATE SILENTLY, WHICH IS WORSE THAN FAILING.
   ensureTasksGenerated (lib/actions.ts) dedupes on `templateId|dateKey` in
   APPLICATION CODE - there is no unique constraint on Task. Two devices each
   generate today's blocks, neither sees the other's, nothing errors, and the
   user opens the app to find the whole timetable twice.

So the first real deliverable is NOT the engine. It is an IDENTITY MAP: a
per-model declaration of what makes a row "the same row". Everything else
depends on it.

### STAGE 0 IS DONE (2026-09-06)

  lib/sync/identity.ts       what makes a row "the same row", all 28 models
  test/sync/harness.mjs      three isolated SQLite DBs from the real migrations
  test/sync/hazards.test.mjs the four known failures, reproduced for real
  test/sync/identity.test.mjs  drift guard against the schema

  npm run test:sync:setup    once, after any schema change
  npm run test:sync          16 tests, ~4s

The harness generates its OWN Prisma client to
node_modules/.prisma/client-sqlite-test. It must keep doing that: the desktop
build generates over the app's client, so a harness sharing that path would
break a running dev server mid-test (see the build:desktop trap above).

Decisions worth not re-litigating, all reasoned in identity.ts:
  - v1 scope is the academic core. ExamEvent and Homework are IN, because
    Task.examId would otherwise dangle. Chat and music are OUT.
  - DailySummary/WeeklySummary are never synced - recomputed from Task.
  - MasteryItem and Resource keep ID matching ON PURPOSE. The app already
    allows two checklist items with the same title, so a natural key would
    merge two different things and destroy one.
  - Subject must be matched CASE-FOLDED. normalizeSubject does not lowercase
    and the Postgres constraint is case-sensitive, so "Physics"/"physics" are
    two rows to the DB and one subject to the student.

### THE XP PROBLEM - decide this before Stage 3
There is NO XP ledger anywhere. xp / level / focusSessions / totalFocusMinutes
are running totals written by read-modify-write (lib/gamification.ts addXp).
Last-writer-wins on them does not just fail to add two devices' earnings, it
ERASES one side's, unrecoverably, because nothing records where the XP came
from. Two options, and the first is better:
  a) an append-only XpEvent table (userId, source, amount, sourceId, createdAt)
     with xp/level recomputed from it - append-only rows need no conflict
     resolution at all;
  b) devices report DELTAS since their last sync and the server sums them.
Streaks are a related case: Class.currentStreak should become a CACHE derived
from the set of days with a completed Task, not an authoritative value - a
streak is a function of a sequence and cannot be merged as an integer.

### Sequencing (each stage leaves the tree shippable)

  Stage 0  Two-device test harness + the identity map   [DONE]
  Stage 1  Outbox - capture writes via a Prisma client extension in
           lib/prisma.ts, so hundreds of call sites stay untouched
  Stage 2  /api/sync push+pull, cursor on SERVER time (client clocks lie)
  Stage 3  Merge rules: LWW, isDone=true beats false, natural-key
           reconciliation, deletion propagation
  Stage 4  Offline auth (desktop must open on a plane)
  Stage 5  File sync - now cheap, both backends already speak one URL shape

Rough cost: 4-7 focused sessions, dominated by Stage 0 and Stage 3, NOT by the
API. Sync bugs only appear when two real devices diverge and reconnect.

### Two decisions taken deliberately

BUILD THE HARNESS BEFORE THE ENGINE. Simulating two devices against one server
is the only way to prove this does not eat data, and it is what makes every
later stage fast to verify. Writing merge logic first means writing it blind.

DO NOT SYNC ALL 28 MODELS IN V1. Sync the academic core - Class, Term, Task,
ScheduleTemplate, Subject, exams, homework, marks. Leave AI chat history and
the music library local-only. That removes most of the large-file transfer and
a third of the risk, and the scope can widen later. Syncing everything on day
one is how this becomes a data-loss story.
  CAVEAT to check in Stage 0: a SYNCED row pointing at a LOCAL-ONLY row is a
  dangling reference. Task.examId is exactly that shape, so ExamEvent probably
  has to be in the synced core rather than out of it.

## The agreed model

    User      XP - level - ranks - AI keys - timezone - theme   (lifetime)
     +- Class "Year 2"  [ACTIVE]   <- streak lives here, resets per class
          +- weekly timetable (ScheduleTemplate)  <- CLASS-scoped, persists across terms
          +- subjects - goals - resources - notes - tutor - marks   (class-scoped)
          +- Term 1  [COMPLETED] -> summary
          +- Term 2  [ACTIVE]    -> tasks - exams - homework - summaries (term-scoped)
          +- Term 3  [UPCOMING]

Decisions (from Levi, do not re-litigate):
- "Class" = an academic year / level. Label is free text ("Year 1", "S6"),
  chosen from options or typed.
- The timetable does NOT reset between terms. A new term resumes the same
  weekly schedule; the user edits it if it changed. Only a NEW CLASS is blank.
- Streak resets per class. XP / level / ranks are lifetime.
  => move currentStreak/longestStreak/lastActiveDate from UserProgress to Class.
  => dashboard can show "Year 2: 12 days - all-time best 41 (Year 1)".
- Terms have start/end dates, but dates only PROMPT, never act:
  end date reached -> "Term ends today" [End term now] [Extend]
  start date reached -> "Term starts today" [Start term]
- A manual Pause toggle, usable any day mid-term. Stops generation, freezes
  streak, does not end the term. REPLACES the existing schoolEndDate feature.
- Nav: nest, delete nothing. 27 links -> 6 destinations + tabs + command palette.

Core rule: tasks generate ONLY when a term is ACTIVE and not paused.
checkAndMarkMissedTasks obeys the same gate.

## Key finding (a real bug, not just UI)
ensureTasksGenerated (lib/actions.ts:157) never checks schoolEndDate. Only
syncStreak (lib/actions.ts:685) does. So today the app generates tasks straight
through a school break and checkAndMarkMissedTasks then marks them all missed.
The term-state gate in Phase 2 fixes this.

## Additional decisions (round 2, from Levi)
- Desktop = SQLite local. Web = Supabase Postgres. DESTINATION IS REAL TWO-WAY
  SYNC (Levi chose this after being told it is large). Agreed sequencing: build
  the foundations sync needs into the schema work happening anyway, ship desktop
  local-first, land the sync engine LAST. Same destination, nothing wasted.
- Desktop KEEPS login (multiple profiles per PC), so desktop auth must work
  offline after a first online login.
- Exams: FULL rework - real model, subject+term links, backward revision
  planning, scores feeding Marks/Insights.
- Add a persistent top header: page title + Year/Term chip, centre search field
  (reuse CommandMenu + universalSearch, rebind to Cmd+K), right-side icons
  (reminders, focus, quick-add, theme, profile). Sidebar shrinks to 6 nav items;
  theme toggle + logout move into the header profile menu.
- On desktop the header doubles as the window title bar (frameless +
  -webkit-app-region: drag).

## Additional findings (all verified in-tree)
1. DESKTOP BUILD IS BROKEN. desktop-app/main.js:80 sets
   DATABASE_URL="file:"+dbPath (SQLite) but prisma/schema.prisma is
   provider="postgresql". A Postgres client rejects a file: URL at init, so any
   installer built from the current tree fails on launch. SQLite is not a
   revert - it is finishing a half-done migration.
2. SLOWNESS IS NOT ONLY THE DB. Supabase region is fra1 (Frankfurt); from
   Kigali that is ~150-200ms per query. The dashboard fires 7 server actions,
   and EVERY page sets `dynamic = 'force-dynamic'` + `revalidate = 0`, so
   nothing is ever cached. Electron also cold-starts a full Next server each
   launch. Local SQLite fixes the first; the other two need separate work.
3. EXAM TITLE IS USED AS A SUBJECT KEY. app/exams/page.tsx:56 calls
   getSubjectStats(nearestExam.title) and getMasteryItems(nearestExam.title).
   An exam named "Physics Paper 1" silently returns zero prep stats and the
   page looks like it is working. ExamEvent is only {title, date, priority} -
   no subject FK, no time, no result, no term.
4. UPLOADS DO NOT SURVIVE ON THE WEB. lib/upload.ts writes to
   public/uploads/ on the local filesystem; Vercel's FS is ephemeral and
   read-only at runtime. Every uploaded PDF/proof/song on the deployed app is
   failing or vanishing on deploy. Needs Supabase Storage.
5. 15 MODELS HAVE NO updatedAt, including Task and ScheduleTemplate. Only Task
   has a soft-delete flag. Last-writer-wins sync is impossible without both,
   and deletions cannot propagate (a deleted row gets resurrected).
6. No `publish` config in desktop-app/package.json - there is no update path at
   all today, only a hand-built StudyTrackerSetup.exe.
7. Search covers 5 entity types (misses subjects, exams, resources, marks,
   notes) and uses plain `contains`, which is case-SENSITIVE on Postgres and
   case-INsensitive on SQLite - so search will behave differently on web vs
   desktop unless normalised. Prisma's `mode: 'insensitive'` is Postgres-only.

## Roadmap

  Stage A - Feel
    0. Foundations: tokens, 5 primitives, motion budget
    1. App chrome: top header + search + Cmd+K, nav 27->6, profile menu
  Stage B - Structure
    2. Schema: Class + Term + updatedAt/deletedAt on EVERY model (ONE migration)
       [written, not applied - see "Phase 2 state"]
    3. Lifecycle: generation gate, pause, end/start term, archive mode
    4. Summaries: term + year, as views over lib/grading.ts
  Stage C - Exams
    5. Exam rework: model, subject/term links, backward revision planning,
       scores -> Marks
  Stage D - Desktop (independent of A-C, can run in parallel)
    6. SQLite + speed: dual-provider build, migrate-on-launch, frameless title
       bar, remove blanket force-dynamic
    7. Updates: electron-updater + GitHub Releases, backup-then-migrate on launch
  Stage E - Sync
    8. File storage: uploads -> Supabase Storage (also fixes finding 4)
    9. Sync engine: outbox, pull/push cursor, LWW resolution, offline auth

  The page-by-page UX pass is NOT a phase - pages move onto the primitives as
  each area is touched.

  KEY: the schema is touched ONCE (phase 2). Migrating production Postgres is
  the riskiest step; doing it twice doubles the risk for no gain.

## Design notes for later phases

Dual-provider Prisma: `provider` cannot be an env var. Plan is one canonical
schema (Postgres) + a build script that rewrites the datasource block to sqlite
and generates to the same output path, so lib/prisma.ts needs no change.
`npm run build` = web/Postgres; `npm run build:desktop` = SQLite. Keep a
separate sqlite migration history for migrate-on-launch.

Exam model (phase 5): subjectId FK, termId FK, title, date, startTime, endTime,
room, kind (QUIZ|TEST|MIDTERM|FINAL), weight, status, score, maxScore, notes.
"Plan revision" generates REVISION Tasks backwards from the date, linked to the
exam, reusing the existing task machinery. UploadTimetableDialog already does AI
extraction of exam timetables - rewire it to the new model rather than rebuild.

Sync (phase 9): cuids are already globally unique, so no ID remapping needed.
Row-level last-writer-wins on updatedAt, tiebreak on device id; use SERVER time
for the sync cursor to survive client clock skew. Consider making isDone=true
win over false so completed work is never lost to a stale device.

Windows code signing: unsigned NSIS installers trigger SmartScreen. Shippable
without it; users click through a warning.

## Progress
- [x] Read the app end to end; mapped 28 routes / 27 nav links / ~40k LOC
- [x] Identified overlapping surfaces (schedule x5, progress x8, AI x5, notes x4)
- [x] Confirmed there is NO academic structure in the schema today
      (User.currentTerm is a free string used only to tag report cards)
- [x] Agreed the Class/Term model and the UI direction with Levi
- [x] Round 2: audited desktop build, exams, search, uploads, sync readiness
- [x] Phase 0 - Foundations: tokens, 5 primitives, motion budget
- [x] Phase 1 - App chrome: header, search, nav 27->6
- [x] Phase 2 - Schema: applied to production and verified
- [x] Phase 3 - Lifecycle: generation gate, pause, end/start term (archive UI
      still to do - see below)
- [x] Phase 4 - Term + year summaries
- [x] Phase 5 - Exam rework
- [x] Phase 6 - Desktop SQLite build (speed done separately, see PERFORMANCE)
- [x] Phase 7 - Desktop auto-updates (wired; NOT run through a real release yet)
- [x] Phase 8 - Uploads: backend complete and unified behind one authenticated
      route; NOT ENABLED (needs the bucket + Levi's keys on Vercel)
- [ ] Phase 9 - Two-way sync engine
- [x] 2026-09-06 - Loose-end pass: committed everything, repaired both migration
      histories, fixed migrate-on-launch, the tour, reminders, subject
      deletes-on-read, search, and desktop upload durability. See below.

## What Phases 0 + 1 actually changed

New files:
  lib/nav.ts                     single source of truth for navigation. The
                                 sidebar, the header breadcrumb and the command
                                 palette all read from it, so they cannot drift.
  components/ui/page-header.tsx    components/ui/section.tsx       |
  components/ui/panel.tsx         > the five primitives
  components/ui/stat.tsx          |
  components/ui/empty-state.tsx  /
  components/ui/dropdown-menu.tsx  (needed for the header profile menu; the app
                                    had no dropdown primitive at all)
  components/AppHeader.tsx       persistent top bar

Rewritten:
  components/Sidebar.tsx    6 destinations; children expand only for the section
                            you are in. No framer-motion, no width animation.
  components/AppShell.tsx   sidebar + header frame; only the main region scrolls
  components/CommandMenu.tsx  Cmd/Ctrl+K (Cmd+E kept as alias), lists every
                            destination from NAV_LEAVES, and fixes a stale-
                            closure bug in the old debounce plus an out-of-order
                            response race.
  components/ThemeToggle.tsx  no framer-motion; renders once, in the header.
  app/layout.tsx            passes subjects through for the header quick-add
  app/page.tsx              hero calmed: greeting + date + three Stats. The two
                            duplicate ThemeToggles and the clock/palette hint
                            are gone (they live in the header now).

Mechanical sweep: 144 decorative motion classes removed across 68 files
(entrance animations, hover lift/scale, active:scale).

IMPORTANT sweep caveat, already handled: the first pass also stripped
`duration-500/700/1000` from functional `transition-*` classes, which broke the
focus timer's 1s linear fill. Everything was restored from HEAD and re-swept
with a precise pattern that only removes durations inside an `animate-in`
chain. components/FocusSessionUI.tsx is excluded from the sweep entirely - it is
the immersive mode and its motion is deliberate. If the sweep is ever re-run,
keep both of those rules.

## Verification status
- `npx tsc --noEmit` clean.
- `npx next build` succeeds, all 40 routes compile.
- NOT visually confirmed in a browser. Chrome could not reach the local dev
  server (network-level error) even with the server unsandboxed and confirmed
  listening on 127.0.0.1:3000 and answering 200 from the shell. Worth eyeballing
  by hand: dashboard, one child-nav page, Cmd+K, the mobile (<768px) drawer.

## Known follow-ups from this phase
- OnboardingTour still anchors 3 steps to sidebar selectors that no longer
  exist (nav-exams, nav-focus-mode, nav-ai-buddy). It degrades safely - a step
  with a missing target just renders centered - but the tour should be rewritten
  or retired in Phase 5.
- ReminderManager is still not mounted anywhere. No bell icon was added to the
  header rather than ship a dead control; wire it up or delete it.
- The header has a slot for the Year/Term chip. Phase 3 fills it.

## Phase 2 state (APPLIED 2026-08-29, verified)

Files:
  prisma/schema.prisma
      + model Class  (academic year; owns the streak, the pause, the timetable)
      + model Term   (dates only PROMPT, never auto-transition)
      + updatedAt (@default(now()) @updatedAt) and deletedAt on all 26 models
      + nullable classId / termId scope FKs
      Relation field is named `termRef` everywhere (not `term`) because
      ReportCard already has a `term String` column.
  prisma/migrations/20260828000000_class_term_and_sync_columns/migration.sql
      Additive only. Every statement IF NOT EXISTS / duplicate_object guarded,
      so it is safe to run twice. Nothing dropped, renamed or retyped.
  .../down.sql
      Explicit rollback (Prisma does not generate one).
  prisma/backfill-classes.ts   (npm run backfill, --dry to preview)
      Creates one "Year 1" Class + a Term named from user.currentTerm per user,
      copies the streak from UserProgress onto the Class, links every existing
      row. One transaction per user. Skips users who already have a Class, and
      only ever touches rows whose FK is still NULL, so re-running is a no-op.

Every new column is nullable or defaulted, which is what makes it safe to apply
to the populated tables. NOT NULL columns carry @default(now()) - without that
the ALTER TABLE would fail on every table that already has rows.

### Migration history was broken; it has been baselined and is now correct
The database had NO _prisma_migrations table at all - it was built entirely with
`prisma db push`. The old prisma/migrations/20260509183621_init claimed the
schema was two tables (ScheduleTemplate, Task), true only in the SQLite era.
That folder was DELETED (recoverable from git) and replaced with
prisma/migrations/0_init, generated from the pre-Phase-2 schema via
`prisma migrate diff --from-empty` and covering all 27 tables. It is recorded in
_prisma_migrations with applied_steps_count=0, i.e. baselined: accounted for,
never re-run.

History is now:
  0_init                                      (baseline, 0 steps)
  20260828000000_class_term_and_sync_columns  (1 step)
`prisma migrate deploy` is safe again, and Phase 7's desktop migrate-on-launch
is unblocked.

If a migration file is ever edited, its sha256 must be updated in
_prisma_migrations.checksum or Prisma will report the migration as modified.

### Verified after applying (independent SQL, not the script's own check)
  2 new tables; 28 updatedAt cols; 28 deletedAt cols; 10 classId; 7 termId
  4 classes, 4 terms created
  levi -> Class "Year 1" + Term "Term 3" (from his currentTerm), 351 tasks,
    20 templates, 15 subjects, 27 exams, 3 report cards + everything else
  John -> 6 tasks, 17 templates, 11 subjects.  kenny/Brian -> empty, containers
    created anyway so they are ready to use.
  Row totals UNCHANGED: 357 tasks, 37 templates, 26 subjects.
  0 unscoped rows anywhere; 0 users without an ACTIVE class; 0 streak
  mismatches (streaks carried from UserProgress onto Class correctly).

### Gotcha hit during the backfill - keep the fix
The first real run died with P2028 "Transaction not found". Prisma's interactive
transaction timeout defaults to 5s; the backfill runs ~16 sequential statements
against fra1 (~180ms per round trip from Kigali), which overruns it. The
rollback was clean - 0 classes, 0 links, all 357 tasks intact - which is exactly
why the script uses one transaction per user. Fixed with
`{ timeout: 120_000, maxWait: 30_000 }`. Any future bulk data script against
this database needs the same treatment.

## Sidebar redesign (2026-08-29, after Levi's feedback)
Feedback was: open/close animation "very off", sizing off, "too professional"
(sharp corners), and "a bit too empty". The first pass over-corrected into
austerity. Changes:
  - Width now TRANSITIONS (transition-[width] 200ms ease-out). Removing the
    animation entirely made collapsing read as broken. This is the one piece of
    motion the sidebar is allowed.
  - Sizing: 272px expanded / 76px rail (was 224/60). Items h-11, icons 20px,
    labels 15px. Header is 64px so the two line up.
  - Softer shapes: nav items and buttons rounded-2xl, children rounded-xl,
    dropdown rounded-2xl. Active item is bg-primary/10 + primary text rather
    than flat grey.
  - No longer empty: a prominent "Add task" button at the top (which AGENTS.md
    asked for originally) and a streak/level/XP card at the foot linking to
    /ranks.
  - The header's "+" is now md:hidden - the sidebar owns that action on desktop,
    so it is not shown twice.
  - ProgressFooter is written inline rather than reusing RankBadge, because
    RankBadge is built from the uppercase letter-spaced micro-labels this
    redesign is retiring. It also deliberately ignores getRankInfo().color:
    that palette runs to text-slate-300 / text-amber-400, which is unreadable
    on the light theme.

## Header stat strip (2026-08-29)
Levi asked for day streak / all-time best / level / XP / local clock in the
header. New components/HeaderStats.tsx renders them as a compact strip between
the search field and the action icons, divider between the two groups.
  - Each is a link to the page that explains it (/streak, /ranks, /time) and
    carries a title attribute, since a 64px bar has no room for caption text
    under each number - stacking captions is how the old dashboard got loud.
  - Responsive reveal: streak md, level+XP lg, clock xl, all-time best 2xl.
  - The clock is a compact inline one written here, NOT RwandaClock: that
    component renders a right-aligned block at text-3xl. It renders only after
    mount (the server cannot know the user's local time without a hydration
    mismatch) and reserves its width so the strip does not jump.
  - REMOVED the same four widgets from the dashboard hero, which now shows only
    greeting + date + tour link. They were page-local before; now they follow
    the user everywhere and are not drawn twice.

## Softer radii + filled dashboard hero (2026-08-29)
Levi: "still using very sharp edges structurally", hero too empty, remove the
divider.
  - --radius in app/globals.css: 0.75rem -> 1rem. One token drives the whole
    scale (sm .6x / md .8x / lg 1x / xl 1.4x / 2xl 1.8x), so rounded-lg goes
    12->16px, xl 17->22px, 2xl 22->29px across the entire app at once. This is
    the lever for any further "too sharp / too round" tuning - change the token,
    not individual components.
  - Large surfaces (Card, Panel, EmptyState, Dialog) stepped xl -> 2xl.
  - Sidebar nav items stepped 2xl -> xl: at the new token 2xl would have made
    44px-tall rows nearly pill-shaped.
  - Removed the hero's border-b divider. NOTE: the divider between the header
    stat strip and the action icons was KEPT - if Levi meant that one, it is the
    `mx-2 h-6 w-px bg-border` in AppHeader.tsx.
  - Hero now carries a term panel: "Currently in / Year 1 - Term 3 / 8 blocks
    today - 5 homework, 3 revision", plus a Paused badge when class.pausedAt is
    set. New server action getActiveTermContext() in lib/actions.ts.
    This is the FIRST visible payoff of Phase 2 and the read-only preview of
    Phase 3's lifecycle work.
    Deliberately does NOT show a completion count ("3 of 8"), which already
    appears twice on this page, nor "Next up", which LiveFocusCard already
    renders. The homework/revision split appears nowhere else.

## Sidebar v3: icon rail + flyout (2026-08-29)
Levi: "sidebar can still be done some work i dont like it at all", and flagged
ALL FOUR of: too much empty space, pill/card styling too fussy, sub-links
hidden, wrong proportions. Given two blind iterations had already missed, he was
shown three ASCII-previewed directions and chose the narrow icon rail + flyout.

  - Fixed 64px rail. Logo, a primary "+" (add task), six 40px icon buttons, and
    a level pill at the foot linking to /ranks.
  - Each icon has a flyout listing that section's pages, on hover AND on
    keyboard focus (group-focus-within), so the nesting no longer hides
    anything. Sections with no children show their own name, i.e. a tooltip.
  - The collapse toggle is GONE, and with it lib/SidebarContext.tsx and
    SidebarProvider in app/layout.tsx - the rail is the collapsed state, so the
    toggle had nothing to do and the context had no consumers left.

TWO TRAPS, both already fixed - do not reintroduce:
  1. AppShell's wrapper had `overflow-hidden`, which CLIPS the flyouts (they are
     absolutely positioned inside the rail and extend over the content). It was
     removed; <body> already has overflow-hidden and <main> owns its scroll. Any
     ancestor with overflow != visible will break the flyouts again.
  2. The flyout wrapper's gap is PADDING on the hoverable element, not a margin,
     and must not be pointer-events-none. Either would turn the gap into a dead
     zone that closes the panel as the pointer crosses into it.
  The aside also must not set overflow-hidden itself, for the same reason as 1.

Mild duplication accepted: the level pill at the foot of the rail repeats Level
from the header stat strip. It was in the preview Levi picked, and it stops the
rail bottom being empty.

## EMAXCONN incident (2026-08-29) - two bugs, one mine
Symptom: PrismaClientUnknownRequestError, "FATAL: (EMAXCONN) max client
connections reached, limit: 200", thrown from getSubjects() via RootLayout.

1. ROOT CAUSE (pre-existing): lib/prisma.ts had its globalThis singleton
   COMMENTED OUT, with the note "Bypassing global cache once to force refresh
   with new models". Next.js hot-reloads that module on every edit and each
   `new PrismaClient()` opens a pool the discarded instance never closes, so an
   editing session accumulates pools until the Supabase POOLER (not Postgres -
   pg_stat_activity showed only 21 server-side connections) hits its 200 client
   limit. The leaked dev server had grown to 1.4 GB.
   FIXED: singleton restored. If you ever need a fresh client to pick up a
   regenerated schema, RESTART THE DEV SERVER - do not re-disable the cache.

2. MY BUG: getSubjects() is not a read. It runs two deleteMany calls and can
   re-seed the Subject table. I had added it to app/layout.tsx to feed the
   quick-add form, which made every page view in the entire app perform deletes
   plus 4+ round trips - multiplying both write load and connection pressure.
   FIXED: added listSubjects() to lib/subject-actions.ts (one indexed
   findMany, no writes) and switched app/layout.tsx and app/page.tsx to it.

STILL OPEN (pre-existing, not fixed - flagged for Levi): getSubjects() mutating
on read is a design flaw. Five pages still call it: /calendar, /homeworks,
/manage, /marks, /subjects. The repair pass should be an explicit action run on
/subjects, not a side effect of every read. Worth doing before Phase 9 sync,
where deletes-on-read would propagate to every device.

## Phase 8 - upload storage backend (2026-08-29) - WRITTEN, NOT ENABLED

lib/upload.ts now picks its backend from the environment:
    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET all set
      -> Supabase Storage
    otherwise
      -> local disk, exactly as before
The disk path is byte-for-byte the old behaviour, so NOTHING changes until
those variables exist. All 15 call sites are untouched.
deleteUpload routes by the URL's SHAPE, not by the current config, so records
holding an old "/uploads/..." path still delete correctly after the switch.

@supabase/supabase-js is installed; the client is imported dynamically so it is
never loaded on the desktop build.

  LEVI - TO ACTUALLY FIX THE BUG you have to do this, I cannot:
    1. Supabase dashboard -> Storage -> New bucket, public, named "uploads".
    2. Add the three variables to the VERCEL project (not to local .env - the
       desktop build must keep writing to disk). The service role key is in
       Settings -> API and bypasses RLS, so it is server-side only, never in a
       NEXT_PUBLIC_ variable.
    3. Existing uploads on Vercel are already gone; nothing can recover those.
  Documented in .env.example.

  UNVERIFIED: the Supabase branch has never executed - there is no bucket and no
  key to test against. Upload one file after enabling it and confirm the public
  URL loads before trusting it with anything.

## The shared-Prisma-client clash - CLOSED 2026-09-08

Levi hit it for real: the web app was throwing on every request with

    Invalid `prisma.user.findUnique()` invocation:
    error: Error validating datasource `db`: the URL must start with the
    protocol `file:`.

because a desktop build had been run earlier that day.

### Root cause
lib/prisma.ts imports the generated client from ONE fixed path,
node_modules/.prisma/client-custom-v8. The web build generates a POSTGRES client
there; the desktop build generates a SQLITE one over it. Whichever ran last
wins, so `npm run build:desktop` silently left the dev environment running a
SQLite client against a Postgres DATABASE_URL. The only cure was remembering
`npm run db:postgres` by hand, and nothing enforced it.

### Two approaches were considered

A. Give the desktop build its own client output path (like the `--test` mode
   already does for the sync harness) and point packaging at it.
   REJECTED. lib/prisma.ts has a STATIC import of the shared path, so a separate
   desktop path only works if `next build` is taught to resolve that specifier
   elsewhere - a Turbopack/webpack resolve alias keyed on a build-time env var.
   That changes how the app resolves its database client at runtime, and the
   only way to prove it is a full `next build` + `pack` + launch. It buys a
   cleaner separation in exchange for putting risk into the one path that is
   hardest to verify. Not worth it.

B. Keep the shared path, restore Postgres when the desktop build finishes.
   CHOSEN, but NOT in its naive form - restoring alone would have shipped a
   BROKEN INSTALLER. desktop-app/package.json's build.extraResources copied
   ../node_modules/.prisma/client-custom-v8 into the installer, i.e. packaging
   read the same MUTABLE dev path. Restore Postgres, then `npm run pack`, and
   the desktop app would have shipped a POSTGRES client - trading a loud
   dev-time failure for a silent user-facing one. (This was not hypothetical:
   at the moment the fix was written, .next/standalone held a SQLite client
   while node_modules held the freshly restored Postgres one.)

### What actually shipped
  scripts/build-desktop.mjs   NEW. `npm run build:desktop` now runs this:
      1. generate the SQLite client at the shared path (so `next build` traces
         the right one into .next/standalone),
      2. SNAPSHOT it to node_modules/.prisma/client-sqlite-desktop,
      3. `next build`,
      4. in a `finally`: regenerate the Postgres client - even if the build
         failed, and with a loud message if the restore itself fails.
      Steps 2 and 4 assert the provider by reading it back out of the generated
      schema.prisma, so a half-written client cannot pass silently.
      Also deletes the orphaned query_engine-*.node.tmpNNNN files an EPERM'd
      generate leaves behind - there were TEN of them at 19 MB each, and they
      were being traced into the installer. ~193 MB of pure garbage.
      `--no-build` (npm run build:desktop:client) does 1, 2 and 4 only.

  desktop-app/package.json    build.extraResources now copies
      ../node_modules/.prisma/client-sqlite-desktop -> the same destination.
      DO NOT point this back at client-custom-v8: that path holds a Postgres
      client at all times except mid-desktop-build.
      CAVEAT, checked in app-builder-lib/out/fileMatcher.js copyFiles(): a
      missing extraResources `from` is only a log.warn ("file source doesn't
      exist"), NOT an error. So packing without having run build:desktop first
      would skip this entry silently. It is not fatal - .next/standalone already
      carries a traced copy of the same SQLite client, and this entry is the
      belt to that braces (Next's tracing has historically missed the .node
      engine binary) - but if you ever see that warning in a pack log, the
      installer was built from a tree that never ran build:desktop.
      (An explanatory "_comment" key was tried and removed: app-builder-lib's
      FileSet schema is additionalProperties:false and would have rejected it.)

  scripts/prisma-sqlite.mjs   comment + runtime warning only. db:sqlite is now
      documented as a primitive that must not be called directly.

### Verified 2026-09-08 (commands and what came back)
  - `npm run db:postgres` after killing the dev server. The FIRST attempt with
    the server up failed exactly as documented:
      EPERM: operation not permitted, rename '...query_engine-windows.dll.node
      .tmp36872' -> '...query_engine-windows.dll.node'
  - generated client's datasource: provider "postgresql"; activeProvider in
    index.js: "postgresql".
  - a real query through that client against production Supabase:
      user.findUnique(levi) -> {"username":"levi","currentTerm":"Term 3"}
      select version() -> PostgreSQL 17.6
      counts -> users 5, tasks 365, templates 37
  - `npm run build:desktop:client` twice: sqlite generated + snapshotted +
    verified, then Postgres restored + verified. Both invariants hold at once -
    snapshot = sqlite, shared path = postgresql.
  - the SNAPSHOT client (the exact directory the installer copies) was pointed
    at a scratch SQLite file built from all three prisma/migrations-sqlite
    migrations (30 tables) and did real work: User/Class/Term/Template/Task
    creates, a nested Class->terms->tasks read, and a groupBy. It works.
  - `npm run test:sync` - 54 tests, 0 fail. The sync harness still generates to
    its own client-sqlite-test path and is unaffected.
  - dev server restarted on :3001, ready in 5.2s. Authenticated GET /time -> 200
    in 12.4s cold / 2.2s warm, GET / -> 200 in 2.4s, HTML carries levi's real
    Africa/Kigali timezone and his real subjects. Zero Prisma errors in the log.
    (The 122s page load that prompted the last handoff note was this bug.)

### NOT verified on this machine
  - `next build` inside build-desktop.mjs was NOT run (Levi was running the
    production build himself). The build STEP is unproven; the generate,
    snapshot, verify and restore steps around it all ran for real.
  - electron-builder was NOT run. The new extraResources config was validated
    against app-builder-lib's own JSON schema (valid: true) and the source
    directory exists, but no installer was produced or launched.

## Phases 6 + 7 - desktop SQLite build and auto-updates (2026-08-29)

### Dual-provider Prisma
`provider` cannot be an env var, so the desktop schema is DERIVED at build time.
  scripts/prisma-sqlite.mjs  rewrites the datasource block of the canonical
    Postgres schema and writes prisma/schema.sqlite.prisma. GENERATED FILE -
    never edit it; edit prisma/schema.prisma and re-run.
  npm run build:desktop  THE ONLY ENTRY POINT. scripts/build-desktop.mjs:
                         sqlite generate -> snapshot -> next build -> ALWAYS
                         restore Postgres. See "The shared-Prisma-client clash".
  npm run build:desktop:client   same, without `next build` (fast check)
  npm run db:sqlite      PRIMITIVE - leaves the shared client on SQLite and
                         breaks `npm run dev`. Do not call it directly.
  npm run db:postgres    generate the Postgres client again (manual recovery)
  !! Both targets still generate to the SAME output path, so lib/prisma.ts needs
     no changes. Since 2026-09-08 you no longer have to remember db:postgres -
     build:desktop does it for you, and packaging reads a separate snapshot.

### SQLite migration history
prisma/migrations-sqlite/0_init/migration.sql, generated with migrate diff.
VERIFIED by applying it to a scratch file with node:sqlite: 29 tables, 41
indexes, a Task->Term->Class join returning correct rows, and 4 FKs on Task.
New migrations: `npm run db:sqlite:migration` prints the diff to add.

### Migrate-on-launch (this is what makes updates safe)
lib/sqlite-migrate.ts applies pending migrations itself and records them in a
`_local_migrations` table. It does NOT shell out to `prisma migrate deploy`,
which needs the CLI and a node_modules tree a packaged Electron app does not
have. Wired through instrumentation.ts, which Next runs once per server process,
and which no-ops unless DATABASE_URL starts with "file:".

### desktop-app/main.js
  - First boot now creates an EMPTY database file and lets the migrations build
    the schema. It used to copy prisma/dev.db as a template - a file from the
    original two-table SQLite era - so a fresh install got a years-old schema.
    Fresh installs and upgraded installs are now identical.
  - backupDatabase() runs BEFORE the server boots (booting is what migrates),
    keeping the 10 most recent copies in <userData>/backups. A failed migration
    is therefore always recoverable.
  - electron-updater against GitHub Releases (leviGatimu/Study-Flow). Downloads
    in the background, prompts to restart, and installs on quit if declined so
    an update is never lost. Skipped entirely in dev builds. Re-checks every 6h.
  - `npm run release` in desktop-app publishes.

### PORTABILITY BUG found by building for SQLite
`createMany({ skipDuplicates: true })` is NOT supported on SQLite, and
lib/subject-actions.ts used it twice on the seeding path. Replaced with
createSubjectsIfMissing(), which filters against existing rows and falls back to
per-row upserts if a concurrent seed trips the unique constraint. Works on both
providers. If you add another createMany, do not reach for skipDuplicates.

### NOT DONE / KNOWN GAPS
  - The Electron app has NOT been launched or packaged from this tree. main.js
    is syntax-checked and electron-updater resolves, but the runtime path
    (spawn standalone server -> instrumentation -> migrations -> window) is
    UNVERIFIED. Do a real `npm run pack` and launch before trusting it.
  - Auto-update has never been exercised against a real GitHub Release. It also
    needs the repo to be public, or a token, and unsigned Windows installers
    still trip SmartScreen.
  - `dynamic = 'force-dynamic'` was deliberately LEFT ALONE. Every page calls
    cookies() through getUserId, so Next already treats them as dynamic; the
    directive is redundant rather than costly, and removing it across 28 pages
    is churn with a staleness risk and no measurable win.

## Phase 5 COMPLETE - exam rework (2026-08-29)

### The bug, confirmed in production data
app/exams called getSubjectStats(exam.title) - the TITLE used as a subject key.
Of levi's 27 exams, only 13 titles exactly matched a subject name. The other 14
("Networking MID-TERM EXAM", "Math MIDTERM", "Php MID-TERM EXAM", ...) silently
returned zero preparation stats while the page looked like it was working.

### Approach: extend ExamEvent, do NOT add a parallel Exam table
22 call sites already use ExamEvent. New columns: subjectId (FK -> Subject),
startTime, endTime, room, kind (QUIZ|TEST|MIDTERM|FINAL|EXAM), weight, score,
maxScore, notes. Task gains examId.
Migration exam_assessment_fields_and_revision_link - additive, guarded, applied
and verified. Both FKs are ON DELETE SET NULL, not Cascade: deleting an exam
must not delete the revision you already did for it.

  SCHEMA GOTCHA, cost a round trip: `prisma format` auto-generates a back
  relation for a Task[] it finds on ExamEvent. It invented `examEventId` before
  my own `examId` edit landed, so the schema said examEventId while the
  migration had created examId. Always re-read the model after `prisma format`
  and confirm the column names match the SQL that was applied.

### Backfill (prisma/backfill-exams.ts, --dry supported)
Matches title -> subject by: exact, exact-after-stripping-exam-words, then a
distinctive keyword appearing in exactly one subject. 25 of 27 linked, and kind
inferred (10 MIDTERM, 1 QUIZ, 16 EXAM). Deliberately left 2 unmatched rather
than guess: "GUI" (an acronym no subject name contains) and "Javascriptt
MIDTERM EXAM" (a typo). The planner UI lets Levi assign those by hand.

### lib/exam-actions.ts
  planRevision(examId, {sessions, daysBefore, startTime, durationMinutes})
    Plans BACKWARDS from the exam date. Session i lands at
    availableDays * (i/sessions)^1.6, so blocks bunch towards the exam:
    6 sessions over 14 days -> 14, 13, 10, 8, 5, 1 days before. Verified.
    Pre-loads that day's existing tasks and walks the start time forward until
    the slot is free, so revision never lands on top of a scheduled block.
    Re-running KEEPS completed blocks and replaces only undone ones.
    The blocks are ordinary REVISION tasks - they appear on the dashboard and
    count towards the streak - merely tagged with examId for progress reporting.
  recordExamResult / setExamSubject / updateExamDetails / clearRevisionPlan

### UI
components/ExamPlanner.tsx, mounted at the top of /exams/[examId]: link a
subject when missing, plan/re-plan/clear revision with live progress, record the
score. getEvents and getEventById now include the subject relation, and
/exams + /exams/[examId] use exam.subject?.name ?? exam.title everywhere the
subject was meant - including AddMasteryForm and MasteryList, which had the same
bug.

## PERFORMANCE: pages went from ~10s to ~2s (2026-08-29)
Levi: "im so damn tired of how long it takes to load a page".

### THE BIG ONE: the connection pooler was costing 5x
Measured, same query, same machine, same moment:
    POOLED  aws-1-eu-central-1.pooler.supabase.com:6543 (transaction mode)  828ms
    DIRECT  aws-1-eu-central-1.pooler.supabase.com:5432 (session mode)      165ms
165ms is the honest Kigali->Frankfurt round trip. Transaction mode was adding
~660ms to EVERY query. 10 sequential queries: 8492ms -> 1664ms.

.env DATABASE_URL now uses :5432, drops pgbouncer=true (only needed for
transaction mode, and it disables prepared statements), and adds
connection_limit=5&pool_timeout=20 so a hot-reload storm cannot exhaust the
pooler the way it did earlier today. DIRECT_URL is unchanged.

  !! VERCEL: the deployed app still has the OLD 6543 URL in its env vars, so
     production is still paying the 828ms. Update DATABASE_URL there to match.
     Transaction mode is normally the right choice for serverless because it
     tolerates many short-lived connections - with a handful of users and
     connection_limit=5 session mode is fine, but if Vercel ever starts
     throwing connection errors under load, that trade-off is why.

### Then: stop doing the same work repeatedly in one render
React cache() (per-request memoisation) on:
  getUserId       lib/auth.ts   - it verifies the JWT *and* does a
                                  user.findUnique, and is called by the layout,
                                  the page, and every server action they fan out
                                  to. It was a dozen identical round trips.
  getScheduleState lib/term.ts  - called by syncStreak, ensureTasksGenerated,
                                  checkAndMarkMissedTasks and the page itself.
  getUserTimezone lib/actions.ts - called by most actions.
  syncStreakFor   lib/actions.ts - syncStreak split into a thin exported action
                                  over a memoised impl. Layout AND dashboard
                                  both call it; it also WRITES, so once per
                                  request is more correct, not just faster.
  getTemplatesForUser - the timetable is re-read by each generation pass.

### Measured result (dev server, warm, real authenticated requests)
    dashboard  9.8s -> 1.9s      calendar 9.5s -> 2.3s
    history    6.3s -> 1.6s      subjects 6.6s -> 2.1s
    year       7.9s -> 1.2s      timetable      -> 1.4s
  A dashboard load is now 18 queries. Production build measured ~3s before the
  memoisation work; dev is slower than prod, so the real figures are better.

### Instrumentation left in place
lib/prisma.ts logs every query when PRISMA_LOG=1. Off by default.
    PRISMA_LOG=1 npx next dev ...   then count "prisma:query" in the log.
NOTE: `next start` does NOT work with output:"standalone" (it warns and its
stdout does not carry the prisma log). Measure with dev, or run
`node .next/standalone/server.js`.

### What is left, and it is the same answer as Phase 6
18 queries x 165ms is the floor while the database is in Frankfurt. The fix is
the local SQLite desktop build - sub-millisecond queries - plus killing the
blanket `dynamic = 'force-dynamic'` that every page sets.

## Phase 4 COMPLETE - term + year summaries (2026-08-29)
Built as a VIEW over lib/grading.ts, not a second engine, exactly as planned.

  lib/summary.ts
    buildTermSummary(userId, termId) / buildClassSummary(userId, classId), both
    calling one shared summarise(). A term and a year differ only in which
    tasks they are handed.
    KEY DETAIL: computeWeeklyPerformance is calibrated for ONE WEEK, so the
    summary feeds it PER-WEEK AVERAGES (minutes/weeks, activeDays/weeks). Handing
    it a 12-week lifetime total would score every term S tier. Do not "simplify"
    that division away.
    readStoredSummary() parses the snapshot, tolerating bad JSON.

  Snapshot-on-completion, live-until-then:
    endActiveTerm     -> writes Term.summary before flipping status
    completeActiveClass -> writes Class.summary AND a summary for every term
                        still open, since those are closed with the year
    getTermSummary / getClassSummary return the snapshot if present, else
    compute live. A finished term's grade must not drift because a task inside
    it was edited later.

  components/PeriodSummary.tsx - grade tile (GRADE_THEMES), the engine's own
  headline/detail, four facts, per-subject bars, and up to 3 improvements.
  Surfaced on /year: a "Report" toggle on every term row, and the year report at
  the top of each archived year.

  VERIFIED against production data: levi's Year 1 => grade C (57), 75/160
  blocks, 124h of 275h planned, 35 active days over 104, streak 39, subjects
  ranked by hours. Note 160 not 351 tasks - the rest are isDeleted, correctly
  excluded.

## REVERTED: Today restyle + all font changes (2026-08-29)
Levi rejected the whole Today restyle and every font attempt, in escalating
terms, ending with "RETURN IT TO HOW IT WAS BEFORE... KEEP IT SAME UI BUT
POLISH". Reverted via git (nothing was committed, so HEAD held the original).

RESTORED TO ORIGINAL, untouched:
  components/TaskList.tsx      (the multi-badge card rows are back)
  components/MemoryGuard.tsx
  components/DailyQuote.tsx
  components/LiveFocusCard.tsx (full-bleed accent cards, font-black, glow orbs)
  components/ProgressWidget.tsx (was deleted; restored)
  app/page.tsx layout          (all 8 panels, 12-col grid, original styling)

FONTS - all three attempts reverted. Back to --font-sans "Nunito" /
--font-heading "Outfit" exactly as before.
  KNOWN, STILL TRUE: neither font is loaded anywhere, so the app renders in the
  system fallback (Segoe UI on Windows). Levi has approved of the app's look
  in that state, so DO NOT "fix" this unprompted. If he ever asks for a font
  change again, the options are (a) actually load Nunito+Outfit, which is what
  the code has always intended, or (b) a different face - but load it with
  next/font, NOT a CDN, because the desktop build runs offline.
  Attempts that were rejected: Clash Display + Satoshi, Inter,
  Plus Jakarta Sans. A display face (Clash) was the worst of these - never use
  one for app chrome.

KEPT (Levi praised these; they are not part of the revert):
  - The icon-rail Sidebar and the app header with its stat strip
  - --radius 1rem
  - The five ui/ primitives (now used only by /year and TermStatusBanner)

KEPT ON THE DASHBOARD for function, not style:
  - listSubjects() instead of getSubjects() - the latter runs deleteMany on
    every call and this page is the landing page.
  - TermStatusBanner instead of StreakBreakBanner - the old banner only knew
    "school break" and its Resume cannot start a term, so between-terms and
    end-of-year states were unreachable from here.
  - The hero no longer repeats streak / all-time best / rank / clock / theme
    toggle, because the app header now shows all of those. Two ThemeToggles
    were being rendered on this page alone.

## Self-guided slider on the status card (2026-08-29)
Levi: "I LOVE THE FONT BUT I HATE HOW IT LOOKS ... PUT THIS SLIDER FOR SELF
GUIDED ON THE CURRENT STATUS CARD like polish it".
"Current status card" = the HUD strip at the top of LiveFocusCard.
"Self-guided" = its `break` hudState, shown when no task and no school lesson
is running; it used to say "Self-Guided Mode" and offer NO action at all.

  NEW components/SelfGuidedStarter.tsx - a session-length slider (10-120min,
  5min steps, 25/45/60/90 presets in the non-compact variant) plus Start. It
  builds the same synthetic "free" task that /focus/free renders, calls
  startFocus(task, minutes) from FocusContext, then routes to /focus/free - so
  the session is already running on arrival. No changes were needed to the
  focus flow itself.
  Mounted compact in the HUD strip, visible from sm up.

  Polish to the strip only (scope kept deliberately tight after the revert):
  - "Dashboard HUD" 9px uppercase tracking-[0.2em] label -> "Current status"
    at readable weight; status text 12px -> 14px.
  - The status dot pinged forever in every state. It now only pulses when
    something is genuinely live (studying / in a school lesson) - a dot that
    always pings means nothing.
  - Strip surface: rounded-[20px] + backdrop-blur -> rounded-2xl solid card.
  - "Synced (Active)" / "Unsynced (Off-School)" -> "Synced" / "Off-school".
  NOTHING ELSE on the dashboard was touched.

## HUD strip merged into the status card (2026-08-29)
Levi: "get rid of this card [the HUD strip] and merge the timetable sync slider
into the current status card, put the schedule pause near Currently in Year 1,
then polish the rest."

Disambiguation, since the pasted screenshot was not visible to the agent: "the
current status card" is the big full-bleed card that literally renders
"CURRENT STATUS: ...", NOT the HUD strip. The giveaway is that the sync switch
already lived on the strip, so "move sync into the current status card" is only
meaningful if the target is the other card.

  - The HUD strip above the card is GONE. It repeated, in 10px type, the status
    the card below was already announcing at 5xl.
  - components/LiveFocusCard.tsx now builds a `cardControls` ELEMENT (not an
    inner component - the parent re-renders every second from its timers, and an
    inner component would remount the Switch on every tick) and renders it
    inside all five card variants before </Card>.
    Controls: timetable sync on every state, plus SelfGuidedStarter when
    hudState === 'break'.
    All five cards are saturated colour with white text (primary/amber,
    blue-600, orange-500, indigo-500, emerald-500), so the controls are styled
    white-on-colour. Slider track/range and switch thumb are internal to the
    radix primitives and are reached via [&_[data-slot=...]] selectors.
  - hudLabel was deleted; it only fed the strip.
  - PauseScheduleButton moved next to the "Year 1 - Term 3" line in the hero
    panel and is now an outline Button with a Pause/Play icon rather than a
    tiny text link.
  - Light polish on the dashboard only: removed the three decorative blur-3xl
    glow orbs, removed hover:-translate-y-0.5 from the panels (the column
    jittered as the pointer crossed it), section rhythm space-y-12 -> space-y-8.
    TaskList, the panels' contents and the big cards' typography are untouched.

GOTCHA worth remembering: str.replace on "        </Card>" also matches inside
"          </Card>", which double-inserted on the first attempt. Use a
line-anchored regex (^[ 	]*</Card>$ with re.M) when inserting before JSX
closing tags.

## Dashboard polish pass (2026-08-29)
Scope: app/page.tsx plus the four components that only appear on it. NOTHING
structural - same panels, same order, same content.

  ONE PANEL TREATMENT. The page mixed rounded-[32px] / [28px] / rounded-3xl with
  32px padding. All dashboard panels are now rounded-2xl p-6, incl.
  ProgressWidget, MemoryGuard, ExamCountdown and DailyQuote.
  TYPE SCALE. Greeting 5xl -> 4xl (it was the loudest thing on screen), section
  heading 3xl -> 2xl, panel headings xl -> lg, exam countdown 6xl -> 5xl. The
  date line lost its Target icon and went xl -> base; a date is not a headline.
  MICRO-LABELS. "NEXT EXAM:" / "FOLLOWED BY" / "DONE" in 9-10px black uppercase
  tracking-[0.2em] became sentence case at readable weight.
  MOTION. Removed the remaining decorative blur-3xl orbs (MemoryGuard,
  ExamCountdown), the hover lift on ProgressWidget and DailyQuote, and the
  ring's group-hover scale. transition-all -> transition-shadow so only the
  shadow responds.
  RHYTHM. Grid gutter 32/40px -> 24px, column spacing 32 -> 24, section
  spacing 48 -> 32.
  Tomorrow's Plan was iconed with a Trophy; now CalendarDays.
  Task row hover was hover:bg-white / dark:hover:bg-black (pure white or pure
  black); now hover:bg-muted.

Deliberately untouched: TaskList rows, the five big LiveFocusCard variants'
internals, all copy, and the fonts.

LESSON: this session burned four rounds on UI Levi could not see, because
Chrome cannot reach the dev server from the agent environment. For any further
visual work, either get a screenshot from him first or change ONE thing at a
time and ask - do not restyle several components plus the typeface in one go.

STILL NOT VISUALLY VERIFIED - Chrome is unavailable in this environment, so
every UI change so far is compile-verified only.

## Phase 3 - lifecycle (2026-08-29)
New files:
  lib/term.ts          getScheduleState(userId) -> the single source of truth
                       for "is the schedule running". Reasons: RUNNING, PAUSED,
                       BETWEEN_TERMS, CLASS_COMPLETE, NO_CLASS. Plain function,
                       not a server action, so task generation and streak sync
                       can call it without a round trip.
                       Also ensureDefaultClass(userId), idempotent.
  lib/term-actions.ts  pause/resume, endActiveTerm, extendActiveTerm,
                       startNextTerm, addUpcomingTerm, updateTerm,
                       renameActiveClass, completeActiveClass, startNewClass.
  components/TermStatusBanner.tsx  the prompts + PauseScheduleButton.

Changed:
  ensureTasksGenerated   returns early unless schedule.isRunning; stamps termId
                         on every task it creates.
  checkAndMarkMissedTasks same gate - this is the bug from the original audit:
                         a break used to generate tasks and then mark them all
                         missed.
  syncStreak             now backed by Class.currentStreak/longestStreak/
                         lastActiveDate. Return SHAPE is unchanged, which is why
                         no consuming page needed touching. "All-time best" is
                         max(longestStreak) across all classes plus the legacy
                         UserProgress value, so pre-Class history survives.
  registerUser           calls ensureDefaultClass, else a new account has a
                         silently dead schedule under the new gate.
  resumeStreak           clears BOTH Class.pausedAt and the legacy schoolEndDate.
  getActiveTermContext   DELETED - it was a near-duplicate of getScheduleState.

### INCIDENT: the Phase 2 backfill dropped the school-break freeze
The old syncStreak froze the streak when UserProgress.schoolEndDate had passed.
levi was in exactly that state: streak 39, lastActiveDate 2026-06-25,
schoolEndDate 2026-06-26. The backfill copied the streak numbers onto Class but
NOT the freeze, so the new Class-backed syncStreak saw a running schedule,
measured a 64-day gap, and reset his 39-day streak to 1.
Caught by a read-only state dump, not by any test.
Repaired: migration repair_class_streak_freeze_from_school_end_date restored
currentStreak/longestStreak/lastActiveDate from UserProgress (which still held
the untouched originals) and set Class.pausedAt = schoolEndDate. levi is back to
39/39, paused - which is correct, he is on a break, and the banner now offers
Resume.
backfill-classes.ts now carries schoolEndDate -> pausedAt, and its link pass
runs for existing classes too, so late-arriving unscoped rows get adopted
(2 such tasks were found and linked).
LESSON: when moving a field to a new home, move the flags that MODIFY it, not
just the value. UserProgress.schoolEndDate is now legacy - Class.pausedAt is
authoritative - but do not delete it until the /calendar school-end marker that
still reads it is migrated.

### Those three loose ends are now DONE (2026-08-29)
  - NEW PAGE /year (app/year/page.tsx + YearClient.tsx), linked from the nav
    under Plan > "Year & Terms". It covers: renaming the year, pause/resume,
    per-term editing (name + start/end dates), adding an upcoming term, starting
    the next term, ending the running one, and finishing the year.
  - ARCHIVE: finished years list on the same page, each expanding to a read-only
    snapshot via getClassArchive(classId) - tasks completed, hours studied, best
    streak, exams, most-studied subjects and the term list. Deliberately a
    read-only RECORD, not a global "switch the whole app into that year" mode:
    that would mean threading a viewing-context through every query in the app.
    Revisit if Levi actually wants to browse an old year page-by-page.
  - /calendar now takes its end-of-school marker from the active term's endDate.
    CalendarGrid's prop was renamed schoolEndDate -> termEndDate. Nothing reads
    UserProgress.schoolEndDate any more; the column can be dropped in a future
    migration once we are confident.

## Today page restyle (2026-08-29)
Rebuilt app/page.tsx on the primitives. 8 panels -> 4.
  - MERGED: "Tomorrow's Plan", "Exam Timeline" and ExamCountdown were three
    panels answering one question. They are now a single "Up next" panel.
  - REMOVED from this page: "Yesterday's Review" (it is history, and /history
    exists) and the duplicate exam countdown.
  - ProgressWidget rewritten: no hover lift/scale/recolour, no uppercase
    micro-label. The ring's stroke-dashoffset still animates, because that
    reports state.
  - Layout: max-w-1400, 6-unit rhythm, 2:1 grid. Sections use the Section
    primitive so headings match the rest of the app.
  - EmptyState shown when the day has no blocks, pointing at /manage.
  - LiveFocusCard, TaskList, DailyQuote and MemoryGuard were NOT restyled - they
    are large components with their own internal styling (LiveFocusCard is 573
    lines and heavily wired to FocusContext). They are the next candidates if
    the page still feels inconsistent.

## The dev server IS reachable - it is IPv6 (2026-09-06)

Previous sessions concluded "Chrome cannot reach the local dev server" and gave
up on visual verification, burning four rounds on UI nobody could see. The
cause looks like the address, not the network:

    curl http://127.0.0.1:3000/login   ->  no response
    curl http://localhost:3000/login   ->  200
    curl http://[::1]:3000/login       ->  200

`next dev` binds `::` (IPv6 any) and Windows does not map 127.0.0.1 onto it
here, so from the shell USE localhost OR [::1], NOT 127.0.0.1.

WORKAROUND THAT ACTUALLY WORKS (2026-09-08): publish the component's markup
as an Artifact (Tailwind play CDN + the real tokens from app/globals.css +
Outfit/Nunito from Google Fonts) and screenshot THAT. It is an https URL, so
Chrome loads it fine. This is how the break card's wash-out bug was finally
found after two rounds of shipping blind. file:// is refused by the browser
tool, so a local HTML file will not do.

CORRECTION (2026-09-08): the IPv6 note unblocks curl, NOT Chrome. Retested every form -
Chrome lands on a network error page for http://localhost:3000,
http://127.0.0.1:3000 and http://[::1]:3000 alike, while curl gets 307/200 from
the same URLs in the same moment. It is not the address. Ruled out the same
day: no Windows proxy (ProxyEnable 0, no AutoConfigURL), no Chrome enterprise
policy (neither Policies\Google\Chrome key exists), and Chrome is a normal
desktop install at C:\Program Files (not a Store/AppContainer build, which
would explain it via loopback isolation). The extension itself is fine -
example.com screenshots normally in the same tab.

So: DO NOT burn rounds re-testing loopback addresses. Visual verification needs
Levi to open the page himself, or to fix Chrome's loopback access. And note
that `npm run dev` points at PRODUCTION Supabase, so do not create test
accounts to get past the login screen.

## A trap I walked into: build:desktop breaks a running dev server
## FIXED 2026-09-08 - see "The shared-Prisma-client clash" above

`npm run build:desktop` regenerates the Prisma client for SQLite. On Windows it
then dies with EPERM because the running dev server holds the query-engine DLL
- but IT HAS ALREADY REWRITTEN THE JAVASCRIPT CLIENT BY THEN. The failure is
not atomic. Every query in the running app starts failing with:

    Error validating datasource `db`: the URL must start with the protocol `file:`

Recovery is `npm run db:postgres` (it EPERMs on the same DLL and that is
harmless - the engine binary is per-platform, not per-provider) followed by a
DEV SERVER RESTART, because Node has the old client module cached in memory.

So: stop the dev server BEFORE building the desktop target. The existing
warning in this file said db:postgres was needed "afterwards"; the real point
is that the two cannot overlap at all.

STILL TRUE, and still the reason to stop the dev server first. What CHANGED on
2026-09-08 is that a build which finishes no longer leaves the client on SQLite:
build:desktop now restores Postgres in a `finally`, and verifies the provider it
restored. The EPERM half-write is still possible if you build with the dev
server up - build:desktop now fails fast and tells you to stop it.

## Loose-end pass (2026-09-06) - seven real bugs, six found by RUNNING things

The lesson of this session: every one of these was in code that had been read,
reviewed and described as done. They were found by executing the tooling, not
by reading it. `prisma migrate status`, a scratch SQLite file, and one count()
against production each found a bug that inspection had missed.

### Migration history was broken in four ways
  1. prisma/migrations/migration_lock.toml still said provider="sqlite", left
     over from the SQLite era. EVERY `prisma migrate` command against Postgres
     failed with P3019. The previous session's claim that "migrate deploy is
     safe again" was never tested.
  2. schema.prisma declared 2 indexes; the database had 20. The Phase 2 and
     Phase 5 migrations created 18 indexes on classId/termId/subjectId/examId
     that were never written back into the schema, so the next `db push` or
     `migrate dev` would have silently dropped every one of them - on exactly
     the columns every scoped query filters by.
  3. The Phase 5 exam change existed in the database but as NO migration file,
     so replaying prisma/migrations on a fresh database produced an app with no
     exam columns. Reconstructed as a guarded additive migration + down.sql and
     marked applied on production (the columns were already there).
  4. prisma/migrations-sqlite had no migration_lock.toml at all, and was
     missing the same 18 indexes.
  Both histories now diff clean. `prisma migrate status` says "up to date".

### migrate-on-launch applied NOTHING (the worst one)
lib/sqlite-migrate.ts split each migration on ";" and then dropped any chunk
starting with "--". Prisma prefixes every statement with its own
"-- CreateTable" comment, so ALL 42 statements were discarded - and the
migration was then recorded as applied. A fresh desktop install would have got
an empty database that could never repair itself, and this is the code path
Phase 7's auto-update depends on.
Now strips comment lines from inside each chunk instead. VERIFIED by applying
both migrations to a scratch file: 60 statements, 29 tables, 31 indexes, and a
Task -> ExamEvent -> Subject join returning a score.

### Search returned nothing for lowercase queries
`contains` is case-SENSITIVE on Postgres. Measured against production data:
"physics" 0 results, "Physics" 42. "javascript" 0, "Javascript" 13. The same
query on the desktop build returns everything, because SQLite's LIKE folds
case - same app, same data, different answers.
containsInsensitive() in lib/prisma.ts switches on the provider. Confirmed
empirically that SQLite REJECTS mode:'insensitive' outright, which is why it
cannot simply always be passed. Search also gained subjects, exams, resources,
subject notes and marks, and now excludes soft-deleted rows.

### Desktop uploads would have been destroyed by every auto-update
Uploads went to process.cwd()/public/uploads, which on the packaged app is
INSIDE the installation directory. electron-updater's NSIS installer removes
that directory before writing the new version. Phase 7 turned auto-updates on,
so this was armed but had not yet fired.
Uploads now honour UPLOADS_DIR, which main.js points at <userData>/uploads -
beside the database, which already survives updates and is backed up.
That put them outside public/, so app/uploads/[...path]/route.ts serves them.

### Phase 8 changed shape: the bucket should be PRIVATE
saveUpload used to return an absolute PUBLIC Supabase URL, which would have
made every report card and proof of work readable by anyone with the link.
Both backends now return "/uploads/<name>" and are served by that same
authenticated route, so the bucket stays private and the stored value does not
change meaning when the backend is switched. deleteUpload no longer routes by
URL shape (both shapes are identical now) - it removes from the bucket and then
also tries the disk, covering records written before storage was switched on.

### The onboarding tour had rotted worse than recorded
Five of eight anchored steps pointed at selectors that no longer existed, not
three: `streak` and `command-palette` had gone too. A missing anchor degrades
to a centred card, which is exactly why nobody noticed.
Also fixed: an element hidden at the current breakpoint still answers
querySelector but measures 0x0 at 0,0, so a step anchored to the rail or the
stat strip would have spotlighted the top-left corner on a phone.
The rail now DERIVES its anchor from the section name, so renaming a section
cannot orphan a step again, and a missing anchor warns in development.

### ReminderManager: was dead code, now shipped
Mounting it as it stood would have popped an "Enable Reminders?" modal on first
paint and, because a dismissed prompt leaves permission at "default", on every
page load after that - and called getTodayTasks() every 30 seconds, 120
database round trips an hour per tab against a database 165ms away.
Now a bell in the header: permission requested only from a click, choice
persisted, task list fetched on enable and refreshed every ten minutes, the
30-second tick reading only memory. Honours the user's timezone, not the
browser's.

### getSubjects() no longer deletes
The destructive pass is now repairSubjects(), a "Tidy up" button on /subjects.
getSubjects() still seeds an empty table but deletes nothing. This was the
open item flagged for Levi last session, and it mattered before sync: a
delete-on-read propagates to every device.

## UX AUDIT (2026-09-06) - what an agent found, worst first

Fixed the same day:
- [x] Deleting a timetable block had NO confirmation and cascade-deleted every
      task it ever generated, completed work and proof-of-work included. One
      click. It was the most destructive control in the app and the least
      protected. Now confirms with real counts, and deleteTemplate detaches
      finished tasks first so history survives either way.

Still open, in severity order:
- [ ] NO ERROR BOUNDARY ANYWHERE. 35 routes have loading.tsx, none has
      error.tsx. Any unhandled server error drops the user on Next's crash
      page with no way back - and this app has genuinely had pool exhaustion
      and Frankfurt round-trip failures. Add app/error.tsx first.
- [ ] The subject delete checkbox under-discloses: it names homeworks,
      resources, goals, templates and grades, but lib/subject-actions.ts also
      deletes every Task for that subject (completed included), TutorModule
      and StudioNote. Show live counts.
- [ ] A new user finishes onboarding with nothing to do. registerUser creates
      an empty class but no templates, the 10-step tour never mentions
      Plan > Weekly Timetable, and TaskList says "No scheduled tasks for
      today. Rest up or get ahead!" - identical wording to a caught-up day, so
      "you have set nothing up" is indistinguishable from "you are done".
- [ ] Raw exception text reaches unauthenticated users on login and register
      (lib/actions.ts:59, :95), and in Settings export/import.
- [ ] TWO different deleteSubject implementations with different blast radius,
      wired to different buttons (lib/actions.ts:1105 vs
      lib/subject-actions.ts:342). Consolidate.
- [ ] The month calendar is unusable below ~500px: fixed grid-cols-7,
      min-h-[140px] cells, and a parent overflow-hidden that clips instead of
      scrolling. Needs an agenda view on mobile.
- [ ] The mobile nav drawer does not close when you tap a destination.
- [ ] ~87 form inputs have visible labels with no htmlFor/id pairing, so a
      screen reader announces no name for them.
- [ ] The dashboard's main task rows are div+onClick with no keyboard access
      (TaskList.tsx:113). Same on calendar day cells and subject cards.
- [ ] 15+ icon-only destructive buttons have no aria-label.
- [ ] "School Portal" is a permanent nav item that dead-ends for every
      non-admin account. Hide it unless isAdmin.
- [ ] Nav confusion: "This Week" (/timetable, a read view) sits next to
      "Weekly Timetable" (/manage, the editor) - the one named "timetable"
      opens the editor.
- [ ] Progress has 8 children; Insights, Summaries and Daily Summary all
      answer "how am I doing" at uncommunicated granularity.

Already good, do not re-flag: term/class lifecycle never hard-deletes; the
main forms all use isPending correctly so there is no double-submit problem;
empty states on /manage, /resources, /exams, /summaries, /goals, /homeworks,
/marks and /insights are genuinely good; all images have alt text.

## THE THREE NEW FEATURES (asked for 2026-09-06, designed, not built)

### Offline desktop login
Correction to the earlier assumption: the desktop app is ALREADY fully offline
and always has been. There is no online step to preserve - each PC has its own
local SQLite User table, disjoint from the web app's. registerUser/loginUser
run against the local file, bcrypt on-device, no network.
So "offline login" is really "make the desktop account the SAME account as the
web one". Simplest design that does not weaken the web app: verify once against
the server on first login, then provision a local User row with a locally
computed bcrypt hash; every later login is a local bcrypt.compare. Trade-off:
a crackable hash sits on that PC - but that is already true of every
desktop-registered account today, so it extends the existing local-trust
assumption rather than widening it.

### Resources as a real folder system
THE REAL FOLDER IS C:\Users\user\Downloads\School, and its shape is deeper than
described: Year -> Term -> Subject -> Category
  School\Year 1\Term 3\Physics\{Assignments, Exam, Notes, Practice, revision}
That maps almost exactly onto Class -> Term -> Subject, which the schema
already has. Key off those FKs rather than inventing a parallel tree.
  - Schema: a self-referencing Folder model (parentId), NOT a materialised path
    string - a path string cannot represent an empty folder, and several real
    ones are empty (Year 2\Term 1, Year 2\Term 3).
  - saveUpload is flat by design and resolveUploadPath deliberately basenames
    away directories; both need real multi-segment handling, and the uploads
    route must stop taking only the last path segment.
  - Naming drift is real and must be tolerated, not assumed away:
    Entreprenuership/Entrepreneurship, Embedded system/Embedded systems,
    PHP/Php, Math/Mathematics.
  - REFUSED BY DESIGN, do not implement: automatically deleting, renaming or
    moving a real file as a side effect of a DB cascade or a sync, and any
    live filesystem watcher over the user's folder. Drift is surfaced as a
    reviewable list from a scan-on-open, never auto-repaired.
  - Desktop-only: the web build has no disk. Gate the whole thing on
    window.electron.

### Document viewer
pdfjs-dist and mammoth are ALREADY dependencies, and the pdf.js worker already
loads from a local asset (verified in .next/static), so it is offline-safe.
Build one DocumentViewer dispatching by extension: pdfjs canvas for PDF, img
for images, pre/react-markdown for txt/md, mammoth for docx, and an honest
"open externally" for legacy .doc, which has no offline renderer. Do NOT add
react-pdf - it wraps the pdfjs-dist already present.
Fix the Range bug FIRST; the viewer depends on it for large files.

## UI CONSISTENCY - the plan, and a correction

IMPORTANT correction to this file: the "Today page restyle" entry describes a
dashboard rebuilt on the five primitives. THAT WAS REVERTED. app/page.tsx on
disk is the original 8-panel hand-styled dashboard, and it is the reference.
Also wrong here: TermStatusBanner does NOT use the primitives. Only
app/year/YearClient.tsx does, and Stat is used nowhere at all.

The app chrome (sidebar, header, palette) is already clean. Every
inconsistency is inside page bodies. Counts: 221 arbitrary rounded-[Npx],
932 font-black, 443 tiny micro-labels across 59 files, 64 hover lift/scale,
20+ decorative glow orbs, and FOUR competing page-header systems.

Batch order, smallest risk first - do NOT sweep these all at once, that is
exactly the big-bang that was rejected before:
  0. [DONE 2026-09-06] 6 shared DialogContent radius overrides removed so the
     Dialog primitive's own rounded-2xl applies: ManageForm, EditTemplateForm,
     QuickAddForm, AddResourceForm, ConfirmModal, ValidationModal.
     The audit listed LiveFocusBanner as a 7th, but its rounded-[32px] is on a
     Card, not a DialogContent - left alone, and it sits beside the protected
     LiveFocusCard.
     NINE MORE DialogContent overrides exist and belong to batch 1:
     DailySummaryCard:221, OverallSummaryButton:114, SummaryCard:214,
     AIChatInterface:657, HomeworkList:46, MarksClient:457 and :928,
     DialogTriggerButton:17, and TaskList:306 - TaskList IS PROTECTED, do not
     touch it without asking.
  1. Arbitrary radius -> tokens, in 4-5 PRs grouped by route family.
  2. Motion cleanup (the 2026-08-29 sweep playbook, which worked).
  3. Glow-orb removal, per design family.
  4. Micro-labels -> sentence case. Changes visible copy - show one page first.
  5. font-black -> font-bold on non-numeric text. The biggest visual lever.
  6. LAST, one page at a time, with a screenshot each: reconcile the four
     header systems. This is the actual decision and cannot be mechanical.
Protected throughout: TaskList, LiveFocusCard, DailyQuote, MemoryGuard,
FocusSessionUI's motion, and every font property.

## Working Notes

(Phase 0 is done; the rules below are the ones to keep enforcing as pages move
onto the primitives.)

- Radius: use the scale already defined in app/globals.css @theme. Ban arbitrary
  rounded-[28px]/[32px]/[40px] literals (they are all over app/page.tsx).
- Type: headings drop font-black -> 600. Delete the
  text-[10px] uppercase tracking-[0.2em] micro-label pattern everywhere.
- Color: neutral surfaces + one accent; color reserved for status only. Remove
  the per-widget palettes (orange streak box, blue trophy box, primary panels).
- Motion: keep only state feedback (checkbox, progress fill, focus timer,
  modals). Remove the Sidebar width/layout animation, per-page
  "animate-in fade-in", hover scale/-translate-y on cards, the pulsing flame,
  blur glow orbs, staggered zoom-in delays. One duration, one easing.
- Build 5 primitives in components/ui/: PageHeader, Section, Panel, Stat,
  EmptyState. THIS is the real fix - there are none today, which is why every
  page hand-rolled its own header and nothing matches.

Dashboard target (Phase 5): 8 panels -> 3. Header = greeting + date + term chip
("Year 2 - Term 2 - Week 4") + one status strip. Main = today's list.
Side = progress + merged "next up". Yesterday's Review moves to History. Quote
becomes one line, not a card. Drop the 2 duplicate ThemeToggles on the dashboard
(app/page.tsx has xl:hidden and xl:flex copies; the Sidebar already has one).

Nav target: Today - Plan - Subjects - Progress - Study - Settings,
with the year/term switcher pinned above them.

Scoping map for Phase 1:
- Term-scoped:  Task, ExamEvent, Homework, DailySummary, WeeklySummary, MarkedDay
- Class-scoped: ScheduleTemplate, Subject, SubjectGoal, ReportCard, Resource,
                MasteryItem, TutorModule, StudioNote, AiNote, Project,
                + the streak fields
- User-global:  UserProgress (XP, level, keys, timezone), StickyNote,
                ChatSession, Song, Playlist

## Risks
- DB is Postgres (not SQLite) and deploys to Vercel: the migration must be
  additive and reversible, and the backfill must be safe to run twice.
- Levi's existing data must not be moved, edited or deleted. The Year 1 / Term 1
  container is created AROUND it, seeded from the current User.currentTerm.
- Windows: prisma generate throws EPERM while the dev server is running.

## Recently Completed
- Automatic sync on every change, with notifications (2026-09-09)
- Phase 9 stages 2-5: the sync engine, desktop and web (2026-09-09)
- Account audit: logout-on-slow-DB, John's seeded account, hardcoded prompts (2026-09-09)
- Phase 9 Stage 1: every delete leaves a tombstone (2026-09-09)
- School timetable is per-user, uploaded from a photo; /school -> /school-timetable (2026-09-09)
- Sidebar: 64px icon rail that opens to 240px on hover, on keyboard focus, or
  permanently once pinned (2026-09-08). Unpinned the open panel is absolutely
  positioned OVER the page and the aside keeps reserving 64px - widening in
  flow would shove the page sideways every time the pointer crossed the rail;
  pinned, the aside reserves the full 240px so nothing overlaps. The hover
  flyouts are gone: sub-pages now list inline under whichever section the
  pointer or focus is on, defaulting to the section you are in, which keeps the
  flyout's one virtue (any sub-page reachable without navigating into its
  section) without its dead zones. Pin state lives in localStorage under
  `sidebarPinned`, read through useSyncExternalStore - the eslint config errors
  on setState-in-effect, so the LiveFocusCard pattern would not have passed.
  NOT yet verified in a browser; see Current Task.
- Status card: all five states now share one shell (`CARD_SHELL`) and one
  content row (`CARD_ROW`), with `lg:min-h-[23rem]` so every state has the same
  footprint (2026-09-08). Before this the break card was ~345px and
  school-in-session ~414px, so the page jumped when school ended.
  Then scaled down a notch on Levi's "make the card a bit smaller": padding
  p-6/md:p-8, hero headlines and headlineSize() tiers each one step down,
  blurb text-base, countdowns text-6xl/7xl with text-3xl/4xl seconds, chips
  px-4 py-2.5, tighter footer and column gaps, min-height 28rem -> 23rem.
  The tallest state now measures ~342px, so the min-height still governs and
  all five stay identical.
- School-in-session + school-break cards matched to the break card
  (2026-09-08). Levi screenshotted school-in-session and asked for it to look
  like the non-sync card. Three things set it apart, all gone now:
  (1) bg-blue-600 / bg-indigo-500 - a second and third blue sitting beside the
  app's own blue, which reads as a mistake rather than a status colour, so both
  are bg-primary like every sibling; (2) the "School Timetable Sync Active"
  chip repeated the footer line directly under it, next to the sync toggle
  itself - that slot now carries what the break card's carries, the next lesson
  ("Then English (Extra hour) at 15:40", or "Last lesson of the school day");
  (3) "Stay focused and take good notes!" said nothing actionable - the blurb
  now names when the school day releases you.
  Also fixed the crowding in Levi's screenshot: school subjects run to 60+
  chars ("Maintain Professional Conversation in Upper Technical English"), and
  at text-6xl that wrapped across into the countdown column. `headlineSize()`
  steps the hero down at 20 and 34 chars; the headline is capped at max-w-2xl,
  the left column got min-w-0, and both chips truncate inside max-w-xl.
  Verified live at localhost:3001 in both the short- and long-subject cases.
- Break card rebuilt onto the SAME SHELL as its siblings (2026-09-08), on
  Levi's instruction - he screenshotted school-in-session and said "this is how
  i want it to look generally". rounded-[40px], p-8 md:p-10, shadow-2xl, the
  glow orb, the uppercase pill + dot + clock meta row, text-5xl/6xl font-black
  headline, the w-fit chip, the split h:m:s countdown in the min-w-[300px]
  right column, the white uppercase button, and `cardControls` as the footer.
  When the day is over that countdown slot shows `3/3` in the same type, so the
  composition holds with no timer to run.

  ROOT CAUSE of three rounds of "looks basic / horrible": the break card was
  the ONLY state anyone had rebuilt against docs/ui-contract.md - quiet type,
  rounded-2xl, sentence case - while every sibling state in the same component
  kept the loud treatment. They render into the same slot one after another, so
  it read as unfinished rather than restrained. Note that ui-contract.md lists
  components/LiveFocusCard.tsx under "Off limits", so that earlier convergence
  should never have happened; this file is deliberately outside the contract.

  Two real bugs fixed on the way: (1) `to-primary/85` is ALPHA, not a darker
  blue, so the old gradient ground faded to near-white over the light page,
  exactly where the countdown sat - white text on white; (2) tomorrowTasks was
  unsorted, so "up next" was whichever row came back first, and a tomorrow
  block rendered identically to one an hour away (now labelled).

  REJECTED, do not reinstate: "Start a free session" / "Edit your timetable"
  buttons in the empty state, and a DayTimeline strip drawing the day to scale.
  Preview of all three states (markup/tokens/fonts mirrored from the component):
  https://claude.ai/code/artifact/8739ffe9-3f5a-441d-9eaa-3630909c201f
- Loose-end pass: migration histories repaired, migrate-on-launch fixed,
  search made case-insensitive, tour re-anchored, reminders shipped, subject
  deletes-on-read removed, desktop uploads moved out of the install dir
  (2026-09-06)
- Phases 0-8 committed for the first time, on branch phase-0-8-restructure
- Landing page components + redesigned welcome screen (a353a40)
- Per-user timezone setting; new users start with a fresh schedule (20daf98)
- Delayed-appearance skeleton loaders and Vercel deploy config (9e6c080)
