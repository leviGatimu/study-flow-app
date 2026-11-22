"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Pin, PinOff, X } from "lucide-react";

import { clampNote, NOTE_COLORS, SCRATCH_NOTE_SIZE, type ScratchNote } from "@/lib/calm-tools";
import { cn } from "@/lib/utils";

/**
 * Floating paper notes pulled out of the calm toolbar. A pinned note floats
 * over every page; an unpinned one only shows on the page it was made on.
 * The paper colours are fixed pastels with dark text, so they read the same
 * in both themes (like the Notes page).
 */
export function ScratchNotes({
  notes,
  pathname,
  onChange,
  onRemove,
}: {
  notes: ScratchNote[];
  pathname: string;
  onChange: (id: string, patch: Partial<ScratchNote>) => void;
  onRemove: (id: string) => void;
}) {
  const visible = notes.filter((n) => n.pinned || n.page === pathname);

  // A window that shrinks must not strand a note off-screen.
  useEffect(() => {
    const onResize = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      for (const n of notes) {
        const next = clampNote(n, viewport);
        if (next.x !== n.x || next.y !== n.y) onChange(n.id, next);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [notes, onChange]);

  if (visible.length === 0) return null;

  return (
    // The layer itself lets clicks through; only the notes catch them.
    <div className="pointer-events-none fixed inset-0 z-40">
      {visible.map((note) => (
        <NoteCard key={note.id} note={note} onChange={onChange} onRemove={onRemove} />
      ))}
    </div>
  );
}

function NoteCard({
  note,
  onChange,
  onRemove,
}: {
  note: ScratchNote;
  onChange: (id: string, patch: Partial<ScratchNote>) => void;
  onRemove: (id: string) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);

  // A freshly pulled-out note is ready to type in.
  useEffect(() => {
    if (!note.text) textRef.current?.focus();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        left: note.x,
        top: note.y,
        width: SCRATCH_NOTE_SIZE.width,
        height: SCRATCH_NOTE_SIZE.height,
        backgroundColor: note.color,
      }}
      className="pointer-events-auto absolute flex flex-col rounded-md text-slate-900 shadow-lg ring-1 ring-black/10"
      role="group"
      aria-label="Scratch note"
    >
      <DragBar
        note={note}
        onMove={(x, y) => onChange(note.id, clampNote({ x, y }, { width: window.innerWidth, height: window.innerHeight }))}
      >
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(note.id, { color: c })}
              aria-label="Change colour"
              aria-pressed={note.color === c}
              className={cn(
                "size-3.5 rounded-full ring-1 ring-black/20 transition-transform hover:scale-110",
                note.color === c && "ring-2 ring-slate-700",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => onChange(note.id, { pinned: !note.pinned })}
            aria-label={note.pinned ? "Unpin note" : "Pin note to every page"}
            title={note.pinned ? "Pinned: shows on every page. Click to unpin." : "Pin: keep it on every page"}
            className={cn(
              "grid size-6 place-items-center rounded hover:bg-black/10",
              note.pinned ? "text-slate-900" : "text-slate-600",
            )}
          >
            {note.pinned ? <Pin className="size-3.5 fill-current" /> : <PinOff className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(note.id)}
            aria-label="Remove note"
            title="Remove note"
            className="grid size-6 place-items-center rounded text-slate-600 hover:bg-black/10 hover:text-slate-900"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </DragBar>
      <textarea
        ref={textRef}
        value={note.text}
        onChange={(e) => onChange(note.id, { text: e.target.value.slice(0, 2000) })}
        placeholder="Write it down…"
        aria-label="Note text"
        className="min-h-0 flex-1 resize-none bg-transparent px-3 pb-3 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-500"
      />
    </motion.div>
  );
}

/**
 * Dragging from the top strip only, so selecting text in the note never moves it.
 * Pointer events are handled by hand so the stored x/y stays the one source of
 * truth (no framer drag offset to reconcile).
 */
function DragBar({
  note,
  onMove,
  children,
}: {
  note: ScratchNote;
  onMove: (x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  return (
    <div
      className="flex cursor-grab touch-none items-center gap-2 px-2 py-1.5 active:cursor-grabbing"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        start.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onMove(start.current.x + e.clientX - start.current.px, start.current.y + e.clientY - start.current.py);
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
    >
      {children}
    </div>
  );
}
