# StudyFlow UI Fix Prompt

You are fixing a Next.js 14 (App Router) study tracker app. A full UI audit has been completed. Work through every issue below in order of severity. After each fix, briefly note what you changed.

---

## 🔴 CRITICAL

### 1. `app/projects/page.tsx` — Dialog never opens
The file is a Server Component but contains a Radix `Dialog`. Extract `DialogTriggerButton` into a new file `app/projects/DialogTriggerButton.tsx` with `"use client"` at the top. Import it back into the server component. Both the header button and the empty-state button use this component.

---

## 🟠 HIGH PRIORITY

### 2. `app/calculator/page.tsx` — Broken on mobile
Remove `min-w-[760px]` from the main panel. Make the calculator layout responsive:
- On small screens, hide the history/memory sidebar by default (collapsed)
- The scientific panel should also be hidden by default on mobile
- Ensure the calculator doesn't overflow horizontally at any viewport width

### 3. `components/StickyNotesContainer.tsx` — Notes escape the board
In the `handleDragEnd` function, clamp the new X/Y so a note can never be positioned outside the board boundaries. Use the board ref dimensions:
```js
const newX = Math.max(0, Math.min(note.x + info.offset.x, board.clientWidth - 280));
const newY = Math.max(0, Math.min(note.y + info.offset.y, board.clientHeight - 280));
```

### 4. `components/StickyNotesContainer.tsx` — Freshly-created note positions silently lost
After `createStickyNote()` resolves and returns the real note, replace the temp note in state with the real one (real ID, same position). This way if the user drags it before refreshing, the next drag save will work. Refetch or return the new note object from the server action and do a state swap.

### 5. `components/LiveFocusBanner.tsx` — Banner overlaps focus session
Change the early-return condition from:
```js
if (!activeTask || step !== 'FOCUS' || pathname === '/') return null;
```
to:
```js
if (!activeTask || step !== 'FOCUS' || pathname === '/' || pathname.startsWith('/focus')) return null;
```

### 6. `components/StickyNotesContainer.tsx` — Dark mode: hardcoded black text
Replace all hardcoded `text-black/*` and `text-black` classes in the empty state and note footer with theme-aware equivalents:
- `text-black/40` → `text-foreground/40`
- `text-black/30` → `text-foreground/30`
- `text-black/20` → `text-foreground/20`
- `text-black/80` → `text-foreground/80`
Also fix the inline `backgroundColor` in note items: the `isDone` gray `#e5e7eb` is hardcoded light-mode only. Use a CSS variable or `hsl(var(--muted))` instead.

### 7. `app/streak/page.tsx` — "undefined days straight"
Change:
```jsx
You've stayed focused for {userProgress?.currentStreak} days straight.
```
to:
```jsx
You've stayed focused for {userProgress?.currentStreak ?? 0} days straight.
```
Apply the same `?? 0` fallback to every other `userProgress?.` reference on the page.

### 8. `app/projects/[projectId]/ProjectInterface.tsx` — No unsaved changes warning
Add a `hasUnsavedChanges` state that goes `true` when `docContent` or `docTitle` changes but the user hasn't saved. Show a small `"Unsaved changes"` indicator next to the Save button. Add a `useEffect` with a `beforeunload` event listener that fires a warning when there are unsaved changes. Also warn when the user clicks a different doc in the sidebar without saving.

---

## 🟡 MEDIUM PRIORITY

### 9. `components/LiveFocusBanner.tsx` — Wrong progress bar math
The banner needs to know the total session duration, not assume 1 hour. Pass the task's `startTime` and `endTime` down to the banner (or compute total seconds from them). Replace `/ 3600` with `/ totalSessionSeconds` where `totalSessionSeconds` is derived from `endTime - startTime`.

### 10. `app/calculator/page.tsx` — Dead Menu button
Either wire the `<Menu>` button to toggle the sidebar collapse (move the `isExpandedSidebar` toggle there instead of the ChevronRight button), or remove the button entirely. Don't leave a dead UI element.

### 11. Replace all `confirm()` dialogs with `ConfirmModal`
The following files use native `confirm()` — replace every instance with the existing `<ConfirmModal>` component (already in `components/ConfirmModal.tsx`):
- `components/MasteryList.tsx` — delete topic confirmation
- `app/projects/[projectId]/ProjectInterface.tsx` — delete document confirmation
- `components/ExamCountdown.tsx` — delete event confirmation

Each needs its own `isConfirmOpen` state + `ConfirmModal` instance.

### 12. `app/welcome/WelcomeClient.tsx` — 800vh blank scroll on mobile
Both `SplitStorytelling` and `HorizontalScrollCarousel` use `h-[400vh]`. Their visual content is hidden on mobile (`hidden md:block`). Fix by making the section height conditional:
- Add a check: on mobile, reduce `SplitStorytelling` to `h-auto` and remove the sticky scroll entirely, showing just the text blocks stacked.
- For `HorizontalScrollCarousel`, on mobile switch from horizontal sticky scroll to a standard vertical card stack.
The simplest approach: wrap the scroll-height sections in `<div className="h-[400vh] md:h-[400vh] h-auto">` and disable the sticky/transform on mobile.

### 13. `app/streak/page.tsx` — Calendar needs month navigation
Add `currentMonth` state (default: `new Date()`). Add prev/next buttons next to the month heading. Recompute `monthStart`, `monthEnd`, `calendarDays` from `currentMonth`. The `activeDates` query already fetches all completed tasks, so no new API call is needed — just filter by the viewed month.

