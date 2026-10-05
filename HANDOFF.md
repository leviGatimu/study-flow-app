# HANDOFF

## Current Task
Repair Study Flow per docs/FULL_AUDIT_2026-10-05.md and build the connected AI Study workspace (chat → branch → sandbox → results back to chat). Prompt: CLAUDE_FIX_PROMPT_2026-10-05.md. Plan, contracts and phase status: docs/STUDY_WORKSPACE_PLAN.md (read it first).

## Status
In progress on branch `study-workspace` (all prior uncommitted work carried over; NOTHING committed/pushed/released/migrated). Phase 0 repairs done. Owner decided: D-1 approve EACH prod migration (show SQL first), D-2 SYNC chats/branches/practice, D-3 layout approved (see plan).

## Progress
- [x] Phase 0 (no schema): S01 S09 S10 marking (lib/marking.ts), S02 marking status + "Mark again", S03 exam deadline, S04 archive guards, S15 tools/XP off on every askAIBuddy caller, D02 one grade parser (lib/grades.ts) + report-only repair script, D16 purge model filter, D17 file ownership (lib/file-access.ts; /uploads route moved to app/api/uploads behind a proxy rewrite; proxy no longer lets dotted /uploads paths skip auth).
- [x] Verified: tsc (tsconfig.check.json) clean; 178/178 tests (was 148); ESLint total unchanged 79/20 with touched-file findings fixed; all changed client components compiled in the dev server.
- [x] D09 Quick Add exact times + server validation. Sync takeover hole closed (lib/sync/ownership.ts).
- [x] Migration #1 APPLIED to production (owner approved): workspace columns/tables + sync backfill; chats/practice now sync. Client regenerated; dev server restarted from Claude's shell (background task) - if it is gone, `npm run dev`.
- [x] Verified: tsc clean; 189/189 tests; ESLint 77/18 (baseline 79/20); compile check 7/7; prod read-check of new columns.
- [x] S05/S03/S08 saved runs: lib/run-draft.ts + startStudyRun/saveStudyRun/discardStudyRun (AttemptDraft; exam deadline fixed server-side; hand-in tombstones the draft); runner has Previous, navigator, flags, exam hand-in review; set page shows Continue/Start over. 195/195 tests.
- [x] Phase 2 grounded chat (/ask): lib/copilot-retrieval.ts (intent+subject detection, bounded evidence [S#], official vs practice vs goals, MISSING declared), lib/copilot-citations.ts (numbered links), lib/copilot-turns.ts (requestId turns, retry in place, stop discards late answer; tested on SQLite incl. concurrency), approved 3-column layout (chats | thread | collapsible context panel; drawers on smaller screens), real New chat reset, draft kept per chat in localStorage, year/term + provider status. Study nav now starts at Ask AI; next.config /study -> /ask (needs a dev-server restart to apply).
- [ ] Phase 1 rest: D05/D06 calendar-day contract + unique slot (needs migration #2 - ask first), D07, D04, D08, D01 backup v2, D03/D13 (migration), S05 drafts UI (table exists now), S06, S11, S12.
- [ ] Phases 2-5 per plan.

## Working Notes
- `npm run dev` = PRODUCTION Supabase. Schema changes: write the migration pair, SHOW the SQL, apply to prod only after the owner says yes (D-1). Never run scripts/repair-report-averages.mjs --apply against prod without the owner.
- `export type { X }` in a 'use server' file 500s every page of the dev server (happened once this session, fixed in minutes). Compile-check via a temporary app/welcome/<name> page importing changed components; delete it after.
- Machine memory was ~0.3 GB free: no production build run. Electron screenshots and the Chrome extension were unavailable.
- Not yet verified: signed-in UI for results/runner changes, two-user file access, two-year archive guard, live AI marking. Earlier unverified items (Vercel 402/blocked account, desktop sync) still stand.
- Next step: Phase 3 first branch end to end - Branch buttons under answers (Quiz first): create branch session (parent message cutoff), generate a set from the conversation/selected resource (provenance+coverage), open the runner in the workspace with Back-to-chat, post a grounded result summary to the parent. Streaming replies still not done (askAIBuddy is non-streaming).

## Recently Completed
- 2026-10-05: Schedule restyle (/timetable, /manage; School lessons verified too). components/DayColumns.tsx: container-query columns (7 only at >=76rem content width, else 4/3/2, phone stacks; no sideways scroll), flat day columns under a rule (today = blue rule), light blocks with a left accent edge (solid blue homework / dashed orange revision / grey school; done green, missed red), sr-only type labels, controls on the time line. Week grid moved to app/timetable/WeekGrid.tsx (presentational, same data). DeleteTemplateButton names its block. Month (studyBlockClass) and page headers untouched. Verified with headless Edge + DevTools device emulation at 390/960/1366/1440/1920, light+dark, Tab order; screenshots in docs/screenshots/2026-10-05-schedule-restyle/ (untracked). Headless Edge --window-size clamps to 496px; use device emulation (scratchpad cdp.mjs approach) for phone widths. Chrome extension cannot load any local address here.
- 2026-10-05: Phase 0 audit repairs on study-workspace (above).
- 2026-10-05: Audit + workspace vision + Claude prompt (docs/), preserved older handoff at docs/HANDOFF_ARCHIVE_BEFORE_AUDIT_2026-10-05.md.
- Earlier 2026-10-05 (uncommitted): Ask AI, holidays, No-limit Focus, History/Marks tab merges, DayColumns schedule.
