# UI Audit Report — StudyFlow
**Date:** 2026-06-04  
**Scope:** Full codebase review — all pages, components, and cross-cutting patterns  
**Severity scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

---

## Executive Summary

The app is visually ambitious and has strong design direction. The core issues fall into five buckets: **broken interactivity** (server components that use client-only APIs), **mobile overflow** (calculator, sticky notes, giant typography), **dark-mode gaps** (hardcoded light colors), **inconsistent destructive UX** (`confirm()` vs `ConfirmModal`), and **accessibility blind spots** (icon-only buttons with no labels).

---

## 1. Projects Hub — `app/projects/page.tsx`

### 🔴 Dialog doesn't open (server component has no `"use client"`)
`DialogTriggerButton` lives in a Server Component file and wraps a Radix `Dialog`. The `<DialogTrigger>` requires a client boundary to register click handlers. The "START NEW PROJECT" button will silently fail — no dialog opens. The component either needs to be moved to a separate `"use client"` file or wrapped in a client boundary.

### 🟠 Empty-state dialog has the same breakage
The empty-state also renders `<DialogTriggerButton />` — same issue. Both Add Project buttons are non-functional.

---

## 2. Calculator — `app/calculator/page.tsx`

### 🟠 Completely broken on mobile / small windows
The main panel has `min-w-[760px]` hardcoded. On any viewport narrower than ~840px (760 + 16px sidebar + 450px history panel) the calculator will overflow horizontally with no scrolling managed. On a laptop at 1024px it is tight; on a phone it is unusable.

### 🟠 Dead UI element — Menu button does nothing
The `<Menu>` icon button in the left sidebar has no `onClick` handler. Clicking it produces no response. Either wire it up or remove it.

### 🟡 Progress bar is wrong for non-60-minute sessions
In `LiveFocusBanner`, the progress bar width is calculated as:
```
(timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s) / 3600
```
This hardcodes a 1-hour total. A 30-minute session will show the bar at 50% at the start. A 2-hour session will start at 200%. The total session duration needs to be passed down and used as the divisor.

### 🟡 "FE" toggle has no tooltip or label
The floating "FE" button in the sidebar (fixed-point / engineering notation toggle) is text-only with no explanation. New users have no idea what it does. Add a `title` attribute or a tooltip.

### 🟡 Trash button ambiguity
The `Trash2` button in the sidebar header clears history **or** memory depending on which tab is active. There's no label change or confirmation prompt — a user on the History tab clicking it will nuke their entire calculation log without warning.

### 🔵 `h-[calc(100vh-2rem)]` brittle height
The calculator assumes it occupies `100vh - 2rem`. If the surrounding layout wrapper adds padding or a banner, the layout will clip or overflow. Use `flex-1 overflow-hidden` relative to the layout container instead.

---

## 3. Sticky Notes — `app/notes/page.tsx` + `components/StickyNotesContainer.tsx`

### 🟠 Notes escape the board permanently
Notes use absolute pixel coordinates. A user can drag a note past the board boundaries, and since the board has `overflow-hidden`, the note vanishes. There's no "recenter" button and no boundary clamping on drag end. Notes can be permanently lost.

### 🟠 Freshly-created note positions are silently discarded
After `createStickyNote()` resolves, the temporary ID note is never replaced with the real database record. The code comments note: *"a refresh will sync them if they are off."* However, if the user drags the new note before refreshing, the drag calls `updateStickyNotePosition(id, ...)` but the guard `if (!id.includes("."))` skips saving because temp IDs contain ".". The position is lost silently — no feedback is shown.

### 🟠 Dark mode: hardcoded black text in the empty state
The empty board state uses `text-black/40` and `text-black/30` — these are invisible in dark mode. Use `text-foreground/40` instead.

### 🟡 External texture dependency is a runtime failure point
The board background uses `bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')]`. If that site is unavailable, the board renders as a flat beige/dark color with no visual distinction. The texture should be bundled locally in `/public`.

