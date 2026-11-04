# Study Flow interface redesign, 3–4 November 2026

## Direction

A student planner with a calm, precise character: keep the app's fonts, neutral surfaces and blue selection colour; let actual timetables and study records carry the detail. Independent stacks of cards were considered, but an aligned timetable makes gaps, overlaps and the relationship between days easier to read.

## Changes

- Week, Study Routine and School Lessons share a time-aligned schedule canvas. School defaults to weekdays with a weekend toggle; the other schedules show seven days. Narrow layouts use a day picker and agenda. Short breaks, long names, overlaps and overnight study remain readable.
- Selecting a block opens a keyboard-accessible details drawer. Existing editors and deletion confirmations are retained. The question workspace remains border-free.
- Sidebar links stay at the top, per the latest correction. Icons, selection, corners and level styling are quieter; horizontal overflow is hidden.
- Study opens the practice library. Ask AI includes visible Practice, Ask AI, Focus and Bible navigation. Empty libraries do not immediately force the generator open.
- Settings uses one preferences frame, grouped navigation, flat form sections and visual theme previews. Existing passwords, AI keys, backups, sync pairing and destructive safeguards retain their handlers.
- Streak separates consecutive active days from the calendar of completed study blocks, with a compact rank/XP record. The progression logic is unchanged.
- History's attention ranking and weakest-subject CTA are removed. Subject records are alphabetical. AI starters are neutral; its instructions require explicit requests before practice recommendations or revision assignments.
- Settings testing exposed a pre-existing device sync query bug: attempts and messages were incorrectly filtered by a nonexistent `userId`. Dirty-row collection and pending counts now use the existing parent-ownership rules. No database migration was required.

## Verification

56 focused tests pass, including real SQLite ownership/workspace sync tests. TypeScript and scoped ESLint pass. Browser checks used synthetic data only: desktop and 390px mobile layouts, both themes, saved school/routine/profile edits, theme selection, details/confirmation/Escape/focus restoration, empty weekends, Study modes, persistent chat navigation and sync status. Screenshots and logs are in `C:/Users/user/Documents/Codex/2026-11-03/schedule-redesign`.

The local preview uses an isolated SQLite database on port 32103. No production migration, deployment or desktop release was performed for this redesign. Live AI output and pairing to a production account were not exercised. Existing Recharts initial-size warnings were observed on History; those chart implementations were not changed.

## Design resources

Applied UI/UX Pro Max and [Unslop by Damir Sokolovsky](https://heydamir.design/unslop) (CC BY 4.0). The 21st.dev MCP catalog was consulted for calendar references; component-source retrieval was blocked by the account's daily quota. Existing Radix/shadcn components were used without bypassing that limit.

## Study logs, account screens and setup

- Every History entry opens `/history/[id]`. The page separates scheduled length from measured focus time and shows study notes/attached work, completed/missed status, session history, total focus XP, longest/average focus, routine/deadline information, related exam, and timestamp/timezone. Statistics aggregate every session; the list is bounded to the latest 50.
- Focus measurements extend the existing append-only XP ledger with nullable `taskId` and `focusSeconds`. Old grants remain unmeasured; no historical duration is fabricated. Session identity persists across reloads/widgets. The grant and focus counters commit in one transaction, with a stable unique key preventing duplicate saves. Failed saves stay in a local retry queue. Owner checks apply to both writes and detail reads.
- History's existing charts show scheduled lengths, so their labels now say planned/scheduled time rather than actual study time.
- Login/Register use the real cube logo and preserve the original animated glowing shapes, floating glass panels, grid, bold headings and rounded controls. The owner explicitly rejected the initial static design; keep the animation and existing visual character. Motion respects reduced-motion preferences.
- Registration has two stages: name, optional school/introduction and timezone, then username/password/confirmation. Server validation mirrors field limits and checks UTF-8 password length; account/profile creation is atomic. Academic information follows in setup.
- Setup uses a viewport-height frame, independently scrolling form, actual logo, step rail, accessible progress, 44px controls and focus/scroll reset between steps. Existing save actions and optional steps remain available.
- The dashboard setup checklist was explicitly rejected as too large. It is now a neutral ~62px row with one Continue setup link and permanent dismissal; no checklist tiles, primary-colour frame, progress score or pressuring copy.
- Focus verification exposed a pre-existing PDF.js server import error (`DOMMatrix` unavailable). The PDF library now loads only when a PDF is selected. A real server-render regression test covers opening the study panel without browser globals.

## Migration and rollout

`20261104000000_focus_log_details` adds two nullable ledger columns, a nonnegative-duration check, a task foreign key with SET NULL, and an index for per-user task/session reads. Both PostgreSQL and SQLite migrations are forward-only: roll back application code while retaining the additive columns and their measurements. Dropping columns would discard new focus history and is not the rollback plan.

Only the isolated preview and temporary test databases were migrated. Do not apply this to production as part of this UI task. A later rollout must migrate/deploy the web server before distributing a desktop build. Older desktop clients receive ledger rows without the new columns; new clients require the server's focus-log capability acknowledgement before marking a push clean, so an older server cannot silently discard pending focus records.

The setup rail adapts [Registration Stepper by ravikatiyar162](https://21st.dev/@ravikatiyar162/components/registration-stepper), retrieved through the 21st.dev MCP after the daily allowance reset on 4 November. It retains numbered active steps without falsely marking skipped steps completed.

## Final verification, 4 November

88 focused tests pass (21 suites), including recording/replay, zero-XP sessions, legacy/free focus, cross-account reads/writes, negative-duration database constraints, task remapping across devices, old-desktop payload compatibility and a real React server render without PDF browser globals. TypeScript and scoped ESLint pass. No production build or live sync pairing was run.

The sample account completed registration and saved its profile, year, subject and recurring block through setup. Setup's import dialog and footer were exercised at 390px. A real focus session saved 35 seconds/35 focus XP and its notes; its History row opened the correct detail page on desktop and phone. The compact setup row measured 61.6px tall; dismissal survived reload. Phone registration advanced both steps, kept validation feedback visible at the top and reported a password mismatch without creating an account. Login, registration and log layouts had no horizontal overflow. Desktop auth animations were verified running. Temporary responsive overrides were reset.
