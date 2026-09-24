"use client";

import { useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  Edit3,
  Eraser,
  Filter,
  Loader2,
  Plus,
  Save,
  Search,
  StickyNote as StickyNoteIcon,
  Trash2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useIsArchived } from "@/components/ArchiveContext";
import {
  clearAllStickyNotes,
  createQuickTask,
  createStickyNote,
  deleteStickyNote,
  toggleStickyNoteDone,
  updateStickyNote,
  updateStickyNotePosition,
} from "@/lib/actions";
import { organizeStickyNotes } from "@/lib/ai-actions";
import { StickyNote } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The note colours are the student's data (stored on each note), not theme
 * colours, so they stay fixed pastel "paper" in both themes with dark text.
 */
const COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Orange", value: "#fed7aa" },
];

const NOTE_SIZE = 280;

/** Optimistic notes carry a Math.random() id until the server answers. */
const isTemporary = (id: string) => id.includes(".");

export function StickyNotesContainer({ initialNotes }: { initialNotes: StickyNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const archived = useIsArchived();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const [promoteNote, setPromoteNote] = useState<StickyNote | null>(null);
  const [promoteSubject, setPromoteSubject] = useState("");
  const [promoteStartTime, setPromoteStartTime] = useState("19:00");
  const [promoteEndTime, setPromoteEndTime] = useState("20:00");
  const [isPromoting, setIsPromoting] = useState(false);

  const [isOrganizing, setIsOrganizing] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const query = searchQuery.trim().toLowerCase();
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query);
    const matchesColor = colorFilter ? note.color === colorFilter : true;
    return matchesSearch && matchesColor;
  });
  const isFiltered = Boolean(query) || colorFilter !== null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // A random spot near the middle of the board.
    const board = boardRef.current;
    let startX = 50;
    let startY = 50;
    if (board && board.clientWidth > 0) {
      startX = Math.max(0, board.clientWidth / 2 - NOTE_SIZE / 2 + (Math.random() * 100 - 50));
      startY = Math.max(0, board.clientHeight / 2 - NOTE_SIZE / 2 + (Math.random() * 100 - 50));
    }

    const tempId = Math.random().toString();
    const title = newTitle;
    const content = newContent;
    const color = selectedColor;
    const optimistic: StickyNote = {
      id: tempId,
      title,
      content,
      color,
      isDone: false,
      x: startX,
      y: startY,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      classId: null, // filled in by the server; this row is optimistic only
      userId: "",
    };

    setNotes((prev) => [...prev, optimistic]);
    setIsAdding(false);
    setNewTitle("");
    setNewContent("");

    const created = await createStickyNote(title, content, color);
    if (created) {
      // Swap the temporary note for the real record (real id, same position)
      // so later drags persist instead of being skipped.
      setNotes((prev) => prev.map((n) => (n.id === tempId ? { ...created, x: startX, y: startY } : n)));
      await updateStickyNotePosition(created.id, startX, startY);
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      toast.error("That note could not be saved. Try again.");
    }
  };

  const handleDeleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (!isTemporary(id)) await deleteStickyNote(id);
  };

  const handleToggleDone = async (id: string, currentStatus: boolean) => {
    const next = !currentStatus;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isDone: next } : n)));
    if (!isTemporary(id)) await toggleStickyNoteDone(id, next);
  };

  const handleClearAll = async () => {
    setNotes([]);
    setIsDeletingAll(false);
    await clearAllStickyNotes();
  };

  const handleDragEnd = async (id: string, info: PanInfo) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    // Clamp so a note can never be dragged off the board.
    const board = boardRef.current;
    const maxX = board ? Math.max(0, board.clientWidth - NOTE_SIZE) : note.x + info.offset.x;
    const maxY = board ? Math.max(0, board.clientHeight - NOTE_SIZE) : note.y + info.offset.y;
    const newX = Math.max(0, Math.min(note.x + info.offset.x, maxX));
    const newY = Math.max(0, Math.min(note.y + info.offset.y, maxY));

    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x: newX, y: newY } : n)));
    if (!isTemporary(id)) await updateStickyNotePosition(id, newX, newY);
  };

  const startEditing = (note: StickyNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const saveEdit = async (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: editTitle, content: editContent } : n)));
    setEditingId(null);
    if (!isTemporary(id)) await updateStickyNote(id, { title: editTitle, content: editContent });
  };

  const handleOrganize = async () => {
    setIsOrganizing(true);
    setAiPlan(null);
    try {
      const res = await organizeStickyNotes();
      if (res.error) toast.error(res.error);
      else if (res.plan) setAiPlan(res.plan);
    } catch {
      toast.error("Your notes could not be organized right now. Try again in a moment.");
    } finally {
      setIsOrganizing(false);
    }
  };

  const openPromote = (note: StickyNote) => {
    setPromoteNote(note);
    setPromoteSubject(note.title);
  };

  const submitPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteNote || !promoteSubject.trim()) return;

    setIsPromoting(true);
    try {
      await createQuickTask({
        subject: promoteSubject,
        startTime: promoteStartTime,
        endTime: promoteEndTime,
        type: "HOMEWORK",
        date: new Date(),
      });
      // The note has become a task, so it leaves the board.
      await handleDeleteNote(promoteNote.id);
      setPromoteNote(null);
      toast.success("Added to today's plan.");
    } catch {
      toast.error("That task could not be added. Try again.");
    } finally {
      setIsPromoting(false);
    }
  };

  const noteCardProps = (note: StickyNote) => ({
    note,
    archived,
    isEditing: editingId === note.id,
    editTitle,
    editContent,
    onEditTitle: setEditTitle,
    onEditContent: setEditContent,
    onSave: () => saveEdit(note.id),
    onEdit: () => startEditing(note),
    onPromote: () => openPromote(note),
    onToggleDone: () => handleToggleDone(note.id, note.isDone),
    onDelete: () => handleDeleteNote(note.id),
  });

  return (
    <Page>
      <PageHeader
        title="Notes"
        description="Sticky notes for the things you do not want to forget. Drag them around the board."
        actions={
          !archived && (
            <>
              <Button variant="outline" size="lg" onClick={handleOrganize} disabled={isOrganizing || notes.length === 0}>
                {isOrganizing ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {isOrganizing ? "Organizing…" : "Organize with AI"}
              </Button>
              <Button size="lg" onClick={() => setIsAdding(true)}>
                <Plus />
                Add note
              </Button>
            </>
          )
        }
      />
      <PageBody>
        {notes.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes"
                aria-label="Search notes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <div role="group" aria-label="Filter by colour" className="flex items-center gap-1 self-start rounded-xl border border-border/60 bg-card p-1">
              <button
                type="button"
                onClick={() => setColorFilter(null)}
                aria-label="Show all colours"
                aria-pressed={colorFilter === null}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  colorFilter === null ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <Filter className="size-4 text-muted-foreground" />
              </button>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColorFilter(c.value)}
                  aria-label={`Only ${c.name.toLowerCase()} notes`}
                  aria-pressed={colorFilter === c.value}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    "size-8 rounded-lg border-2 transition-opacity",
                    colorFilter === c.value ? "border-foreground" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                />
              ))}
            </div>

            {!archived && (
              <Button
                variant="ghost"
                onClick={() => setIsDeletingAll(true)}
                className="self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ml-auto sm:self-auto"
              >
                <Eraser />
                Clear board
              </Button>
            )}
          </div>
        )}

        {filteredNotes.length === 0 ? (
          notes.length === 0 ? (
            <EmptyState
              icon={<StickyNoteIcon />}
              title="No notes yet"
              description="Jot down a reminder, a formula or a to-do. Anything worth scheduling can become a task later."
              action={
                !archived && (
                  <Button onClick={() => setIsAdding(true)}>
                    <Plus />
                    Add note
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No notes match"
              description={isFiltered ? "Nothing matches that search or colour." : undefined}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setColorFilter(null);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Wide screens: the free-form board, where position is kept. */}
            <div
              ref={boardRef}
              className="relative hidden h-[70vh] min-h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-muted/30 md:block"
            >
              {filteredNotes.map((note) => {
                const editing = editingId === note.id;
                return (
                  <motion.div
                    key={note.id}
                    drag={!editing && !archived}
                    dragMomentum={false}
                    onDragEnd={archived ? undefined : (_, info) => handleDragEnd(note.id, info)}
                    initial={false}
                    animate={{ x: note.x, y: note.y }}
                    transition={{ duration: 0 }}
                    whileDrag={{ zIndex: 50, boxShadow: "0 12px 24px -8px rgb(0 0 0 / 0.25)" }}
                    style={{ position: "absolute", width: NOTE_SIZE, height: NOTE_SIZE, touchAction: "none" }}
                    className={cn("rounded-xl", archived || editing ? "cursor-default" : "cursor-grab active:cursor-grabbing")}
                  >
                    <NoteCard {...noteCardProps(note)} className="h-full" />
                  </motion.div>
                );
              })}
            </div>

            {/* Narrow screens: a plain list, since a board laid out on a
                desktop does not fit a phone. Positions are left untouched. */}
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
              {filteredNotes.map((note) => (
                <li key={note.id}>
                  <NoteCard {...noteCardProps(note)} className="min-h-48" />
                </li>
              ))}
            </ul>
          </>
        )}
      </PageBody>

      {/* Add note */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New note</DialogTitle>
            <DialogDescription>It lands in the middle of the board. Markdown works in the details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newNoteTitle">Title</Label>
              <Input
                id="newNoteTitle"
                placeholder="What do you need to remember?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newNoteContent">Details</Label>
              <Textarea
                id="newNoteContent"
                placeholder="Bullet points, a checklist, a formula…"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-28 resize-none rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <p id="newNoteColorLabel" className="text-sm font-medium">
                Colour
              </p>
              <div role="group" aria-labelledby="newNoteColorLabel" className="flex flex-wrap items-center gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    aria-label={color.name}
                    aria-pressed={selectedColor === color.value}
                    className={cn(
                      "size-9 rounded-xl border-2 transition-colors",
                      selectedColor === color.value ? "border-primary" : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newTitle.trim()}>
                Add note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promote to task */}
      <Dialog open={promoteNote !== null} onOpenChange={(open) => !open && !isPromoting && setPromoteNote(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Turn into a task</DialogTitle>
            <DialogDescription>
              The note is added to today&apos;s plan as homework and removed from the board.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPromote} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="promoteSubject">Task</Label>
              <Input
                id="promoteSubject"
                placeholder="e.g. Math, Physics"
                value={promoteSubject}
                onChange={(e) => setPromoteSubject(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promoteStartTime">Start</Label>
                <Input
                  id="promoteStartTime"
                  type="time"
                  value={promoteStartTime}
                  onChange={(e) => setPromoteStartTime(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoteEndTime">End</Label>
                <Input
                  id="promoteEndTime"
                  type="time"
                  value={promoteEndTime}
                  onChange={(e) => setPromoteEndTime(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPromoteNote(null)} disabled={isPromoting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!promoteSubject.trim() || isPromoting}>
                {isPromoting ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
                {isPromoting ? "Adding…" : "Add to today"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI plan */}
      <Dialog open={aiPlan !== null} onOpenChange={(open) => !open && setAiPlan(null)}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>A plan for your notes</DialogTitle>
            <DialogDescription>Written by AI from what is on your board. Nothing has been changed.</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none flex-1 overflow-y-auto dark:prose-invert">
            <ReactMarkdown>{aiPlan ?? ""}</ReactMarkdown>
          </div>
          <DialogFooter>
            <Button onClick={() => setAiPlan(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeletingAll}
        onClose={() => setIsDeletingAll(false)}
        onConfirm={handleClearAll}
        title="Clear the board?"
        description="Every sticky note will be deleted. You cannot undo this."
      />
    </Page>
  );
}

/** One note, the same on the board and in the phone list. */
function NoteCard({
  note,
  archived,
  isEditing,
  editTitle,
  editContent,
  onEditTitle,
  onEditContent,
  onSave,
  onEdit,
  onPromote,
  onToggleDone,
  onDelete,
  className,
}: {
  note: StickyNote;
  archived: boolean;
  isEditing: boolean;
  editTitle: string;
  editContent: string;
  onEditTitle: (value: string) => void;
  onEditContent: (value: string) => void;
  onSave: () => void;
  onEdit: () => void;
  onPromote: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const action =
    "flex size-8 items-center justify-center rounded-lg text-black/60 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30";

  return (
    <article
      // Pastel "paper" in both themes; a done note turns neutral grey.
      style={{ backgroundColor: note.isDone ? "#e5e7eb" : note.color }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-black/5 p-5 text-black/80 shadow-sm",
        className
      )}
    >
      {isEditing ? (
        <div className="flex flex-1 flex-col gap-3" onPointerDownCapture={(e) => e.stopPropagation()}>
          <Input
            value={editTitle}
            onChange={(e) => onEditTitle(e.target.value)}
            aria-label="Note title"
            className="h-10 border-black/10 bg-white/60 px-2 font-heading text-lg font-bold text-black focus-visible:ring-black/20"
            autoFocus
          />
          <Textarea
            value={editContent}
            onChange={(e) => onEditContent(e.target.value)}
            aria-label="Note details"
            className="flex-1 resize-none border-black/10 bg-white/60 p-2 text-sm text-black focus-visible:ring-black/20"
          />
          <Button size="sm" onClick={onSave} className="bg-black/80 text-white hover:bg-black">
            <Save />
            Save
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 break-words font-heading text-lg font-bold leading-tight",
                note.isDone && "line-through opacity-60"
              )}
            >
              {note.title}
            </h3>
            {!archived && (
              <div
                className="-mr-2 -mt-1 flex shrink-0 items-center transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                onPointerDownCapture={(e) => e.stopPropagation()}
              >
                <button type="button" onClick={onPromote} className={action} aria-label="Turn into a task" title="Turn into a task">
                  <CalendarPlus className="size-4" />
                </button>
                <button type="button" onClick={onEdit} className={action} aria-label="Edit note" title="Edit note">
                  <Edit3 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={onToggleDone}
                  className={cn(action, note.isDone && "text-green-700")}
                  aria-label={note.isDone ? "Mark as not done" : "Mark as done"}
                  aria-pressed={note.isDone}
                  title={note.isDone ? "Mark as not done" : "Mark as done"}
                >
                  <CheckCircle2 className="size-4" />
                </button>
                <button type="button" onClick={onDelete} className={cn(action, "text-red-700")} aria-label="Delete note" title="Delete note">
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div
            className={cn(
              "prose prose-sm max-w-none flex-1 overflow-y-auto pr-1 text-sm leading-relaxed text-black/80 prose-headings:mb-2 prose-p:mb-2 prose-p:leading-snug prose-ul:my-1 prose-li:my-0",
              note.isDone && "opacity-60"
            )}
          >
            <ReactMarkdown>{note.content}</ReactMarkdown>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-xs font-medium text-black/50">
            <span>{new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            {note.isDone && <span className="rounded-full bg-green-200 px-2 py-0.5 text-green-800">Done</span>}
          </div>
        </>
      )}
    </article>
  );
}