### 🔵 Copy issue: "Stick Note" vs "Sticky Note"
The "Add" button says **"Stick Note"** — should probably be "Sticky Note" or just "Add Note".

### 🔵 Color filter buttons have no accessible labels
The color-swatch filter buttons have no `aria-label`. Screen readers announce them as unlabeled buttons.

---

## 4. Streak Page — `app/streak/page.tsx`

### 🟠 "undefined" renders in motivational copy when data is null
The paragraph:
```jsx
<p>You've stayed focused for {userProgress?.currentStreak} days straight.</p>
```
When `userProgress` is null/undefined (e.g. first visit, API error), this renders: *"You've stayed focused for undefined days straight."* Should use `|| 0` or a conditional.

### 🟡 Calendar overflows on small screens
The calendar uses `grid grid-cols-7 gap-4`. At the `lg:col-span-7` width it works, but the `gap-4` (16px) on 7 columns leaves very little room for each day cell. On tablets or when the window is narrowed, the day numbers clip or bleed. Reduce gap to `gap-2` or use responsive gap values.

### 🟡 No calendar navigation (previous/next month)
The calendar is static — it only shows the current month. Users cannot review past activity. The "activity history" data is fetched for all time but only the current month is visually shown. Add month navigation.

### 🔵 "Mastery Engine" heading hidden on mobile
`hidden md:block` — fine, but leaves an empty header area on mobile. Consider removing entirely on small screens.

---

## 5. Project Interface — `app/projects/[projectId]/ProjectInterface.tsx`

### 🟠 No auto-save warning — edits are lost silently
The document editor has a manual Save button. If the user navigates away or clicks a different document without saving, all edits are lost with no prompt. Add a `beforeunload` warning or implement auto-save with debounce.

### 🟡 AI panel close button is semantically wrong
```jsx
<Plus className="w-5 h-5 rotate-45" />
```
Using a rotated Plus as an X icon is a common pattern but the component already has `<X />` imported. Use `<X />` directly for clarity and accessibility.

### 🟡 Hardcoded model name in UI
The AI panel header hardcodes `"Gemini 2.5 Flash"`. If the backend switches providers (e.g. to OpenAI), this label becomes wrong. The active provider/model should be passed as a prop or fetched dynamically.

### 🟡 `confirm()` for document deletion
```jsx
if (confirm('Delete document?'))
```
Uses native browser `confirm()` — inconsistent with `ConfirmModal` used in other parts of the app. This also blocks the JS thread.

### 🔵 Document title input has no accessible label
The title `<input>` has no `<label>` or `aria-label`. Screen readers get no context.

---

## 6. Focus Hub — `app/focus/page.tsx`

### 🟡 Cards have mismatched heights in the 2-column grid
The "Free Focus" card has a full-height button section (`space-y-6` + `mt-4` button), while "Deep Focus Tips" has only 2 list items with no equivalent content. The cards are uneven in height due to unequal content density — use `h-full` on both cards and `flex flex-col justify-between` to equalize.

### 🔵 Only 2 focus tips — card feels sparse
The tips array has just 2 items. The card has room for 3-4. Either add more tips or shrink the card.

### 🔵 `task.startTime` renders raw without null guard
If `task.startTime` is empty or `null`, the time display renders nothing inside the styled box — leaving a blank styled box. Add a fallback: `{task.startTime || '--:--'}`.

---

## 7. Live Focus Banner — `components/LiveFocusBanner.tsx`

### 🟠 Banner shows on top of the Focus Session page itself
The banner hides only on `pathname === '/'`. The full-screen focus session is at `/focus/[taskId]`. If a user has the banner active and navigates to the focus page, the banner overlays the immersive focus UI. Add `/focus` to the exclusion check:
```js
if (!activeTask || step !== 'FOCUS' || pathname === '/' || pathname.startsWith('/focus')) return null;
```

---

## 8. Exam Countdown — `components/ExamCountdown.tsx`

