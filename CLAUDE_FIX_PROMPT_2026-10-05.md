# Prompt for Claude: repair Study Flow and build a connected AI study workspace

Work in `C:\Users\user\Downloads\study-tracker`.

I want you to improve my actual existing app, not rebuild the old four-page tracker from the outdated blueprint. Read `HANDOFF.md` first, then `AGENTS.md`, `CLAUDE.md`, `docs/ui-contract.md`, `docs/FULL_AUDIT_2026-10-05.md` and `docs/AI_STUDY_WORKSPACE_VISION.md`. The audit is an evidence-backed starting point: reproduce findings before fixing them, and verify current code because line numbers will change.

My main goal is an ambitious Study workspace: a ChatGPT-style chat that understands my app, including marks, subjects, homework, exams, school lessons, routine, resources and previous practice. I should be able to ask normal questions, ask it to help set things up in the app, branch a conversation into question generation, enter a sandbox to answer questions and return to the conversation with my results. This must be one connected learning experience, not another disconnected chatbot or menu of features.

The repository already contains major uncommitted changes. Inspect `git status` and the diff, preserve them, and branch for substantial work without resetting anything. Do not commit, push, release, deploy or apply production migrations unless I ask. Never use my production DB/files as test fixtures. Do not print secrets or copy credentials into reports. Preserve both PostgreSQL web and SQLite/Electron desktop behavior, authentication and sync. Do not replace this evolved app with the obsolete local-only brief.

## Plan before implementation

Give me a concrete plan with completion criteria, data contracts, migration strategy and verification for each phase. Compare extending `/ask` + `/ai` against introducing a new workspace shell; prefer reusing the existing chat/context/provider/practice infrastructure. The workspace is a page where I do work, not a hub containing links to other pages. Keep existing URLs working. Show the proposed Study interaction layout before a major layout change; continue already authorized repairs while preparing that review. Complete useful vertical slices rather than building disconnected horizontal layers.

Preserve my fonts, sidebar rail, current day-column schedule arrangement, Homework solid vs Revision dashed distinction, subject/resource explorer and History/Overview and Marks/Goals tabs. Keep the immersive Focus appearance. I have previously rejected sweeping restructuring presented as UI polish. The substantial Study workspace redesign is explicitly requested here; this is not authorization to restructure every other page. Reconcile the stale UI contract with approved current primitives before changing headers globally. Use Magic MCP for new UI components when available as AGENTS requires; if unavailable, state that and reuse the existing shadcn primitives. Avoid unnecessary dependencies.

## First: fix the failures that would undermine the AI workspace

Use the audit's finding IDs as a checklist. Add regression coverage for real behavior and negative cases.

1. **Trustworthy records:** D01 backup must preserve years/terms, models, links and file availability; do not export API keys by default. Legacy backup omissions must be disclosed. Restore must validate, preview, preserve archives, operate transactionally and reconcile sync. D03/D13 subjects/goals need independent per-year identities and deliberate tombstone/recreation behavior, not moving Year 1 records into Year 2. D17 file-serving and file-sync need ownership checks, including static public-file bypass and bearer paths. D16 purge must exclude models without deletedAt in both normal and dry-run paths.
2. **Trustworthy grading:** S01 accepts `a` for `database` and `not mitochondrion` for `mitochondrion` as full marks: fix it. S02 treats unavailable/omitted AI marks as zero and then updates weakness/mastery: use explicit marking status, provisional/final scores and retry. S09 needs structured option IDs rather than delimiter-separated labels; S10 must record or explicitly confirm the displayed ordering. D02 needs one grade parser across Marks/Goals/Subjects/Insights, including A-, 18/20, percentages and invalid values, and safe repair of stored aggregates.
3. **Trustworthy schedule:** D05 canonical calendar days must be independent of server timezone, with instants kept separate. D06 generation needs database-enforced idempotency under concurrent requests and tombstone suppression. D07 routine edits must update untouched future instances while preserving real work. D04 moving tasks must retain evidence, exam links and XP identity. D08 term bounds, D09 exact entered times/server validation and D10 conflict-aware revision planning must agree across all screens. Review legacy data before any repair; do not bulk-shift dates speculatively.
4. **Saved work:** S03 mock exam needs an absolute deadline, stable latest answers and once-only submission. S04 archive read/write protection must be server-enforced. S05/S07 resumable drafts and failure recovery must survive sidebar navigation, refresh, crash and generation errors. S06 protects project edits, including New doc and edits during a pending save. S11 Focus uses durable identities, correct elapsed/pause semantics and idempotent accounting; do not show Done after failed save. S12 Notes need save recovery, undo and accessible positions/list fallback.

