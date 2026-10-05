# Study Flow audit — 5 October 2026

The app has useful foundations, but correctness and lost-work problems should be fixed before another visual overhaul. Practice is the highest-impact workflow to repair. Backup/restore, academic-year isolation, dates, grades and task movement also need attention. During the audit the user explicitly expanded the Study vision to a chat-first workspace with app actions, real marks context, conversation branches and a question sandbox; `AI_STUDY_WORKSPACE_VISION.md` develops that direction. This authorizes a more substantial Study workflow redesign, while the other established layouts remain protected.

This is an audit and implementation brief, not a completed repair. No application source, real database records, credentials or user files were changed. Three agents reviewed learning workflows, scheduling/data and UI independently; the coordinating agent reviewed verification, storage access, desktop cleanup and settings. Findings refer to the current working tree, including existing uncommitted work. Line numbers may shift during implementation.

## Scope and evidence

- Current app: Next.js 16/React 19, PostgreSQL web application, SQLite Electron desktop application, custom account/session authentication, optional cloud/local AI and sync. The old four-page local-only blueprint is no longer an accurate description.
- Navigation: 22 destinations in six groups. `/study` redirects to `/ai`; the current Study landing experience is **Practice**, not the removed hub. `/insights` and `/goals` already redirect into History Overview and Marks Goals.
- Inspected: route/navigation inventory, shared UI, Dashboard, schedules, calendar, school lessons, subjects/resources, homework/exams, Practice/exams/flashcards, Ask AI, Focus, notes/projects, history/insights, marks/goals, reports/streak, settings/year/archive, storage routes and desktop startup. Depth varies: central workflows received source-level tracing; utilities and admin/auth did not receive exhaustive interaction testing.
- Type check: `npx tsc -p tsconfig.check.json --noEmit --incremental false` **passed**. This configuration excludes `.next`, `desktop-app` and `promo`.
- Tests: `node --test "test/*.test.mjs" "test/sync/*.test.mjs"` **148 passed, 0 failed, 0 skipped**. Sync/library fixtures use temporary SQLite databases and a separate Prisma client.
- ESLint: `npx eslint app components lib proxy.ts next.config.ts --format json` **failed: 79 errors, 20 warnings**. Errors include existing explicit-any debt, effects setting state, impure render randomness and unescaped text. A passing type check is not a clean quality baseline.
- Targeted checks: evaluated the actual grading helper and mocked actual `submitAttempt`; reproduced grade/time/overlap arithmetic; invoked the real tombstone purge helper against isolated SQLite. Results appear below.
- **Not verified:** authenticated screenshots, 390/960/1440/1920px layouts, light/dark contrast, keyboard interaction, real AI document generation/marking, packaged Electron behavior, live sync, build/deployment health. Browser inventory had no signed-in tabs. No authenticated live-page rendering was attempted against the configured database because page loads generate tasks and other records. Responsive clipping and cross-window concerns are explicitly risks requiring reproduction.

Priority: **P1** high-impact correctness/data safety; **P2** important workflow repair; **P3** polish/maintainability. “Code-confirmed” means the current implementation demonstrates the mechanism; it does not mean an end-to-end UI test was performed.

## Preserve these decisions

- Existing fonts, the user-approved sidebar rail and page navigation pills, and the explicitly selected day-column schedule layout.
- Homework solid / revision dashed distinction; separate school lessons and personal study routine.
- Subject/resource explorer, year/term/archive browsing, History/Overview and Marks/Goals consolidation.
- Current page/panel/empty/error primitives and neutral theme tokens. Reconcile stale written rules before applying mechanical styling changes.
- Immersive Focus appearance, which intentionally has its own visual treatment.
- Client-side PDF/DOCX text extraction, source-based question generation, local objective marking, batched written marking, flashcard recall grading and existing next-routine-block revisit links.
- Soft deletes, sync ownership safeguards, XP ledger idempotency, separate test Prisma client, Range streaming and reduced-motion rules.

