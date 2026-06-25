"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pin, X, Eraser, CheckCircle2, Search, Filter, CalendarPlus, Wand2, Edit3, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createStickyNote, deleteStickyNote, clearAllStickyNotes, toggleStickyNoteDone, updateStickyNotePosition, updateStickyNote, createQuickTask } from "@/lib/actions";
import { organizeStickyNotes } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ConfirmModal";
import { StickyNote } from "@/lib/types";
import ReactMarkdown from "react-markdown";

const COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Orange", value: "#fed7aa" },
];

export function StickyNotesContainer({ initialNotes }: { initialNotes: StickyNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Promote State
  const [promoteNote, setPromoteNote] = useState<StickyNote | null>(null);
  const [promoteSubject, setPromoteSubject] = useState("");
  const [promoteStartTime, setPromoteStartTime] = useState("19:00");
  const [promoteEndTime, setPromoteEndTime] = useState("20:00");

  // AI Organizer State
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesColor = colorFilter ? note.color === colorFilter : true;
    return matchesSearch && matchesColor;
  });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Calculate a random position near the center
    const board = boardRef.current;
    let startX = 50;
    let startY = 50;
    if (board) {
       startX = (board.clientWidth / 2) - 120 + (Math.random() * 100 - 50);
       startY = (board.clientHeight / 2) - 120 + (Math.random() * 100 - 50);
    }

    const tempId = Math.random().toString();
    const newNote = {
      id: tempId,
      title: newTitle,
      content: newContent,
      color: selectedColor,
      isDone: false,
      x: startX,
      y: startY,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "", // Placeholder
    };

    setNotes((prev) => [...prev, newNote]);
    setIsAdding(false);
    setNewTitle("");
    setNewContent("");

    const created = await createStickyNote(newTitle, newContent, selectedColor);
    if (created) {
      // Swap the temporary note for the real DB record (real ID, same position)
      // so subsequent drags persist correctly instead of being silently skipped.
      setNotes((prev) =>
        prev.map((n) =>
          n.id === tempId ? { ...created, x: startX, y: startY } : n
        )
      );
      // Persist the initial position immediately.
      await updateStickyNotePosition(created.id, startX, startY);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    await deleteStickyNote(id);
  };

  const handleToggleDone = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setNotes(notes.map(n => n.id === id ? { ...n, isDone: newStatus } : n));
    await toggleStickyNoteDone(id, newStatus);
  };

  const handleClearAll = async () => {
    setNotes([]);
    setIsDeletingAll(false);
    await clearAllStickyNotes();
  };

  const NOTE_SIZE = 280;

  const handleDragEnd = async (id: string, info: any) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    // Clamp the new position so a note can never be dragged outside the board boundaries.
    const board = boardRef.current;
    const maxX = board ? Math.max(0, board.clientWidth - NOTE_SIZE) : note.x + info.offset.x;
    const maxY = board ? Math.max(0, board.clientHeight - NOTE_SIZE) : note.y + info.offset.y;
    const newX = Math.max(0, Math.min(note.x + info.offset.x, maxX));
    const newY = Math.max(0, Math.min(note.y + info.offset.y, maxY));

    setNotes(notes.map(n => n.id === id ? { ...n, x: newX, y: newY } : n));

    if (!id.includes(".")) {
      await updateStickyNotePosition(id, newX, newY);
    }
  };

  const startEditing = (note: StickyNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const saveEdit = async (id: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, title: editTitle, content: editContent } : n));
    setEditingId(null);
    if (!id.includes(".")) {
       await updateStickyNote(id, { title: editTitle, content: editContent });
    }
  };

  // AI Organizer
  const handleMagicOrganize = async () => {
    setIsOrganizing(true);
    setAiPlan(null);
    try {
      const res = await organizeStickyNotes();
      if (res.error) {
        alert(res.error);
      } else if (res.plan) {
        setAiPlan(res.plan);
      }
    } catch (e) {
      alert("Failed to organize notes.");
    } finally {
      setIsOrganizing(false);
    }
  };

  const handlePromoteToTask = (note: StickyNote) => {
     setPromoteNote(note);
     setPromoteSubject(note.title);
  };

  const submitPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteNote || !promoteSubject.trim()) return;

    await createQuickTask({
      subject: promoteSubject,
      startTime: promoteStartTime,
      endTime: promoteEndTime,
      type: "HOMEWORK",
      date: new Date()
    });
    
    // Auto-delete note after promotion
    await handleDeleteNote(promoteNote.id);
    setPromoteNote(null);
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-80px)]">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-card/80 p-6 rounded-[32px] border shadow-sm backdrop-blur-md relative z-20">
        <div>
          <h1 className="text-3xl font-heading font-black text-foreground flex items-center gap-3">
            <Pin className="w-7 h-7 text-primary rotate-12" />
            Corkboard
          </h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            Drag, drop, and organize your thoughts.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl h-12 bg-background border-border/60 focus-visible:ring-primary/20"
            />
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1 bg-background p-1.5 rounded-2xl border border-border/60">
            <button
               onClick={() => setColorFilter(null)}
               aria-label="Show all colors"
               title="Show all colors"
               className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all", !colorFilter ? "bg-muted" : "hover:bg-muted/50")}
            >
               <Filter className="w-4 h-4 text-muted-foreground" />
            </button>
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColorFilter(c.value)}
                aria-label={`Filter by ${c.name} notes`}
                title={`Filter by ${c.name} notes`}
                style={{ backgroundColor: c.value }}
                className={cn(
                  "w-8 h-8 rounded-xl transition-all border-2",
                  colorFilter === c.value ? "border-foreground scale-110 shadow-sm" : "border-transparent opacity-50 hover:opacity-100"
                )}
              />
            ))}
          </div>

          <div className="h-8 w-px bg-border/60 hidden sm:block mx-1" />

          <Button 
            onClick={handleMagicOrganize}
            variant="secondary"
            disabled={isOrganizing}
            className="rounded-2xl gap-2 font-bold hover:scale-105 transition-transform h-12 w-full sm:w-auto text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
          >
            {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Magic Organize
          </Button>

          <Button 
            onClick={() => setIsAdding(true)}
            className="rounded-2xl gap-2 font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform h-12 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Wall Canvas */}
      <div 
        ref={boardRef}
        className="flex-1 relative overflow-hidden rounded-[40px] border-4 border-muted-foreground/10 bg-[url('/textures/cork-board.png')] bg-[#e8dcc7] dark:bg-[#3b3228] shadow-inner"
      >
        <AnimatePresence>
          {filteredNotes.map((note) => {
            const isEditing = editingId === note.id;
            
            return (
              <motion.div
                key={note.id}
                drag={!isEditing}
                dragMomentum={false}
                onDragEnd={(e, info) => handleDragEnd(note.id, info)}
                initial={{ x: note.x, y: note.y, scale: 0.8, opacity: 0 }}
                animate={{ x: note.x, y: note.y, scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                whileHover={{ scale: isEditing ? 1 : 1.05, zIndex: 50 }}
                whileDrag={{ scale: 1.1, zIndex: 100, rotate: 2, boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)" }}
                style={{
                  // Sticky notes are intentionally a light "paper" surface in both themes,
                  // so the done state uses a fixed light neutral (keeps the black note text readable).
                  backgroundColor: note.isDone ? "#e5e7eb" : note.color,
                  position: 'absolute',
                  width: 280,
                  height: 280,
                  touchAction: "none"
                }}
                className={cn(
                  "group p-6 shadow-xl rounded-sm flex flex-col cursor-grab active:cursor-grabbing overflow-hidden border border-black/5 transition-colors duration-500",
                  note.isDone && "opacity-80 grayscale-[0.3]"
                )}
              >
                {/* Pin Detail */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                  <Pin className="w-6 h-6 fill-current text-black/20 rotate-45 drop-shadow-md" />
                </div>

                {/* Tape Detail */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-20 h-7 bg-white/40 rotate-2 backdrop-blur-sm z-10 shadow-sm" />

                <div className="relative z-10 flex-1 flex flex-col pt-4">
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-3">
                       <Input 
                         value={editTitle}
                         onChange={(e) => setEditTitle(e.target.value)}
                         className="font-heading font-black text-xl bg-white/50 border-black/10 focus-visible:ring-black/20 h-10 px-2"
                         autoFocus
                       />
                       <Textarea 
                         value={editContent}
                         onChange={(e) => setEditContent(e.target.value)}
                         className="flex-1 font-medium text-sm bg-white/50 border-black/10 focus-visible:ring-black/20 resize-none p-2"
                       />
                       <Button size="sm" onClick={() => saveEdit(note.id)} className="bg-black/80 hover:bg-black text-white gap-2 font-bold">
                         <Save className="w-4 h-4" /> Save
                       </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className={cn(
                          "font-heading font-black text-xl text-black/80 leading-tight pr-2 transition-all",
                          note.isDone && "line-through opacity-50"
                        )}>
                          {note.title}
                        </h3>
                        <div className="flex flex-wrap items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePromoteToTask(note); }}
                            className="p-1.5 rounded-full hover:bg-black/10 transition-all text-blue-600"
                            aria-label="Promote to task"
                            title="Promote to Task"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditing(note); }}
                            className="p-1.5 rounded-full hover:bg-black/10 transition-all text-black/60"
                            aria-label="Edit note"
                            title="Edit Note"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleDone(note.id, note.isDone); }}
                            className={cn(
                              "p-1.5 rounded-full transition-all",
                              note.isDone ? "text-green-600 hover:bg-green-100" : "text-black/40 hover:bg-black/10"
                            )}
                            aria-label={note.isDone ? "Mark as active" : "Mark as done"}
                            title={note.isDone ? "Mark as active" : "Mark as done"}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                            className="p-1.5 rounded-full hover:bg-black/10 transition-all text-red-600"
                            aria-label="Delete note"
                            title="Delete note"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "text-black/80 font-medium text-sm leading-relaxed flex-1 overflow-y-auto custom-scrollbar pr-1 transition-all prose prose-sm max-w-none prose-p:leading-snug prose-headings:mb-2 prose-p:mb-2 prose-ul:my-1 prose-li:my-0",
                        note.isDone && "opacity-50"
                      )}>
                        <ReactMarkdown>{note.content}</ReactMarkdown>
                      </div>

                      <div className="mt-3 pt-3 border-t border-black/10 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                          {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {note.isDone && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-200 px-2 py-0.5 rounded-full shadow-sm">
                            Done
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Texture Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay bg-[url('/textures/paper-fibers.png')]" />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredNotes.length === 0 && !isAdding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="p-6 bg-foreground/5 rounded-full mb-4 backdrop-blur-sm">
              <Pin className="w-12 h-12 text-foreground/20" />
            </div>
            <h3 className="text-xl font-bold text-foreground/40">Nothing to see here</h3>
            <p className="text-foreground/30 font-medium mt-1">
              {notes.length === 0 ? "Stick something on the board!" : "No notes match your filters."}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
         <Button 
            variant="ghost"
            onClick={() => setIsDeletingAll(true)}
            className="rounded-2xl gap-2 font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Eraser className="w-4 h-4" />
            Clean Board
          </Button>
      </div>

      {/* Add Note Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border shadow-2xl rounded-[32px] w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-heading font-black">Stick New Note</h2>
                  <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <form onSubmit={handleAddNote} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Task Name</label>
                    <Input 
                      placeholder="What needs to be done?"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="rounded-2xl h-14 font-bold text-lg border-2 focus-visible:ring-primary/20"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Content (Markdown Supported)</label>
                    <Textarea 
                      placeholder="Add details, bullet points, or checklists..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="rounded-2xl min-h-[120px] font-medium border-2 focus-visible:ring-primary/20 resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Pick a Color</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setSelectedColor(color.value)}
                          className={cn(
                            "w-10 h-10 rounded-xl transition-all border-2",
                            selectedColor === color.value 
                              ? "border-primary scale-110 shadow-lg" 
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <Button 
                      type="submit" 
                      className="flex-1 h-14 rounded-2xl font-black text-lg shadow-lg shadow-primary/20"
                      disabled={!newTitle.trim()}
                    >
                      Stick It!
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAdding(false)}
                      className="h-14 px-8 rounded-2xl font-bold"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promote to Task Modal */}
      <AnimatePresence>
        {promoteNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border shadow-2xl rounded-[32px] w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-heading font-black flex items-center gap-2">
                    <CalendarPlus className="w-6 h-6 text-primary" /> Promote to Task
                  </h2>
                  <Button variant="ghost" size="icon" onClick={() => setPromoteNote(null)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <form onSubmit={submitPromote} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Task Subject</label>
                    <Input 
                      placeholder="e.g. Math, Physics"
                      value={promoteSubject}
                      onChange={(e) => setPromoteSubject(e.target.value)}
                      className="rounded-2xl h-14 font-bold text-lg border-2 focus-visible:ring-primary/20"
                      autoFocus
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Start Time</label>
                      <Input 
                        type="time"
                        value={promoteStartTime}
                        onChange={(e) => setPromoteStartTime(e.target.value)}
                        className="rounded-2xl h-14 font-bold text-lg border-2 focus-visible:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">End Time</label>
                      <Input 
                        type="time"
                        value={promoteEndTime}
                        onChange={(e) => setPromoteEndTime(e.target.value)}
                        className="rounded-2xl h-14 font-bold text-lg border-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">
                    This note will be automatically removed from the wall and added to today&apos;s schedule.
                  </p>

                  <div className="flex gap-4 pt-2">
                    <Button 
                      type="submit" 
                      className="flex-1 h-14 rounded-2xl font-black text-lg shadow-lg shadow-primary/20"
                      disabled={!promoteSubject.trim()}
                    >
                      Promote!
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setPromoteNote(null)}
                      className="h-14 px-8 rounded-2xl font-bold"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Plan Modal */}
      <AnimatePresence>
        {aiPlan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border shadow-2xl rounded-[32px] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 pb-4 shrink-0 flex items-center justify-between border-b border-border/40">
                <h2 className="text-2xl font-heading font-black flex items-center gap-2 text-blue-600">
                  <Wand2 className="w-6 h-6" /> Magic Organization Plan
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setAiPlan(null)} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{aiPlan}</ReactMarkdown>
              </div>
              
              <div className="p-6 shrink-0 border-t border-border/40 bg-muted/30 flex justify-end">
                <Button 
                  onClick={() => setAiPlan(null)}
                  className="rounded-2xl font-bold h-12 px-8"
                >
                  Got it, thanks!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isDeletingAll}
        onClose={() => setIsDeletingAll(false)}
        onConfirm={handleClearAll}
        title="Clean the Board?"
        description="This will permanently delete all your sticky notes. You cannot undo this action."
      />
    </div>
  );
}