Existing audit baseline: type check passed; 148 tests passed; scoped ESLint failed with 79 errors and 20 warnings. These passing tests do not cover the new defects. Do not pretend the baseline is clean, disable rules globally or alter tests to bless failures. Fix touched-flow issues and identify remaining unrelated debt plainly.

## Study workspace: product behavior

On a wide laptop screen, show conversation history on the left, the main chat centrally and a collapsible context/artifact panel on the right. Keep the global app navigation clear. On smaller screens, use drawers/tabs instead of squeezing three columns. When practising, the sandbox can take most of the workspace, with the originating conversation reachable without losing progress. Avoid a permanent wall of dashboards or tiny cards.

The main composer accepts ordinary questions, planning requests and attached/selected study material. Render Markdown, code and mathematics through the existing ChatMarkdown component. Support saved conversations, proper new-chat reset, retry of an existing failed turn, streaming where feasible, cancellation, useful loading/error states and source links. Preserve draft input. Clearly show current year/term and context/provider status.

“Knows my app” means authorized, fresh, scoped retrieval—not dumping every database row into a system prompt. Start with a compact current snapshot and expose bounded read tools for marks/grade trends/goals, subjects, deadlines, exams, actual focus sessions, routines/school constraints, resources/notes/projects and practice attempts. Fetch detail only as needed, distinguish missing information from zero, and cite links to the actual records supporting app-specific answers. Do not mix official school marks, practice scores, self-rated flashcards or unmarked AI work. Use the selected user timezone/year consistently; explicitly switch scope before reading another year. Never fetch another account's records or secrets.

Examples that should genuinely work:

- “What should I study tonight, considering my marks and tomorrow's deadlines?”
- “Explain this Physics concept like ChatGPT, then give me five questions.”
- “My Maths result was 18/20. How am I progressing toward my goal?”
- “Set up three PHP revision blocks before Friday around my lessons.”
- “Use the PDF already in Physics Resources to make a timed mock exam.”
- “Branch this explanation into flashcards without losing the original chat.”
- “Take me back to the questions I got wrong yesterday.”
- “Move tonight's revision to tomorrow but keep the work and proof attached.”

### App actions

Use a typed, schema-validated server tool registry around existing domain actions. Read tools and proposed writes are separate. Initial writes should cover tasks/routine slots, homework planning, revision plans and study-set creation; expand to other features in verified slices. Resolve real subject/year IDs, detect ambiguous names and conflicts, and show a concise review card for proposed setup changes with dates, times and affected records. Read/explain/generate operations should not require repetitive permission dialogs. Bulk, destructive, conflicting or uncertain changes require a clear review before applying; an explicit simple user instruction can use a visible action result and undo where safe.

An action response contains validated result, record IDs, changed fields and navigation links. The AI must only say “saved” after a successful server result. Recheck ownership, writable scope and stale versions at apply time. Add request/idempotency IDs so retrying a message/tool call cannot create duplicates. Apply multi-record changes transactionally and refresh related views. Untrusted documents/chat text cannot authorize app writes; extraction/question generation/grading must have mutation tools and XP awards disabled. Fix S15: report-card extraction currently fails to disable these capabilities (`lib/marks-actions.ts:80`), and current scheduleTask applies immediately without a reliable action lifecycle. Review other JSON/extraction callers for the same pattern. Do not roll back successful writes merely because the final chat reply fails; retain their visible receipt. Ordinary chat replies should not mint repeated XP through random IDs; define rewards around real, idempotent learning events.

