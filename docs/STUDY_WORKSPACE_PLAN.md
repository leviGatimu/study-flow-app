# Study workspace — plan, contracts and status

Branch `study-workspace` (created 2026-10-05 from `main` with all uncommitted work carried over; nothing committed). Read with `FULL_AUDIT_2026-10-05.md` and `AI_STUDY_WORKSPACE_VISION.md`.

## Constraints that shape everything

- **`npm run dev` talks to the production Supabase database** (verified: `.env` host is the eu-central-1 pooler). Any new column/table breaks the running dev server until the same migration is applied to production. Therefore: repairs that need no schema change go first; schema changes are written as additive migration pairs (`prisma/migrations` + `prisma/migrations-sqlite`) and **not applied** until the owner chooses a dev database or approves a production migration (decision D-1 below).
- Chats (`ChatSession`/`ChatMessage`) and practice (`TutorModule`/`QuizAttempt`) are **LOCAL_ONLY** in `lib/sync/identity.ts` today — they never move between desktop and web. (Correction: an earlier summary said Ask AI chats sync. They do not.)
- Machine memory was 0.3 GB free during this session: no production build was run. Compile safety was checked through the running dev server instead (see Verification).

## Phase 0 — done in this session (no schema change)

| ID | Fix | Proof |
|---|---|---|
| S01 | `lib/marking.ts`: exact normalised blanks (leading article allowed); a miss is UNCERTAIN → written marker, never substring-right. Runner preview uses the same policy. | Old rules reproduced 100% for `a`/database, `not mitochondrion`, `1, 000, 2`; new tests reject all three |
| S09 | Structured answers (JSON arrays/maps). Legacy delimited expected/given answers are decoded against the real options, so `1,000` survives. | `test/marking.test.mjs` |
| S10 | Ordering requires a move or "Keep this order"; an untouched order is unanswered. | test + runner change |
| S02 | Per-answer `status` (MARKED/UNMARKED); score covers marked answers only; attempt is FINAL/PARTIAL/PENDING; only FINAL moves set level/review date or Insights averages; "Mark again" updates the same attempt (XP keyed on it). Missing/non-numeric marker scores stay unmarked. | `summariseAttempt`/`applyWrittenMarks` tests reproduce the audit's 50% case |
| S03 (timer) | Absolute deadline, stable submit via refs, exactly-once auto hand-in. Resume after refresh is S05 (Phase 1). | code; needs browser check |
| S04 | `writableSet`: attempts, re-marking, card generation, reviews and delete refuse archived years; `getStudySet` follows the viewed year. | code; needs two-year fixture test |
| S15 | Every `askAIBuddy` caller now passes `{ tools: false, xp: false }` (report-card/timetable extraction, notes, quizzes, Focus tutor, Project AI, Subject Buddy, Ask AI). Ask AI's prompt no longer offers to schedule. Write tools return in Phase 4 behind the action lifecycle. | grep: no caller without `tools: false` |
| D02 | `lib/grades.ts` — one parser for Marks, Goals, Subjects, Insights and stored averages; impossible values (25/20, 120%) are null, never 0; empty card average is null. `scripts/repair-report-averages.mjs` reports (default) / `--apply`s corrected stored averages. **Not run against production.** | `test/grades.test.mjs` |
| D16 | Purge and its dry run sweep only models with `deletedAt` (`tombstoneModels`). | `test/sync/purge.test.mjs` on real SQLite reproduces the old `Unknown argument deletedAt` failure |
| D17 | `lib/file-access.ts`: `/uploads` (route moved to `app/api/uploads`, URL unchanged via `proxy.ts` rewrite), `/library` and `/api/sync/file` HEAD/POST require that one of the caller's live records references the file. **Also fixed beyond the audit:** the proxy let every path containing a dot skip sign-in, so files in `public/uploads` were served to anyone, signed out, by the dev server (which listens on the LAN). | signed-out GET of a real proof file: 200 before → 401 after. Two-user signed-in test still needed |

### Phase 0b — also done

