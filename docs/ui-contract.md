# UI contract

The dashboard (`app/page.tsx`) is the reference. Every other page follows it.
These are the actual class strings in use, not adjectives — copy them exactly.

An earlier attempt to restyle several pages at once was rejected outright
("RETURN IT TO HOW IT WAS BEFORE... KEEP IT SAME UI BUT POLISH"). That failed
because each page was reinvented. This contract exists so alignment means
*converging on one thing* rather than applying taste.

## Use the primitives, not the class strings

Since the 2026-09-24 refactor the strings below are baked into components.
A page is assembled from these and should almost never re-type a surface,
heading or empty-state class by hand:

| Component | Import | What it is |
|---|---|---|
| `Page`, `PageBody` | `@/components/ui/page` | The 1600px column + gutter; body at `pt-8 space-y-8` |
| `PageHeader` | `@/components/ui/page-header` | Title (`text-3xl font-bold`), one-sentence description, actions on the right, ruled off like the dashboard hero. Carries its own gutter. |
| `Section` | `@/components/ui/section` | h2 block (`text-2xl font-bold`) with optional actions |
| `Panel`, `PanelTitle` | `@/components/ui/panel` | The card surface; h3 with a `w-5` primary icon and an optional right-side action |
| `ListRow`, `Pill` | `@/components/ui/list-row` | The dashboard's muted row (optionally a link) and its rounded tag |
| `Stat` | `@/components/ui/stat` | Muted label over a `font-black` number |
| `EmptyState` | `@/components/ui/empty-state` | Muted well: title, what to do, an action |
| `ErrorState` | `@/components/ui/error-state` | Plain-words failure + recovery action |
| `PageSkeleton` | `@/components/PageSkeleton` | `loading.tsx` shaped like the page (`grid` / `split` / `list`) |

Page skeleton:

```tsx
<Page>
  <PageHeader title="Homework" description="Everything due, soonest first." actions={<Button>Add homework</Button>} />
  <PageBody>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">...</div>
  </PageBody>
</Page>
```

## Layout

| Thing | Value |
|---|---|
| Page wrapper | `flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16` |
| Horizontal gutter | `px-4 md:px-8` — every page, no exceptions |
| Section spacing | `space-y-8` |
| Grid | `grid grid-cols-1 lg:grid-cols-12 gap-6` |
| Page-mount animation | `animate-in fade-in duration-500` on the outer wrapper only |

## Surfaces

```
bg-card border border-border/60 shadow-sm rounded-2xl p-6
hover:shadow-md transition-shadow duration-200      ← only if the panel is interactive
```

Never an arbitrary radius (`rounded-[32px]`). The scale comes from `--radius`
in `app/globals.css`: `lg` 16px, `xl` 22.4px, `2xl` 28.8px, `3xl` 35.2px.
Panels are `rounded-2xl`. Controls inside them are `rounded-xl`.

## Type

| Role | Class |
|---|---|
| Section heading (h2) | `text-2xl font-heading font-bold tracking-tight text-foreground` |
| Panel heading (h3) | `font-heading font-bold text-lg mb-4 flex items-center gap-2` + a `w-5 h-5` lucide icon |
| Body | `text-sm text-muted-foreground` |
| Label / meta | `text-xs font-medium text-muted-foreground`, **sentence case** |

`font-black` is reserved for large hero **numbers** (a countdown, a streak
count, the clock) and for the dashboard's personal greeting line. Never on a
page title, a section heading, or a label.

> That last exception is real, not a loophole. `components/DynamicGreeting.tsx`
> renders "Good evening, Levi." as a `text-4xl font-heading font-black` h1 on
> the reference page itself. It is a hero line, not a page label — which is why
> `Resource Hub` and `School Portal` are `font-bold` while the greeting is not.
> Seven agents split on this exact question; it is written down so the next one
> does not have to guess.

**Banned:** `text-[10px] uppercase tracking-[0.2em]` micro-labels. Write
"Next exam", not "NEXT EXAM:". Sentence case throughout.

**Never touch fonts.** No `font-family`, no `--font-sans`, no `--font-heading`.
Multiple attempts to change them were rejected.

## Empty states

```
text-sm font-medium text-muted-foreground text-center py-6
bg-muted/50 rounded-2xl border border-border/50
```

Say what is missing and what to do about it — not just "No data".

## Colour

Neutral surfaces, one accent. Use tokens (`bg-primary`, `text-muted-foreground`,
`border-border`) so light and dark both work. Saturated per-widget palettes
(`bg-orange-500` panels, gradient fills) are out unless the colour reports
status — a live timer, an overdue warning.

No decorative glow orbs: `blur-3xl`, `blur-[100px]` and friends behind a card.

## Motion

State feedback only: shadow, colour, opacity, a progress fill. No hover lift,
no hover scale, no press shrink. One duration, one easing (see the motion
budget in `app/globals.css`).

## Accessibility (fix while you are in a file)

- Icon-only buttons need `aria-label`.
- A clickable `div` becomes a `button`, or gains `role`, `tabIndex` and a key handler.
- A visible `<Label>` needs `htmlFor` matched to the input's `id`.

## Buttons

`Button` from `@/components/ui/button`. One `default` (primary) button per
view for the main action; `outline` for secondary; `ghost` for toolbar/icon
actions. Size `lg` in page headers. Do not hand-style `<button>`s to look like
buttons.

## Navigation

`lib/nav.ts` is the only list of destinations. A section's href is its first
page; there are no hub/overview pages that only link to other pages. Sibling
pages are reached through the section pills in every PageHeader, so pages do not
add their own "Back to dashboard" links. Detail pages (an exam, a project)
link back to their list.

## Handle with care

`components/FocusSessionUI.tsx` (the immersive session screen, its own
full-bleed world by design), `components/ui/**` shadcn internals, and the
marketing tier (`app/welcome`, `app/login`, `app/register`,
`components/landing/**`) are not restyled to this contract. Change their
behaviour when a flow needs it; leave their look.
