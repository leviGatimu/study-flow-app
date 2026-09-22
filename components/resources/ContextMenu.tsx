"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * A right-click menu anchored to a point.
 *
 * Hand-rolled rather than Radix's ContextMenu because the explorer opens the
 * SAME menu from three places - a right-click, a tile's "..." button and the
 * keyboard - and only one of those has a trigger element. The desktop shell
 * suppresses the native menu at the window, which runs after React's handler,
 * so a preventDefault here is enough for both.
 */

export type MenuEntry =
  | { kind: "item"; label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: string }
  | { kind: "separator" };

export function ContextMenu({
  at,
  entries,
  onClose,
}: {
  at: { x: number; y: number } | null;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Keep the menu on screen: flip left/up when it would overflow.
  useLayoutEffect(() => {
    if (!at || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = at.x + rect.width > window.innerWidth - 8 ? Math.max(8, at.x - rect.width) : at.x;
    const y = at.y + rect.height > window.innerHeight - 8 ? Math.max(8, at.y - rect.height) : at.y;
    setPos({ x, y });
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Any click outside, a scroll, or a resize dismisses it - the same rules
    // Explorer uses.
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [at, onClose]);

  useEffect(() => {
    if (at) ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [at, pos]);

  if (!at || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y, visibility: pos ? "visible" : "hidden" }}
      className="fixed z-[200] min-w-[200px] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) =>
        entry.kind === "separator" ? (
          <div key={i} className="my-1 h-px bg-border" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
              "hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40",
              entry.danger && "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
            )}
          >
            {entry.icon && <span className="[&_svg]:size-4 text-muted-foreground">{entry.icon}</span>}
            <span className="flex-1">{entry.label}</span>
            {entry.shortcut && <span className="text-[11px] text-muted-foreground">{entry.shortcut}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  );
}
