# Exam timing, practice workspace and profiles

Implemented on `codex/exam-practice-profile`. Production profile migration applied with owner approval on 2026-10-29; desktop 1.0.17 release in preparation.

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

Deploy the migration before any web build that reads the new columns. Desktop upgrades apply the SQLite migration through the existing launcher. Restore the PostgreSQL Prisma client for a web build; the isolated preview worktree currently uses its own SQLite client and fixture-only `.env.local`.

## Verification

- 232 tests passed, including exact exam time boundaries, overnight/timezone behavior, photo decoding/limits, profile sync and autosave races.
- TypeScript and scoped ESLint pass (final outputs in ignored `*-final.log` files).
- Real Next server with an isolated SQLite fixture: profile edit and photo upload; photo access owner 200, other user 404, signed out 401; retired route redirects; exam and practice pages HTTP 200.
- Browser: answer, flag, jump, save/exit, reload/resume, fullscreen, review/hand-in and a saved 67% result; profile edits and synthetic photo in the header; 390px mobile and desktop layouts; light/dark themes; exam automatically changed from In progress to Done / Pending marks at its scheduled end.
- Screenshots: `docs/screenshots/2026-10-28/`. Fixtures contain synthetic data only.
- Production build, live AI-provider marking, actual two-device photo transfer and production storage upload were not run. Machine memory headroom was approximately 1.2 GB, so a production build was deferred. No production data was accessed or changed for verification.

Re-run: `npm run test:sync:setup`, then `node --test --test-concurrency=2 "test/*.test.mjs" "test/sync/*.test.mjs"`. Type check: `npx tsc -p tsconfig.check.json --noEmit --incremental false`.
