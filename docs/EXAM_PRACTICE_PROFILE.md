# Exam timing, practice workspace and profiles

Implemented on `codex/exam-practice-profile`. Production profile migration applied with owner approval on 2026-10-29. Desktop [1.0.17](https://github.com/leviGatimu/study-flow-app/releases/tag/v1.0.17) is published as the stable latest release, with the Windows installer and updater metadata. Update through Settings → Desktop app → Check for updates.

## Behavior

- Exams accept an optional start/end pair when created and on the exam detail page. Times use the account timezone. An end earlier than the start means the next day. With no known time, the exam finishes at the end of its calendar day.
- Finished status is derived from the saved end time, so it remains correct even if the app was closed. The open dashboard/exam pages refresh at status changes and after a sleeping tab resumes. No scheduled database mutation or extra status column is needed.
- An ended exam without a recorded result shows Done / Pending marks. Recording results still uses the existing result flow.
- Practice opens an immersive workspace with fullscreen, question navigation, answered/unanswered/flagged filters, final review, and visible save/retry status. Exit waits for pending saves. Existing drafts, objective marking, written marking and attempt history remain the source of truth.
- Calculator, Projects and Notes are removed from navigation and command results. Old routes redirect to Practice. Their historical database records are retained.
- `/profile` edits display name, school, bio, timezone and photo. Account menu and Settings link here. It uses the existing page, panel and form primitives; practice's question canvas has no outer border, as requested.
- Photo uploads accept JPG/PNG/WebP up to 5 MB and 25 megapixels. The server decodes them and creates a 384px square WebP without metadata. Photos are private uploads, and their URLs participate in desktop file sync. On Vercel, saving a photo requires the existing private Supabase storage configuration; the action reports a configuration error rather than using ephemeral disk.

## Approved production migration

Owner approved this exact migration on 2026-10-29. Applied transactionally to production and recorded in the Prisma migration ledger; all 11 existing profiles preserved. PostgreSQL and SQLite forward SQL are identical:

```sql
ALTER TABLE "UserProgress" ADD COLUMN "bio" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "school" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN "avatarUrl" TEXT;
```

Files: `prisma/migrations/20261028000000_profile/migration.sql` and its `migrations-sqlite` twin. All fields are nullable; existing data is untouched. PostgreSQL has an explicit destructive `down.sql` for manual use only. SQLite rollback deliberately keeps these additive nullable columns: downgrade the application rather than rebuilding the table or discarding profile data.

Deploy the migration before any web build that reads the new columns. Desktop upgrades apply the SQLite migration through the existing migration runner. The build script snapshots the SQLite client for packaging and restores the PostgreSQL client for web development. Preview fixtures and logs are kept outside the application bundle.

## Verification

- 232 tests passed, including exact exam time boundaries, overnight/timezone behavior, photo decoding/limits, profile sync and autosave races.
- TypeScript and scoped ESLint pass (final outputs in ignored `*-final.log` files).
- Real Next server with an isolated SQLite fixture: profile edit and photo upload; photo access owner 200, other user 404, signed out 401; retired route redirects; exam and practice pages HTTP 200.
- Browser: answer, flag, jump, save/exit, reload/resume, fullscreen, review/hand-in and a saved 67% result; profile edits and synthetic photo in the header; 390px mobile and desktop layouts; light/dark themes; exam automatically changed from In progress to Done / Pending marks at its scheduled end.
- Screenshots: `docs/screenshots/2026-10-28/`. Fixtures contain synthetic data only.
- Production desktop build passed. The installer includes Sharp's complete Windows image runtime and verifies image encoding before packaging.
- Packaged 1.0.16 database upgrade: existing users, profile XP, classes, terms, subjects, exams, tasks and practice sets preserved; new migrations applied; SQLite integrity and foreign keys pass. Packaged profile, exams, practice and Ask pages return 200; saved practice resumes; native image encoding and private-photo access pass.
- Both Vercel deployments succeeded. A read-only production sync request verified support for the new profile fields. The approved production migration preserved all 11 profiles and existing field values, and retained row-level security.
- Live AI-provider marking, actual two-device photo transfer and production storage upload were not exercised.

Re-run: `npm run test:sync:setup`, then `node --test --test-concurrency=2 "test/*.test.mjs" "test/sync/*.test.mjs"`. Type check: `npx tsc -p tsconfig.check.json --noEmit --incremental false`.