## Findings: learning and doing the work

### S01 · P1 · Incorrect answers get full marks — empirically reproduced

`lib/study-actions.ts:499`, `app/ai/QuestionRunner.tsx:67` — substring matching accepts `a` for `database` and `not mitochondrion` for `mitochondrion`, both at 100%. Use exact normalized matching and explicit accepted answers; ambiguous answers remain unmarked until assessed. Share the client/server policy so instant feedback agrees with results.

### S02 · P1 · Unmarked work becomes a failing score — empirically reproduced

`lib/study-actions.ts:578`, `:617`, `:636`, `:639`, `:655`; `lib/insights-actions.ts:188`, `:225` — written answers start at zero, and unavailable/partial AI grading still feeds those zeroes into saved scores, mastery and review dates. Actual `submitAttempt` with mocked dependencies returned 50% for one correct objective answer plus one answered-but-unmarked written answer; captured writes saved score 50, understanding Beginner and review tomorrow. All-written attempts can become 0%. Persist marking status, preserve answers, distinguish provisional/final score, exclude unmarked items from scored denominators and offer idempotent retry. Do not update weakness/mastery as if incomplete marking were failure.

### S03 · P1 · Exam timer restarts on typing — code-confirmed

`app/ai/QuestionRunner.tsx:110`, `:121` — `submit` changes with each answer; the timer depends on it and clears/restarts its one-second interval. Typing faster than the interval can prevent ticks. Tick-count timing also drifts while backgrounded. Use an absolute deadline and a stable latest-answer reference; auto-submit exactly once. Reproduce continuous typing, tab backgrounding, sleep/resume and refresh.

### S04 · P1 · Practice can mutate finished years — code-confirmed

`lib/study-actions.ts:318`, `:531`, `:730`, `:806` — set lookup and attempt/review writes use ID + user without view/writable-scope enforcement. Practice UI has no archive guard. Add read scoping and server write guards for set attempts, card generation and review, not just new-set generation. Verify direct action calls and `?set=` across two owned years.

### S05 · P1 · Practice/flashcard progress is lost on departures — code-confirmed

`app/ai/QuestionRunner.tsx:93`, `:174`; `app/ai/StudyGenerator.tsx:257`; `app/ai/FlashcardRunner.tsx:57`, `:76` — answers and review grades live in component state. Explicit card Leave/Finish saves, but sidebar navigation, refresh and app closure bypass that. Store resumable drafts per user/year/set/mode; persist reviews with idempotency; provide Resume/Discard and protect genuinely unsaved departures. A saved set URL is not a saved attempt.

### S06 · P1 · Project New doc loses unsaved edits — code-confirmed

`app/projects/[projectId]/ProjectInterface.tsx:106`, `:114`, `:128` — switching documents checks dirty state, but New doc directly replaces editor content. Internal navigation bypasses `beforeunload`. A save response clears dirty state even if the user edited while awaiting it. Route every departure/create/switch through the same protection and compare saved revisions before clearing dirty state.

### S07 · P2 · Practice failure recovery drops configuration or strands controls

`app/ai/StudyGenerator.tsx:135`, `:172`, `:226`, `:521`, `:547`, `:559`; `app/ai/FlashcardRunner.tsx:72` — options live inside the Configure component, which unmounts during generation; a returned error remounts defaults. Several awaits lack catch/finally. Lift configuration into stable state, retain document/options/answers, recover from thrown transport/DB failures and provide Retry/Cancel states without duplicate writes.

### S08 · P2 · Mock exams cannot revisit answers

`app/ai/QuestionRunner.tsx:151`, `:218` — forward-only controls provide no Previous, question navigator, flags, unanswered review or final hand-in review. Keep one-question-at-a-time presentation; add accessible review/navigation and distinguish Practice feedback from Exam secrecy.

### S09 · P2 · Human-readable delimiters corrupt answers — empirically reproduced