### 🟡 Nested `<a>` tags — invalid HTML
The "Other Milestones" list wraps each item in a `<Link>` (renders as `<a>`), and the card title is also a `<Link>`. These are not nested, so it's okay in the title — but double check that the delete `Button` inside the list `Link` doesn't produce a button-inside-anchor warning.

### 🟡 `confirm()` for delete — inconsistent UX
Same issue as ProjectInterface — uses native browser `confirm()` instead of `ConfirmModal`.

### 🔵 Add exam button is hard to discover
A small, borderless ghost `+` icon in the top-right of the card. No tooltip, no label, blends into the card header. First-time users will miss it.

---

## 9. Welcome / Landing Page — `app/welcome/WelcomeClient.tsx`

### 🟠 Mobile gets 400vh of blank space from hidden scroll section
`SplitStorytelling` and `HorizontalScrollCarousel` are `h-[400vh]` each. The right-panel visual content is `hidden md:block`, but the scroll height still applies on mobile. This means mobile users scroll through 800vh of mostly-blank space before reaching the CTA. The section heights should be reduced or conditionally set via JS for mobile.

### 🟡 Inconsistent card heights in horizontal carousel
Cards in `HorizontalScrollCarousel`: first card is `h-[450px]`, the other three are `h-[500px]`. The first one being shorter looks like a mistake. Make all `h-[500px]`.

### 🟡 BentoGrid large box is 600px tall on mobile
The `md:col-span-2 row-span-2` card (Command Center) at `auto-rows-[300px]` expands to 600px on screens with a single column. At `grid-cols-1`, `row-span-2` doubles the row height — the card becomes very tall with large empty placeholder boxes at the bottom. Remove `row-span-2` on mobile or adjust the grid.

### 🟡 External CDN textures loaded in fixed overlays
Carbon fibre and cube textures are fetched from `transparenttextures.com` and applied via `fixed inset-0` overlays. These are network requests that can fail, aren't cached by the service worker, and add latency to the first paint. Bundle them in `/public`.

### 🔵 `mix-blend-difference` on the logo creates contrast issues
The nav logo uses `mix-blend-difference` — this inverts colors depending on the background. On mid-tone backgrounds this creates an unreadable gray logo. Use a standard approach with separate light/dark logo variants instead.

---

## 10. AI Key Prompt — `app/ai/AIKeyPrompt.tsx`

### 🟡 Left panel is hardcoded dark regardless of theme
```jsx
className="... bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white ..."
```
This panel will always be dark, even when the app is in light mode. If intentional, document it. If not, add theme-aware colors.

### 🟡 `window.location.reload()` after key save
After a successful key activation, the app calls `window.location.reload()`. This is an abrupt full-page reload that loses any client-side state. Use `router.push('/')` from `next/navigation` instead, which is smoother and maintains the app shell.

### 🔵 No indication of which provider was detected before submission
The form has no real-time validation. Users paste a key and click "Activate" with no preview of which provider will be used. Consider adding basic key-format detection (e.g. keys starting with `sk-` → OpenAI) to show a hint before submit.

---

## 11. Streak Celebration — `components/StreakCelebration.tsx`

### 🟡 No way to skip the 2.8-second animation
The fire animation auto-advances after 2.8 seconds with no skip button. If a user wants to get back to work immediately, they must wait. Add a "skip" or tap-to-advance gesture.

### 🟡 Stats show `undefined` when `stats` prop is null
```jsx
<p>{stats?.tasksCompleted}<span>/{stats?.totalTasks}</span></p>
```
When `stats` is null, these render as `undefined/undefined`. Add fallback values: `stats?.tasksCompleted ?? '–'`.

---

## 12. School Portal — `app/school/page.tsx`

### 🟡 Hardcoded username access control
```js
if (user?.username.toLowerCase() !== 'levi') { return <AccessRestricted /> }
```
And the subtitle says *"Live timetable and lesson tracking for Levi."*  
This is a personal access control gate embedded in UI. If this app is ever shared or multi-user, this will block everyone else with a confusing error. Even for personal use, a username change breaks access. Use a role/permission flag in the database instead.

