"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Feather, HeartPulse, Leaf, type LucideIcon, MessageCircleHeart, StickyNote, Wind, X } from "lucide-react";

import {
  CALM_STORAGE,
  clampNote,
  loadJson,
  MAX_SCRATCH_NOTES,
  NOTE_COLORS,
  readScratchNotes,
  saveJson,
  SCRATCH_NOTE_SIZE,
  type ScratchNote,
} from "@/lib/calm-tools";
import { cn } from "@/lib/utils";
import { CalmRoom } from "./CalmRoom";
import { ScratchNotes } from "./ScratchNotes";
import { BodyReset, CalmWords } from "./panels";
import { TalkItOut } from "./TalkItOut";

type ToolId = "note" | "calm" | "talk" | "body" | "words";

/**
 * The tools in the fan, bottom (nearest the circle) first. To drop or swap a
 * tool, edit this list.
 */
const TOOLS: { id: ToolId; label: string; icon: LucideIcon }[] = [
  { id: "note", label: "Pull out a sticky note", icon: StickyNote },
  { id: "calm", label: "Calm room", icon: Wind },
  { id: "talk", label: "Talk it out", icon: MessageCircleHeart },
  { id: "body", label: "Body reset", icon: HeartPulse },
  { id: "words", label: "Calm words", icon: Feather },
];

const PANEL_TITLES: Partial<Record<ToolId, string>> = {
  talk: "Talk it out",
  body: "Body reset · 2 minutes",
  words: "Calm words",
};

/**
 * The round button in the bottom-right corner. Hover (or tap) it and small
 * tools fan out above it, for when studying gets too much. Everything here is
 * kept on this device only.
 */