`lib/study-actions.ts:466`; `app/ai/QuestionRunner.tsx:459`, `:511`, `:573` — multi-select uses commas, ordering uses pipes and matching uses semicolons/colons. Actual marker awarded 100% when expected `1,000, 2,000` and supplied `1, 000, 2` split into the same fragments. Use stable option IDs with structured arrays/maps; support older saved sets through an explicit compatibility reader.

### S10 · P2 · Ordering displays a draft it has not saved

`app/ai/QuestionRunner.tsx:512`, `:520` — fallback items are displayed before an answer exists. Keeping that displayed order leaves Check disabled or submits unanswered. Initialize a recorded order or require an explicit confirmation with clear copy.

### S11 · P2 · Focus displayed time, accounting and completion disagree

`lib/FocusContext.tsx:83`, `:86`, `:201`, `:208`, `:227`, `:245`, `:313`; `components/FocusSessionUI.tsx:480`; `lib/utils.ts:80` — elapsed display uses wall time while accounting awards time/XP on ticks; restored-expired sessions use different duration semantics. Restore logging lacks the main/widget guard used elsewhere; duplicate logging is a risk requiring cross-window reproduction. Failed completion can still show Done. Use durable session identity, agreed pause/elapsed semantics, exactly-once accounting and retryable save status. Replace hardcoded Kigali time in remaining Focus paths with configured user timezone while preserving the immersive appearance.

### S12 · P2 · Notes hide failed writes and can become unreachable

`components/StickyNotesContainer.tsx:171`, `:185`, `:211`, `:369`, `:396`, `:646` — optimistic edits/toggles/deletes lack rollback or save-error recovery; individual deletion has no undo/confirmation. Desktop cards use saved absolute positions inside a clipped fixed-height board; positions are only clamped on drag. Resize/overlap can hide notes, and desktop has no keyboard-accessible alternative to moving them. Preserve the board, add an always-available list/arrangement option, reachable keyboard controls, resize handling, Undo and ordered save/error handling. Offscreen clipping needs browser reproduction.

### S13 · P2/P3 · Study entry points are poorly connected

`app/resources/[subject]/page.tsx:66` links to Practice with subject only, requiring a second upload of an existing resource. `lib/study-actions.ts:372`, `app/ai/FlashcardRunner.tsx:53` sort review dates but do not provide a meaningful Due today queue. Improve library search/subject filters, Resume draft, Due/All cards and Practice from this file for supported available resources. Keep desktop-only files explicitly unavailable on web.

### S14 · P2/P3 · Contextual AI repeats errors and loses context

`app/subjects/SubjectBuddy.tsx:58`, `:80`, `:125` — ephemeral conversation, context from mounted props, generic connection errors and no archive-disabled state. `app/ask/AskClient.tsx:77`, `:237` retries by appending another user turn; `:85` and `app/ask/page.tsx:59` suggest New chat may retain client state after replaceState; reproduce that reset behavior. `app/projects/[projectId]/ProjectInterface.tsx:147` sends titles rather than selected document content, and `:50` has interval cleanup returned inside a timeout callback. Centralize provider readiness/error/Markdown behavior, retry existing turns, fetch fresh subject context and protect drafts. Shared Ask AI + contextual subject assistance can coexist.

### S15 · P1 · AI capabilities leak into extraction; current tools lack an action lifecycle

`lib/marks-actions.ts:80` calls askAIBuddy for report-card JSON without `{ tools: false, xp: false }`, despite `lib/ai-actions.ts:1070` requiring those flags for JSON tasks. `lib/ai-actions.ts:56`, `:465` expose scheduleTask/getScheduleSummary, with direct task creation and no proposed-action lifecycle, version check or idempotency key; `lib/copilot-actions.ts:223` enables these tools by default. This is code-confirmed capability exposure, not an observed unwanted task creation. Introduce task-specific read/propose/apply capabilities, disable writes/XP for extraction/generation/grading, check action results and preserve receipts across retries/fallbacks. The present `CopilotContext` does not include detailed official marks/goals/resources/project content, so “knows everything” is a requested expansion, not current behavior.