---

## 13. Cross-Cutting Issues

### 🟠 Inconsistent destructive confirmation UX
`confirm()` is used in: `MasteryList`, `ProjectInterface` (document delete), `ExamCountdown`.  
`ConfirmModal` is used in: `StickyNotesContainer`.  
Pick one pattern and apply it everywhere. The custom `ConfirmModal` is the right choice.

### 🟠 Accessibility: icon-only buttons missing labels
Across the app, dozens of icon-only `<button>` elements lack `aria-label` or `title`:
- Calculator sidebar buttons (Menu, FE, Activity, Settings)
- Sticky note action buttons (Edit, Done, Delete, Promote) — only have `title` attributes
- Color swatch filter buttons — no label
- Exam countdown "+" button — no label  

These are inaccessible to screen reader users.

### 🟡 Z-index chaos
Z-index values used across the app: `z-10`, `z-20`, `z-50`, `z-[100]`, `z-[60]`, `z-[999]`. No centralized scale. This can cause unpredictable stacking when multiple overlays appear simultaneously (e.g. focus banner + modal + celebration overlay). Define a z-index token system in Tailwind config.

### 🟡 Color hardcoding bypasses theme tokens
Many components use literal Tailwind colors (`text-orange-500`, `bg-blue-50`, `text-green-600`) instead of semantic tokens like `text-primary` or CSS variables. When the theme changes, these elements won't update. Audit and replace with semantic tokens where appropriate.

### 🔵 External texture images should be local
`transparenttextures.com` is referenced in at least 4 files:
- `app/notes/page.tsx`
- `app/tutor/TutorClient.tsx`  
- `app/welcome/WelcomeClient.tsx` (carbon fibre + cube)
- `components/StickyNotesContainer.tsx`  

These are third-party runtime dependencies. Bundle the 2–3 textures you actually use in `/public/textures/`.

### 🔵 `ProgressWidget` conflicting display classes
```jsx
className="block bg-card ... flex flex-col ..."
```
`block` and `flex` both set `display`. `flex` wins (last declaration), making `block` redundant and confusing. Remove `block`.

### 🔵 `border-success` / `text-success` may not be defined
`ProgressWidget` and `MasteryList` reference CSS classes like `border-success`, `text-success`, `bg-success/5`. If `success` is not defined in your Tailwind config's `colors`, these compile to empty rules and produce no styling. Verify the color is configured or replace with `border-green-500` / `text-green-600`.

---

## Priority Fix List

| Priority | Issue | File |
|---|---|---|
| 🔴 | Dialog never opens (missing `"use client"`) | `app/projects/page.tsx` |
| 🟠 | Calculator broken on mobile | `app/calculator/page.tsx` |
| 🟠 | Sticky notes escape board / position silently lost | `components/StickyNotesContainer.tsx` |
| 🟠 | Focus banner overlaps focus session page | `components/LiveFocusBanner.tsx` |
| 🟠 | Dark mode: hardcoded black text in notes empty state | `components/StickyNotesContainer.tsx` |
| 🟠 | No save warning in project doc editor | `app/projects/[projectId]/ProjectInterface.tsx` |
| 🟠 | "undefined" in streak motivational copy | `app/streak/page.tsx` |
| 🟡 | Mobile gets 800vh blank scroll on landing page | `app/welcome/WelcomeClient.tsx` |
| 🟡 | Progress bar % wrong for non-1hr sessions | `components/LiveFocusBanner.tsx` |
| 🟡 | Dead "Menu" button in calculator | `app/calculator/page.tsx` |
| 🟡 | `confirm()` dialogs scattered across app | Multiple |
| 🟡 | Icon-only buttons with no `aria-label` | Multiple |
| 🟡 | External textures as runtime dependencies | Multiple |
| 🔵 | Hardcoded username gate in School Portal | `app/school/page.tsx` |
| 🔵 | Z-index values uncoordinated | Global |