### Real branches and question sandbox

Persist a branch's parent conversation/message, subject, source material references, chosen practice configuration and artifact/run IDs. Support branches such as Explain, Generate quiz, Mock exam and Flashcards from the same conversation. A branch is independent work with a return link and preserved parent, not merely a new prompt replacing history. Define precisely which parent messages it inherits and how branch results feed back: inherit only through the branch point, never later parent turns. Enforce same-owner/scope ancestry and coherent deletion behavior.

Reuse the existing generation/runner/flashcard/marking engine after repairing it. The sandbox has one-question presentation, Previous/Next, question navigator, flags, answered/unanswered review, autosave/resume, clear exam deadline and confirmation at hand-in. Practice can show feedback; Mock exam hides answers until submission. For trustworthy testing, return question content without expected answers to exam clients and mark from server-owned set data. A generation failure retains source/configuration; unsupported or unavailable files have honest recovery. Persist source provenance and explicit truncation/coverage limits.

Results distinguish objective marks, provisional/unmarked written questions and final feedback. Retry marking without duplicating attempts/XP. Offer targeted retry of mistakes, an explanation branch and a proposed follow-up routine block. Return a grounded result summary into the parent chat so future recommendations use actual attempt evidence. Practice results must not silently overwrite official Marks. Flashcards retain idempotent spaced-repetition review and a real Due today/All cards distinction.

Extend data structures only as needed: conversations/branches/messages, artifacts/attempt drafts, source references and proposed/applied tool actions. Explain model relationships, SQLite/PostgreSQL migrations, soft-delete cascades, archive scoping, backup/export and sync behavior. TutorModule/QuizAttempt are currently LOCAL_ONLY; explicitly decide whether workspace practice artifacts need cross-device sync instead of promising it by default. Additive migrations first; preserve existing conversations/sets and keep routes/backlinks working. No speculative distributed-agent platform or giant rewrite is needed.

## Connect and polish the rest

Repair D11 homework planning so it appears in Today/Week/Month, separate work dates from deadlines, and implement D12 understandable completion/history with optional proof where appropriate. D14/D15 metrics and exam urgency must use honest definitions and linked subjects. Add U01 deadline previews, U03 usable short-height/zoom/mobile forms and U04 keyboard/focus/live-feedback improvements. U05 History URL filters/pagination and U06 accurate provider/offline copy should follow. Keep all loading/empty/error/partial/offline/archive states intentional.

Do not declare Bible, Calculator, Notes, Projects, Reports or Streak useless without usage evidence. Propose secondary navigation for occasional tools and clarify overlapping analytics; preserve routes/data until I choose a cut. The new chat workspace may become the first Study destination, with Practice and Focus as direct routes/branches; do not create another empty hub.

## Delivery and verification

For every phase, show what changed, why, and exact verification. Exercise source→chat→branch→sandbox→mark→follow-up end to end with isolated data. Include zero-data/new-user, missing provider, timeout/partial marking, denied tool action, duplicate retries, corrupted input, unsupported file, concurrent generation, timezone/midnight/overnight, holidays/term end, archive and second-user access cases. Use deterministic provider mocks for repeatable tests, then a real supported provider/document when available without claiming the mock proves live integration.

Verify desktop + web, 390/960/1440/1920px, light/dark, 640px height, 200% zoom, keyboard and screen-reader semantics; include screenshots for changed views. Run appropriate type checks, lint, all existing/targeted tests and a safe production build that does not connect to production or clobber the shared Prisma client. Explicitly state unavailable checks and remaining risks. Do not announce production readiness for untested live AI, sync or Electron flows. Update HANDOFF with a terse current snapshot and the exact next step after every completed/paused phase.

Start by reproducing the highest-risk defects and presenting the workspace architecture and first end-to-end slice. Then implement in verifiable increments until the requested repair and connected Study experience are complete.