## Findings: schedule, records and data safety

### D01 · P1 · Backup is incomplete; restore breaks years and relationships

`lib/actions.ts:2539`, `:2655`, `:2735`, `:2880`; `app/settings/DataSettings.tsx:98` — UI promises all data, but export omits years/terms, subjects/goals, report cards/grades, school lessons, attempts/chat, project documents, resource folder paths and task template/exam links. It exports file URLs, not file bytes. Restore hard-deletes multiple model families across all user years, then stamps replacements into the current year and loses links; these removals do not produce sync tombstones. Included relation rows are not filtered for tombstones. `lib/actions.ts:2574` exports a plaintext Gemini key into the ordinary backup.

Implement a versioned, validated relational backup with year/term identities, stable/remapped links, file manifest/bytes policy, credential exclusion by default, preview and transactional restore. Define sync reset/reconciliation explicitly. Legacy v1 backups cannot recover fields never exported; report those limitations. Verify round trips only in isolated fixtures. Existing restore should not be described as a complete safe backup until fixed.

### D02 · P1 · Grade averages produce impossible values — empirically reproduced

`lib/marks-actions.ts:211`, `:257`, `:295`; `lib/insights-actions.ts:29`; `app/subjects/subject-model.ts:100` — stripping nonnumeric characters maps `A-` to 0 and `18/20` to 1820; Insights treats `18/20` as 18 and uses a different letter scale. Consolidate parsing into a domain utility and use it for marks, report aggregates, goals, subjects and insights. Define unknown/malformed handling; update aggregates transactionally and rebuild incorrect stored aggregates through a reviewable repair.

### D03 · P1 · Starting a year steals subjects/goals from the archive

`lib/subject-actions.ts:293`, `:312`; `lib/goal-actions.ts:27`, `:36`; `prisma/schema.prisma:714`, `:732` — user-wide uniqueness conflicts with class-scoped screens; adding Physics in Year 2 reparents Year 1 rows. Introduce per-year identities and update sync natural keys. Preserve original IDs/relationships; handle legacy null-class records and tombstones deliberately. This requires a migration, not another adoption workaround.

### D04 · P1 · Moving recurring tasks loses proof and identity

`lib/actions.ts:793` — move hides original and creates another row without copying workDescription/proofPdfUrl/examId; XP stays keyed to the original. Preserve identity plus original-slot suppression, or transactionally preserve every relationship and idempotency key. Exercise completed/proof-bearing/manual/recurring moves and regeneration of the original day.

### D05 · P1 · A calendar day changes with server timezone — arithmetic reproduced

`lib/actions.ts:215`, `:278`; `lib/utils.ts:20`; `lib/task-times.ts:13` — server-local midnight is mixed with user-zone keys. The same 5 October midnight becomes `2026-10-05T00:00Z` on UTC and `2026-10-04T22:00Z` on Johannesburg; west-offset conversion can pair Monday generation with Sunday keys. Standardize calendar days independent of host, separate them from instants, and update generation/dedupe/sync/term/holiday/missed logic together. Do not silently rewrite historical rows; classify legacy representations first. Test UTC/UTC+2 hosts, east/west user zones and DST.

### D06 · P2 · Parallel generation can duplicate a routine slot

`lib/actions.ts:231`; `prisma/schema.prisma:425` — read/check/createMany has no database-enforced unique generation slot. Use a portable canonical unique slot/deterministic key and conflict handling; preserve tombstone suppression. Reproduce simultaneous Today/Week/Month requests in SQLite and PostgreSQL fixtures.

### D07 · P2 · Routine edits leave generated schedules stale

`lib/actions.ts:1248`, `:200` — only the template updates; Week/Month may already have generated weeks of old snapshots. Change day and old-day instances remain. Define edits for untouched future instances, preserve completed/proof-bearing/manual overrides, safely remove obsolete slots and refresh all affected views.

