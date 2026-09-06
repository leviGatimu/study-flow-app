# HANDOFF

## Current Task
Restructuring Study Flow around an academic-year model, and toning the UI down
from "too much" to a calm, consistent tool. Planning agreed with Levi on
2026-08-28; no code written yet.

## Status
Phases 0-7 COMPLETE. Phase 8 written but not enabled. Phase 9 not started.
Typecheck clean; both build targets compile (`next build` and `build:desktop`).

## WHEN YOU WAKE UP - three things need YOU, not me

1. VERCEL DATABASE_URL still points at port 6543 (transaction pooler), which
   measured 828ms per query vs 165ms on 5432. Local .env is already switched.
   The deployed site is still 5x slower than it needs to be.

2. UPLOADS ARE STILL BROKEN IN PRODUCTION. The switchable backend is written;
   it needs a Supabase Storage bucket and three env vars ON VERCEL ONLY.
   See "Phase 8" below and .env.example. Files already uploaded there are gone.

3. THE DESKTOP APP HAS NEVER BEEN LAUNCHED FROM THIS TREE. The SQLite build
   compiles and the migration SQL is verified against a real SQLite file, but
   the Electron runtime path is unproven. Run `npm run build:desktop` then
   `npm run pack` in desktop-app/ and actually open it before trusting it.
   Remember to run `npm run db:postgres` afterwards or `npm run dev` breaks.

## What NOT to do next without discussing it
Phase 9 (two-way sync) is the one piece that cannot ship half-built - a partial
sync engine corrupts data rather than merely annoying you. The foundations are
all in place (stable cuids, updatedAt/deletedAt everywhere, and file storage
once #2 is done). Start it as a deliberate piece of work, not as a follow-on.

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
- [~] Phase 8 - Uploads: backend written and switchable; NOT ENABLED (needs Levi's keys)
- [ ] Phase 9 - Two-way sync engine

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

## Phases 6 + 7 - desktop SQLite build and auto-updates (2026-08-29)

### Dual-provider Prisma
`provider` cannot be an env var, so the desktop schema is DERIVED at build time.
  scripts/prisma-sqlite.mjs  rewrites the datasource block of the canonical
    Postgres schema and writes prisma/schema.sqlite.prisma. GENERATED FILE -
    never edit it; edit prisma/schema.prisma and re-run.
  npm run db:sqlite      derive + generate a SQLite client
  npm run build:desktop  db:sqlite + next build
  npm run db:postgres    generate the Postgres client again
  !! Both targets generate to the SAME output path, so lib/prisma.ts needs no
     changes - but a desktop build leaves the client pointing at SQLite. ALWAYS
     run `npm run db:postgres` afterwards or `npm run dev` will fail.

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
- Landing page components + redesigned welcome screen (a353a40)
- Per-user timezone setting; new users start with a fresh schedule (20daf98)
- Delayed-appearance skeleton loaders and Vercel deploy config (9e6c080)
