# UI contract

The dashboard (`app/page.tsx`) is the reference. Every other page follows it.
These are the actual class strings in use, not adjectives — copy them exactly.

An earlier attempt to restyle several pages at once was rejected outright
("RETURN IT TO HOW IT WAS BEFORE... KEEP IT SAME UI BUT POLISH"). That failed
because each page was reinvented. This contract exists so alignment means
*converging on one thing* rather than applying taste.

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

`font-black` is reserved for large hero **numbers** only (a countdown, a streak
count). Never on a heading, never on a label.

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

## Off limits

`components/TaskList.tsx`, `components/LiveFocusCard.tsx`,
`components/DailyQuote.tsx`, `components/MemoryGuard.tsx`,
`components/FocusSessionUI.tsx`, `components/ui/**`, and the marketing tier
(`app/welcome`, `app/login`, `app/register`, `components/landing/**`).
