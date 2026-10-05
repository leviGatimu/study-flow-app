# AI Study workspace — product and architecture brief

User direction, 5 October 2026: a substantial ChatGPT-style study workspace that knows the app and marks, helps set things up, answers normal questions and branches into a question sandbox. This expands the study-page recommendation beyond polishing the existing Practice page. No implementation is included in this audit task.

## The connected experience

**Ask → understand context → explain or propose an action → branch into practice → answer in sandbox → get reliable feedback → return to chat → schedule follow-up.**

Example: “I am struggling with Physics. Use my marks and latest notes to prepare me for Friday.” The assistant retrieves official marks, graded practice history, exam and available study time, links its evidence, explains a weak topic, offers a quiz branch, opens the sandbox, saves the attempt, explains errors and proposes an available revision block. These are linked records, not independent page visits with context lost between them.

## Reuse versus rebuild

The current app already has `/ask` (saved chat, live schedule context, provider fallback, Markdown), `/ai` (source-based question generation and runners), SubjectBuddy and contextual AI, domain actions and year/archive boundaries. Extend those seams into one connected workspace. Prefer `/ask` as the chat-first Study entry with `/ai` retaining direct Practice/sandbox access initially; a new canonical route is only worthwhile if the architecture benefits, and existing links must keep working. `/study` currently redirects; do not resurrect an empty link hub.

Compare two options in implementation planning:

| Option | Benefit | Cost |
|---|---|---|
| Extend existing Ask AI with linked branches/artifacts and embed/reuse runners | Smaller migration, preserves routes/provider code and existing sets | Requires explicit shared workspace state and persisted branch/draft contracts |
| New Study shell that composes the same chat and runner components | Clear top-level workspace model | Larger navigation/state migration; easy to duplicate existing functionality |

Choose the first unless a concrete constraint makes the second simpler. This is ambitious product behavior, not a reason to build speculative infrastructure.

## What it should know

Current year/term and user timezone, subjects, official marks with grading scale, goals, homework due/planned/completed, exams with linked subjects, routine and school lessons, holidays/term bounds, resources, notes/projects, graded practice attempts and actual recorded focus sessions. Distinguish official results from practice and self-rated flashcards. Context must be refreshed from authorized queries; summaries alone cannot answer detailed mark-history questions.

Use a compact snapshot plus bounded read tools. Materialize relevant record links/provenance in replies. Limit retrieved rows/text and explain missing/unavailable data. Scope every query by user and selected year; archives can be consulted explicitly but not written. Private keys and unrelated users never enter prompts. Uploaded material is untrusted source content, not tool authorization.

## What it should do

Initial tools: create/move a study block, propose routine edits, plan homework, propose conflict-aware revision blocks, generate a quiz/mock exam/cards from selected content, open the relevant artifact/page. Later expand to other existing app actions only after contracts/tests exist.

Typed read tools and proposed writes use existing domain actions after their audit defects are fixed. Show an understandable action card with exact changes, Apply where review is needed, success/failure receipt and links/undo when supported. Validate again at execution, check stale versions, use idempotency and transactional multi-row changes. A successful write must remain visible even if the subsequent model response fails. No mutation tools are available in question-generation/grading calls.

## Branches and artifacts

Persist parent conversation and message, inherited context policy, subject/source references, generated artifact and draft/attempt identity. Inherit parent history only through the selected branch message, never later turns, and enforce same-owner/year ancestry. Branch types can begin with Explain, Quiz, Mock exam and Flashcards. Preserve the parent conversation; branch independently and return with an evidence-backed summary. Provide a simple list/breadcrumb initially; a complex graph editor is optional, not a prerequisite.

Sandbox: existing one-question UI plus reliable deadline, Previous/question navigator/flags, unanswered review, autosave and Resume. Exam responses should not expose expected answers before submission. Results track marking status and separate provisional from final score, explain mistakes, offer retry grading and link to a proposed follow-up block. Card reviews need an actual due queue and exactly-once updates. Official school marks change only through an explicit separate action.

## Layout

Wide: conversation list at left, central chat, collapsible context/artifact panel at right. Sandbox expands into the main area while the parent chat remains reachable. Phone/short-height/zoom: drawers or tabs with reachable controls and preserved drafts. Retain existing fonts, tokens, rail and user-approved schedule layout. Add source links, clear provider/current-year status and robust empty/loading/error/offline/archive states. Avoid filling the workspace with decorative dashboard widgets.

## Delivery slices

1. Foundation repairs: trustworthy marks/years/dates/ownership/backup/grading and durable attempts. Read-only assistant can ship without app-write tools.
2. Grounded chat: explain ordinary topics and app-specific questions using scoped marks/deadline/resource reads; correct retry/new-chat/cancel behavior.
3. First complete branch: choose a resource in chat → generate quiz → sandbox → save/mark → result summary back in parent. Preserve/recover every intermediate state.
4. Proposed actions: chat → feasible revision plan preview → apply idempotently → visible Today/Week/Month changes → useful receipt.
5. Expand to mock exams, due cards, targeted mistake practice and richer setup tools; then refine navigation/appearance with screenshots.

Model/sync/backups must evolve together. Current TutorModule/QuizAttempt practice data is local-only in the sync registry, so cross-device branch promises require an explicit sync decision. Reuse the existing provider chain; support models without reliable tool calling by structured proposals validated server-side. Do not claim the assistant knows every file when it is inaccessible or unprocessed.

## Acceptance scenarios

- It answers “What should I study tonight?” with current marks/deadlines and record links; it says when data is missing.
- It reads 18/20 as 90% consistently and never turns unmarked work into failure.
- A selected existing file produces a linked practice branch without reupload when available.
- Refresh/close/reopen resumes the correct conversation, branch and question draft.
- Returning to the original chat retains both histories and grounded attempt results.
- A plan respects lessons, holidays, term bounds and overnight conflicts; retry does not duplicate tasks.
- Write failure yields an honest receipt; finished years and other users are protected.
- Written grading failure preserves answers and permits retry without repeated XP.
- It remains usable on laptop/mobile, keyboard, dark mode and short/zoomed viewports.

For full repair checklist and evidence, read `FULL_AUDIT_2026-10-05.md`; for the paste-ready implementation request, read `../CLAUDE_FIX_PROMPT_2026-10-05.md`.