### D08 · P2 · Term-end rules depend on the caller

`lib/term.ts:137`; `lib/actions.ts:200`, `:364`, `:415`, `:487`; `components/CalendarGrid.tsx:511` — Today/Tomorrow can generate beyond a term's last day while Week/Month clamp at termEnd. Enforce one rule inside generation; maintain manual year/term transition separately from day eligibility.

### D09 · P2 · Quick Add changes times and misses server validation — reproduced

`lib/actions.ts:1535`, `:1540`; `components/QuickAddForm.tsx:31`, `:110` — saves 20:00 as 20:03, 23:57 as 24:00 and 23:59 as 24:02, leaving end time unchanged. Store exact user-entered times; any prep buffer must be explicit and separate. Validate date/HH:MM/subject/type/day at action boundaries, with a deliberate overnight/equal-time rule. Keep the form open on auth/save errors and use the configured timezone for default date.

### D10 · P2 · Revision planner hides conflicts — overlap arithmetic reproduced

`lib/exam-actions.ts:181`, `:238` — minimum-one-day arithmetic defeats no-days-left checks; overnight end 00:00 misses overlaps; after unsuccessful placement the planner stacks at preferred time. Availability excludes not-yet-generated routine, school lessons and holidays. Preview feasible/conflicting slots, respect term/holiday/exam boundaries and preserve evidence-bearing work on replacement. No silent stacking fallback.

### D11 · P2 · Planning homework does not schedule the work

`lib/homework-actions.ts:59`; `app/homeworks/HomeworkList.tsx:307`; `app/calendar/page.tsx:45`; `app/timetable/page.tsx:73` — plannedDate is a label, not an actionable task; calendar queries dueDate and Week uses tasks/school. Connect planned work to a timed block or explicit planned-homework entry across Today/Week/Month. Keep “work on” separate from “due” and prevent duplicates.

### D12 · P2 · Completion requires proof and misses the main work log

`lib/homework-actions.ts:90`; `app/homeworks/HomeworkRow.tsx:46`; `lib/actions.ts:661`; `app/history/page.tsx:43` — no-proof homework cannot be completed; completed homework appears only in its own Done view, not History. Consider evidence optional unless explicitly required by user preference. Record completion time and provide understandable history types for homework, blocks, practice and focus without counting the same work twice.

### D13 · P2 · Deleted subjects/goals cannot reliably be recreated

`lib/goal-actions.ts:36`, `:72`; `lib/subject-actions.ts:299`; `prisma/schema.prisma:714`, `:732` — goal upsert updates a tombstone without restoring deletedAt, then reads hide it; subject duplicate checks exclude deleted rows but uniqueness still includes them. Define restore/new identity semantics, coordinated with per-year uniqueness and sync.

### D14 · P2 · Analytics confuse scheduled, focused and completed time

`lib/actions.ts:595`; `app/exams/page.tsx:160`; `app/history/HistoryClient.tsx:43`, `:129`, `:250`, `:322`; `lib/insights-actions.ts:167` — “Time studied”/“Focus time” uses planned duration of checked blocks. Future calendar-generated tasks can reduce some readiness ratios just by opening Month. Task history uses scheduled date because there is no completion timestamp. Define metric contracts and real completion/session timestamps; label approximations and use consistent eligible-task denominators.

### D15 · P2 · Exam urgency and dates use inconsistent identities/zones

`lib/actions.ts:392`; `app/exams/page.tsx:62`; `lib/exam-actions.ts:181` — some urgency logic matches exam.title instead of linked subject; “Physics Paper 1” fails to flag Physics. Server-zone exam dates differ from configured-zone Dashboard. Use subject relationship first, shared day utilities and chronological timeline with urgency indicators.

### D16 · P2 · Tombstone cleanup queries a nonexistent column — SQLite reproduced