| ID | Fix | Proof |
|---|---|---|
| D09 | `lib/task-input.ts`: Quick Add saves times exactly as typed (no hidden +3 min), validates subject/HH:MM/type/date at the server; equal start/end refused, overnight allowed; form stays open with the error; a sticky note is removed only after its task really saved; the (disabled) AI tool reports refusals. | `test/task-input.test.mjs` |
| Sync takeover (new, pre-existing) | A pushed row reusing another account's row id overwrote it and moved it to the pusher (probe took over an exam and a chat). `lib/sync/ownership.ts` drops such rows and parent-owned rows (SubjectGrade, ChatMessage, QuizAttempt) whose parent is not the pusher's. | `test/sync/workspace.test.mjs` |
| Migration #1 | **Applied to production 2026-10-05 with the owner's approval**: `20261005120000_study_workspace` (+ SQLite twin using ADD COLUMN, no rebuilds) and Postgres-only `..._sync_backfill`. Chats, messages, sets, attempts, drafts and AI actions now sync (identity rules, APPLY_ORDER, cascades). Client regenerated; dev server restarted by Claude. Read-check OK. | two-device harness test; engine/identity guards updated deliberately |

Known, not mine: the SQLite migration chain already disagreed with `schema.sqlite.prisma` on TutorModule before this work (a rebuild appears in `prisma migrate diff`); left for a separate fix.

### Phase 1 (part) and Phase 2 — done

- **S05/S03/S08** saved runs: `AttemptDraft` + `lib/run-draft.ts`; server-fixed exam deadline; Previous, navigator, flags, hand-in review; Continue / Start over.
- **Phase 2 grounded chat** on `/ask`: retrieval with citations (`lib/copilot-retrieval.ts`, `lib/copilot-citations.ts`), idempotent turns with retry-in-place and Stop (`lib/copilot-turns.ts`), approved layout, provider/year status, Study nav starts at Ask AI. Not done: streaming (provider layer is request/response), live-provider verification.

## Architecture decision

**Extend `/ask` + `/ai`; no new shell.** `/ask` becomes the Study workspace (chat-first), `/ai` stays the direct Practice route and the sandbox implementation. Reasons: chat sessions, provider chain with Ollama fallback, Markdown/KaTeX, schedule context, generation/marking engines and runners already exist; a new shell would duplicate state and routing. `/study` keeps redirecting (to `/ask` once Phase 2 lands). All existing URLs keep working.

### Proposed layout (needs approval — decision D-3)

```
 rail │ Chats            │ Conversation                              │ Context  (collapsible)
──────┼──────────────────┼───────────────────────────────────────────┼─────────────────────
      │ + New chat       │ Year 2 · Term 1 · Gemini ●   [context ⇥] │ TONIGHT
      │ Today            │                                           │ 19:00 Physics HW
      │ ▸ Physics forces │  You  Explain projectile motion           │ DUE SOON
      │    ↳ Quiz · 7/10 │  AI   …markdown + maths…                  │ Lab report · Fri
      │    ↳ Cards       │       Sources: Physics marks · Lab report │ PHYSICS
      │ Yesterday        │       [Branch: Explain │ Quiz │ Mock │ Cards]│ 72% (B-) → goal 80%
      │ ▸ PHP revision   │  ┌ Proposed change ───────────────────┐   │ ARTIFACTS
      │                  │  │ Add 3 PHP revision blocks          │   │ Quiz · Physics · 7/10
      │                  │  │ Wed 19:00-20:00 · Thu … · Fri …    │   │
      │                  │  │ No clashes with lessons   [Apply]  │   │
      │                  │  └────────────────────────────────────┘   │
      │                  │ [ Ask, plan, or attach material…    ↑ ]   │
```