### 14. `app/projects/[projectId]/ProjectInterface.tsx` — AI panel close button
Replace:
```jsx
<Plus className="w-5 h-5 rotate-45" />
```
with:
```jsx
<X className="w-5 h-5" />
```
`X` is already imported in the file.

### 15. `app/projects/[projectId]/ProjectInterface.tsx` — Hardcoded model name
Remove the hardcoded `"Gemini 2.5 Flash"` label. Replace with a generic `"AI Assistant"` or fetch/pass the active provider name as a prop from the server component.

### 16. `app/ai/AIKeyPrompt.tsx` — `window.location.reload()` after key save
Replace `window.location.reload()` with:
```js
import { useRouter } from 'next/navigation';
const router = useRouter();
// ...
router.push('/');
router.refresh();
```

### 17. `components/StreakCelebration.tsx` — No way to skip animation + undefined stats
Add a click handler to the fire animation screen that immediately advances to the stats card:
```jsx
<motion.div onClick={() => setShowStats(true)} className="cursor-pointer ...">
```
Add a small "tap to skip" hint at the bottom.
Fix undefined stats:
```jsx
{stats?.tasksCompleted ?? '–'}/{stats?.totalTasks ?? '–'}
{stats?.focusMinutes ?? 0}m
+{stats?.xpEarned ?? 0} XP
```

### 18. `app/welcome/WelcomeClient.tsx` — Inconsistent card heights in carousel
Change the first `HorizontalScrollCarousel` card from `h-[450px]` to `h-[500px]` to match the other three cards.

### 19. `app/welcome/WelcomeClient.tsx` — BentoGrid mobile overflow
On the `md:col-span-2 lg:col-span-2 row-span-2` Command Center card, remove `row-span-2` on mobile by using `md:row-span-2` instead:
```jsx
className="md:col-span-2 lg:col-span-2 md:row-span-2 ..."
```

### 20. Bundle external textures locally
Download these two texture PNGs and save them to `/public/textures/`:
- `https://www.transparenttextures.com/patterns/cork-board.png` → `/public/textures/cork-board.png`
- `https://www.transparenttextures.com/patterns/carbon-fibre.png` → `/public/textures/carbon-fibre.png`
- `https://www.transparenttextures.com/patterns/cubes.png` → `/public/textures/cubes.png`
- `https://www.transparenttextures.com/patterns/paper-fibers.png` → `/public/textures/paper-fibers.png`

Then replace all external URLs in:
- `app/notes/page.tsx`
- `app/tutor/TutorClient.tsx`
- `app/welcome/WelcomeClient.tsx`
- `components/StickyNotesContainer.tsx`

---

## 🔵 LOW PRIORITY

### 21. Add `aria-label` to all icon-only buttons
Add `aria-label` (or `title` as a minimum) to every button that has only an icon child and no text. Key locations:
- Calculator sidebar: Menu, FE toggle, Activity (scientific mode), Settings link
- Sticky notes: color swatch filter buttons, each note action button (Edit, Done, Promote, Delete) — replace `title` with proper `aria-label`
- Exam countdown: the `+` add button → `aria-label="Add exam event"`
- Project sidebar: the `+` create doc button → `aria-label="Create new document"`

### 22. `components/ProgressWidget.tsx` — Fix conflicting display classes
Remove the `block` class — `flex` already sets `display: flex`. The `block` is redundant and confusing.

### 23. Verify `success` color token exists in Tailwind config
Check `tailwind.config.ts` for a `success` color definition. If it doesn't exist, add it:
```js
colors: {
  success: 'hsl(142 76% 36%)', // or whatever green fits the design
}
```
This fixes `border-success`, `text-success`, `bg-success/5` in `ProgressWidget` and `MasteryList`.

### 24. `app/school/page.tsx` — Remove hardcoded username gate
Add an `isAdmin` boolean field (or similar) to the User model in Prisma schema. Set it `true` for the intended user via a seed/migration. Replace the `username === 'levi'` check with `user?.isAdmin !== true`. Also remove the hardcoded "for Levi" from the subtitle — use the actual username dynamically: `for ${user.username}`.

### 25. `app/calculator/page.tsx` — Add tooltip to FE button
```jsx
<Button title="Toggle fixed-point / engineering notation" ...>
  FE
</Button>
```

### 26. Standardize z-index scale
In `tailwind.config.ts`, add a custom z-index scale:
```js
extend: {
  zIndex: {
    'banner': '40',
    'sidebar': '50',
    'modal': '60',
    'celebration': '70',
    'toast': '80',
  }
}
```
Then replace raw z-index values (`z-[100]`, `z-[999]`, etc.) with semantic tokens across the codebase.

### 27. `app/ai/AIKeyPrompt.tsx` — Left panel dark regardless of theme
If the dark panel is intentional (marketing contrast panel), add a comment saying so. If it should adapt to theme, replace the hardcoded `from-slate-950 via-slate-900 to-slate-800 text-white` gradient with theme-aware card colors.

---

## After all fixes

1. Run `npm run build` and confirm zero type errors and no hydration warnings in the console.
2. Test the Projects page — both Add Project buttons should open the dialog.
3. Test in dark mode — sticky notes board should have readable text everywhere.
4. Test on a 375px viewport — calculator should not overflow, landing page should not have excessive blank space.
5. Test the focus banner — start a focus session, navigate to `/focus/[taskId]` — the banner should NOT appear over the focus UI.