`lib/soft-delete.ts:323`; `scripts/purge-tombstones.mjs:47`; `instrumentation.ts:28` — every model is swept, including SyncState, which has no deletedAt. Real isolated Prisma invocation returned **Unknown argument `deletedAt`**. Startup catches failure, so this is cleanup failure rather than a proven startup crash; models before the error may already have been purged. Filter by metadata/known tombstone models consistently in runtime and dry-run scripts. Test against the complete current model list.

### D17 · P1 on shared deployments · File authentication does not enforce ownership

`app/uploads/[...path]/route.ts:29`, `:38`, `:57`; `app/library/[...path]/route.ts:21`, `:28`; `lib/upload.ts:114`; `app/api/sync/file/route.ts:35` — userId is checked for presence, then paths are resolved globally without checking which user's record authorizes the file. A signed-in second account with a known filename/path can reach another account's bytes. Sync HEAD/POST also accepts global names without owner scoping. This is code-confirmed; no real cross-user file was accessed. Default public/uploads can bypass route authentication via static serving; verify deployed behavior and move private files out of public. Enforce file-record ownership across proof/resource/report/music/project uses, preserve authorized bearer access, and test two users. Library root must be isolated if multiple accounts share one desktop. A private bucket alone cannot fix an application route using a service-role client without owner checks.

## Findings: presentation and accessibility

### U01 · P2 · Calendar hides deadline titles until opening the day

`components/CalendarGrid.tsx:228` — counts/dots include homework, preview text does not. Add clearly typed deadline preview rows and accurate overflow counts; preserve actual day buttons and the scrollable day dialog.

### U02 · P2 · Style law disagrees with the shared header

`docs/ui-contract.md`, `components/ui/page-header.tsx:59` — document says text-3xl/font-bold while current primitive uses text-4xl/font-black intentionally. Resolve against user-approved appearance and update documentation. Do not use this discrepancy to justify a sweeping visual rewrite or font change.

### U03 · P2 · Some forms may clip on short viewports/keyboard/zoom

`components/ui/dialog.tsx:64`; `components/QuickAddForm.tsx:62`; `components/StickyNotesContainer.tsx:409`, `:471` — shared modal has no viewport height/scroll limit and callers often inherit it. This is a code-based risk, not a screenshot-confirmed defect. Verify 640px-high laptop, 200% zoom and mobile keyboard; make content/footer reachable while retaining focus trapping and restore-focus behavior.

### U04 · P3 · Keyboard and feedback gaps

`components/AppShell.tsx:59` — no skip-to-main target/link.
`components/Sidebar.tsx:62`, `app/history/HistoryClient.tsx:368` — outline removed without a visible replacement on these controls.
`app/ai/QuestionRunner.tsx:385`, `:439`, `:498` — choice widgets lack explicit consistent focus styles; native focus may still exist and needs live verification.
`app/ai/QuestionRunner.tsx:261` — changing answer verdict has no status/live announcement.

Add skip/focus/announcement behavior and test full keyboard completion of the core workflows.

### U05 · P3 · History state and rendering do not scale

`app/history/HistoryClient.tsx:84`, `:414` — filters/sort/search reset on reload; matching rows all render. Mirror useful state into URL and use bounded pagination for large histories. Keep filters easy to clear and preserve date/subject links.

### U06 · P3 · Provider/setup wording is inaccurate

`app/ai/StudyGenerator.tsx:320`; `app/ai/page.tsx:62` — “cannot be done on your device” conflicts with Ollama support. Clarify configured vs reachable provider and where document text/images are processed; photos do leave the browser as image payloads. Keep clear offline failure recovery.

### U07 · P3 · Lint and continuity documents obscure the baseline

The audit lint command found 79 errors/20 warnings. Representative behavior-relevant locations: `components/FocusSessionUI.tsx:254`, `:2720`; `app/focus/widget/page.tsx:63`; `components/ReminderManager.tsx:47`; `components/DailyQuote.tsx:68`. Fix errors in touched flows first; track unrelated debt explicitly without disabling rules globally. The prior HANDOFF exceeded 2,000 lines and mixed superseded plans with current state; it has been preserved in an archive and replaced with a current snapshot.