Sandbox (a branch's quiz/mock exam) takes the conversation + context columns; a bar reads `← Back to "Physics forces"` and the chat opens as a slide-over without losing runner state. Under ~1100px: chats and context become drawers; phone: one column with Chats/Context buttons. Existing fonts, rail, tokens and the immersive Focus look are untouched.

## Data contracts (additive; written, not applied, until D-1)

| Change | Fields | Why |
|---|---|---|
| `ChatSession` + | `parentSessionId?`, `parentMessageId?`, `branchKind?` (EXPLAIN/QUIZ/MOCK_EXAM/FLASHCARDS), `artifactId?` (TutorModule), `resultSummary?` | Branches. A branch inherits parent messages **up to and including** `parentMessageId` only; same `userId` and `classId` as its parent (checked on create); deleting a parent soft-deletes its branches (cascade map entry). |
| `ChatMessage` + | `requestId?` (unique per session), `status` (DONE/PENDING/FAILED), `sources?` (JSON record links), `kind` (TEXT/ACTION/RESULT) | Idempotent turns; "retry this turn" re-runs a FAILED message instead of appending; grounded citations; action/result cards in the thread. |
| new `AiAction` | `userId, sessionId, messageId, tool, input (JSON), status (PROPOSED/APPLIED/REJECTED/FAILED/UNDONE), result (JSON: record ids, changed fields, links), idempotencyKey @unique, classId, appliedAt` | Proposal → review → apply lifecycle; receipts survive a failed follow-up reply; retries cannot duplicate. |
| new `AttemptDraft` | `userId, moduleId, mode, answers (JSON), flags (JSON), index, deadlineAt?, classId`, unique `(userId, moduleId, mode)` | S05 resume after refresh/navigation/crash; S03 deadline survives reload. |
| `TutorModule` + | `sourceResourceId?`, `coverage?` (JSON: chars used/total, truncated) | "Use the PDF already in Physics Resources"; honest truncation. |
| `QuizAttempt` + | `markingStatus` (FINAL/PARTIAL/PENDING) | Today derived from feedback JSON; a column makes Insights queries cheap. Backfill from JSON. |
| `Task` unique slot | `(userId, templateId, day)` with a canonical calendar-day column | D05/D06 — depends on the calendar-day contract; designed in Phase 1 after classifying existing rows. |

Every new model: `deletedAt` + soft-delete cascade entries, `classId` scoping, archive write guards, sync identity entry (per D-2), and inclusion in backup v2.

## Phases (each a vertical slice, each ends verified)

1. **Foundation repairs.** D09 exact Quick Add times + server validation; D05 calendar-day contract (classify legacy rows first, no blind shifts); D06 unique generation slot; D07 template edits update untouched future instances; D04 moves keep proof/exam/XP identity; D08 one term-bound rule; D01 backup v2 (versioned, relational, no API keys, preview, transactional restore, legacy-gap disclosure); D03/D13 per-year subject/goal identity; S05/S07 drafts and recovery; S06 project edits; S11 Focus accounting; S12 Notes. *Done when:* each finding has a failing-then-passing test on isolated SQLite (and PostgreSQL where the SQL differs).
2. **Grounded chat.** Compact snapshot + bounded read tools (marks/goals/trends, deadlines, exams, routine/lessons, resources/notes/projects, attempts, focus sessions) with record links; official marks vs practice vs flashcards kept separate; retry-in-place, true New chat reset, cancel, streaming where the provider supports it, preserved drafts, year/provider status. *Done when:* the acceptance questions in the vision doc answer from fixtures with correct links and "I can't see that" when data is missing.
3. **First branch end to end.** Pick a resource in chat → generate quiz (provenance, coverage) → sandbox (navigator, flags, review, autosave/resume, exam answers withheld from the client until hand-in) → mark (FINAL/PARTIAL) → summary posted to the parent → follow-up block proposal. *Done when:* the whole path passes with a deterministic provider mock, plus one live provider run reported separately.
4. **Actions.** Typed registry (read vs propose vs apply), schema validation, real subject/year resolution, conflict detection against lessons/holidays/term bounds/overnight, review card, idempotent transactional apply, receipts and undo where safe. First tools: study block create/move, routine slot, homework planning (fixes D11), revision plan (fixes D10).
5. **Breadth and polish.** Mock exam and flashcard branches, due-today cards, targeted mistake practice, D12/D14/D15, U01-U06, navigation proposal for occasional tools (no removals without the owner's choice), screenshot matrix.

## Verification standard

Per phase: `npx tsc -p tsconfig.check.json --noEmit --incremental false`; `node --test "test/*.test.mjs" "test/sync/*.test.mjs"`; scoped ESLint compared with the 79-error/20-warning baseline (no new findings; touched-flow findings fixed); a dev-server compile check of every changed client component (a type re-export in a `'use server'` file once 500'd every page — tsc does not catch it); deterministic AI mocks; isolated SQLite fixtures. Screenshots/zoom/keyboard and a production build need either memory headroom or the owner's machine time — reported as not done when not done.

## Owner decisions (2026-10-05)

- **D-1 Database: approve each production migration.** One database. Before every schema change, show the owner the exact additive SQL (PostgreSQL + SQLite pair) and apply to production only after an explicit yes; then regenerate the client and restart the dev server with the owner's OK. No other prod writes.
- **D-2 Sync: yes.** Chats, branches, practice sets and attempts (and drafts/action receipts where useful) sync between desktop and web: ID-matched rules in `lib/sync/identity.ts`, syncedAt columns, APPLY_ORDER parents first, harness tests for two diverged devices.
- **D-3 Layout: approved as drawn** (chats | conversation | collapsible context; sandbox takes the main area with a Back-to-chat bar).