export function CalmToolbar() {
  const pathname = usePathname() ?? "/";
  const [fanOpen, setFanOpen] = useState(false);
  const [panel, setPanel] = useState<ToolId | null>(null);
  const [calmOpen, setCalmOpen] = useState(false);
  // Rendered client-only (see AppShell), so storage can be read up front.
  const [notes, setNotes] = useState<ScratchNote[]>(() => readScratchNotes(loadJson(CALM_STORAGE.notes, [])));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unpinned notes belong to the page they were made on: leaving it closes them.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    const from = lastPath.current;
    lastPath.current = pathname;
    setNotes((current) => {
      const next = current.filter((n) => n.pinned || n.page !== from);
      if (next.length !== current.length) saveJson(CALM_STORAGE.notes, next);
      return next;
    });
  }, [pathname]);

  const saveNotes = useCallback((update: (current: ScratchNote[]) => ScratchNote[]) => {
    setNotes((current) => {
      const next = update(current);
      saveJson(CALM_STORAGE.notes, next);
      return next;
    });
  }, []);

  const changeNote = useCallback(
    (id: string, patch: Partial<ScratchNote>) => saveNotes((c) => c.map((n) => (n.id === id ? { ...n, ...patch } : n))),
    [saveNotes],
  );
  const removeNote = useCallback((id: string) => saveNotes((c) => c.filter((n) => n.id !== id)), [saveNotes]);

  const pullOutNote = () => {
    if (notes.length >= MAX_SCRATCH_NOTES) {
      toast.error(`You have ${MAX_SCRATCH_NOTES} notes out. Remove one first.`);
      return;
    }
    // Cascade new notes so they never land exactly on top of each other.
    const offset = (notes.length % 6) * 28;
    const pos = clampNote(
      {
        x: window.innerWidth - SCRATCH_NOTE_SIZE.width - 120 - offset,
        y: window.innerHeight - SCRATCH_NOTE_SIZE.height - 140 - offset,
      },
      { width: window.innerWidth, height: window.innerHeight },
    );
    const note: ScratchNote = {
      id: crypto.randomUUID(),
      text: "",
      color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
      ...pos,
      pinned: false,
      page: pathname,
    };
    saveNotes((c) => [...c, note]);
  };

  const choose = (id: ToolId) => {
    setFanOpen(false);
    if (id === "note") {
      setPanel(null);
      pullOutNote();
    } else if (id === "calm") {
      setPanel(null);
      setCalmOpen(true);
    } else {
      setPanel((p) => (p === id ? null : id));
    }
  };

  // Esc closes the fan or the panel; a click elsewhere closes the fan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || calmOpen) return;
      if (fanOpen || panel) {
        setFanOpen(false);
        setPanel(null);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFanOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [fanOpen, panel, calmOpen]);

  const hoverOpen = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!panel) setFanOpen(true);
  };
  const hoverClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setFanOpen(false), 250);
  };

  const onMenuKey = (e: React.KeyboardEvent, index: number) => {
    const last = TOOLS.length - 1;
    // The fan grows upwards, so Up moves away from the circle.
    const next =
      e.key === "ArrowUp" ? Math.min(last, index + 1)
      : e.key === "ArrowDown" ? index - 1
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    if (next < 0) triggerRef.current?.focus();
    else itemRefs.current[next]?.focus();
  };

  // The focus room has its own tools and its own full-screen canvas.
  if (pathname.startsWith("/focus")) return null;

  return (
    <>
      <ScratchNotes notes={notes} pathname={pathname} onChange={changeNote} onRemove={removeNote} />
      {calmOpen && <CalmRoom onClose={() => { setCalmOpen(false); triggerRef.current?.focus(); }} />}

      <div
        ref={rootRef}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 md:right-6 md:bottom-6"
        onMouseEnter={hoverOpen}
        onMouseLeave={hoverClose}
      >
        <AnimatePresence>
          {panel && (
            <motion.section
              key={panel}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              aria-label={PANEL_TITLES[panel]}
              className={cn(
                "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl",
                panel === "talk" ? "w-[min(24rem,calc(100vw-2rem))]" : "w-[min(22rem,calc(100vw-2rem))]",
              )}
              onMouseEnter={() => hoverTimer.current && clearTimeout(hoverTimer.current)}
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{PANEL_TITLES[panel]}</h3>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  aria-label="Close"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </header>
              {panel === "talk" && <TalkItOut />}
              {panel === "body" && <BodyReset />}
              {panel === "words" && <CalmWords />}
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {fanOpen && !panel && (
            <motion.div
              id="calm-tools-menu"
              role="menu"
              aria-label="Calm tools"
              aria-orientation="vertical"
              className="flex flex-col-reverse items-end gap-2 pr-1.5"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{ open: { transition: { staggerChildren: 0.03 } }, closed: {} }}
            >
              {TOOLS.map((tool, i) => (
                <motion.div
                  key={tool.id}
                  variants={{ open: { opacity: 1, y: 0, scale: 1 }, closed: { opacity: 0, y: 10, scale: 0.8 } }}
                  transition={{ duration: 0.15 }}
                  className="group flex items-center gap-2"
                >
                  <span className="pointer-events-none rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border">
                    {tool.label}
                  </span>
                  <button
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role="menuitem"
                    aria-label={tool.label}
                    onClick={() => choose(tool.id)}
                    onKeyDown={(e) => onMenuKey(e, i)}
                    className="grid size-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <tool.icon className="size-[18px]" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <button
            ref={triggerRef}
            type="button"
            aria-label="Calm tools"
            aria-haspopup="menu"
            aria-expanded={fanOpen}
            aria-controls={fanOpen ? "calm-tools-menu" : undefined}
            onClick={() => {
              if (panel) {
                setPanel(null);
                return;
              }
              setFanOpen((o) => !o);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" && fanOpen) {
                e.preventDefault();
                itemRefs.current[0]?.focus();
              }
            }}
            className={cn(
              "grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              (fanOpen || panel) && "scale-105",
            )}
          >
            {fanOpen || panel ? <X className="size-5" /> : <Leaf className="size-6" />}
          </button>
        </div>
      </div>
    </>
  );
}