## Feature decisions: keep, repair or optionally demote

| Area | Decision | Reason |
|---|---|---|
| Today / Week / Month / routine / school lessons | Keep and repair | Different planning horizons and school vs personal time are useful; fix generation rather than merge them blindly. |
| Subjects / Resources | Keep and connect | Good foundation for coursework; let existing files feed Practice. |
| Practice / Mock exam / Flashcards | Repair first | Core exam preparation; inaccurate grading and lost drafts undermine trust. |
| Focus | Keep and repair | Distinct concentration workflow; standardize accounting and saved status. |
| Ask AI / Subject Buddy / Project AI | Clarify and consolidate shared behavior | Overlapping infrastructure, but global and contextual assistance are different needs. |
| Homework / Exams | Keep and repair | Connect planned work, optional proof and revision scheduling to actual day views. |
| History / Overview / Marks / Goals | Keep current tab consolidation | Already reduced duplicate pages; define honest metrics. |
| Reports / Streak / XP/ranks | Optional simplification | Separate purpose from analytics already shown in History; gaming should not obscure academic outcomes. No usage evidence establishes them as useless. |
| Notes / Projects | Keep unless user says unused | Data-loss/accessibility defects justify repair, not deletion. |
| Calculator / Bible | Optional secondary Tools placement | Could reduce primary Study choices while retaining routes, browser-local data and preferences. |
| `/time` and older utilities | Trace links before changing | Off-navigation alone is not proof of dead code. |
| Authentication / sync / web / desktop | Preserve | Existing architecture and data depend on these; obsolete blueprint is not authorization to remove them. |

## Practical Practice revamp and expanded Study target

Keep the visual language and reuse the one-question runner. Library should support search/subject filters, due reviews and Continue draft. New set should retain configuration, offer upload/paste/available resource selection, show extracted coverage/provider and recover from failure. Overview should clearly offer Practice, Mock exam and flashcards. Runner should autosave, allow reviewing answers and use a reliable deadline. Results should show marked vs unmarked items, explanations, retry marking and targeted practice, then link back to the subject and next routine block.

The user's expanded direction is a primary chat workspace that composes these flows: normal questions and scoped app context, reviewed setup actions, persistent branches from a selected message, sandbox artifacts and results returned to the originating chat. Reuse Ask AI and Practice instead of adding a third disconnected tool. Add actual marks/goals retrieval, branch ancestry, typed artifact/action records and an explicit sync policy; current practice sets/attempts are local-only while chats sync. See `AI_STUDY_WORKSPACE_VISION.md` and the Claude prompt for the phased product specification.

## Implementation order and proof required

1. Reproduce P1 cases in isolated fixtures; record current git changes and protect data. Fix backup/file ownership/year isolation/grading first.
2. Establish calendar-day, interval, completion and grading contracts. Fix duplicate generation, template edits, task moves, boundaries and planner.
3. Repair Practice recovery/resume/timer/navigation/answer formats, Focus accounting and Notes/Projects dirty state.
4. Connect homework/resources/history; reconcile metrics and provider/context errors.
5. Polish one route family at a time; browser-verify light/dark, narrow/wide, short height, 200% zoom, keyboard and offline/error states. Consider feature demotion separately.

Completion means targeted regression tests plus isolated end-to-end workflows, type/lint/build with honest baseline reporting, SQLite/PostgreSQL compatibility and screenshots. A green unit suite alone is insufficient. No release, commit, push or production migration is implied by this audit.

## Review references

UI review used the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), subordinate to this project's explicit user-approved visual decisions. File access review used [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): service keys bypass RLS, so the application must enforce authorization when fetching through that client. These references explain review criteria; findings above are grounded in repository code.
