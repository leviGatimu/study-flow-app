"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  UploadCloud, 
  Search, 
  FileText, 
  Plus, 
  Trash2, 
  Eye, 
  Edit3, 
  Download, 
  Copy, 
  Check, 
  ArrowLeft, 
  StickyNote, 
  Calendar,
  BookOpen,
  ChevronRight,
  FileCode,
  AlertTriangle,
  Clock,
  ExternalLink,
  Save,
  PenTool,
  PanelLeftClose,
  PanelLeft,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  createAiNote, 
  getAiNotes, 
  updateAiNote, 
  deleteAiNote, 
  generateAiNoteFromText 
} from '@/lib/ai-actions';
import { createStickyNote, createQuickTask } from '@/lib/actions';
import { cn } from '@/lib/utils';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

interface Note {
  id: string;
  title: string;
  content: string;
  sourceName: string | null;
  stylePreset: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PRESETS = [
  {
    name: 'Detailed Study Guide',
    description: 'Comprehensive study guide with core definitions, deep explanations, and clear logical sections.',
    icon: BookOpen,
    accent: 'from-blue-500 to-indigo-600',
    border: 'border-blue-500/30'
  },
  {
    name: 'Concise Summary',
    description: 'High-level executive summary, bullet points of critical takeaways, and quick-read sections.',
    icon: FileText,
    accent: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-500/30'
  },
  {
    name: 'Question & Answer',
    description: 'Active recall list matching core concepts with structured questions and detailed revision answers.',
    icon: PenTool,
    accent: 'from-amber-500 to-orange-600',
    border: 'border-amber-500/30'
  },
  {
    name: 'Concept Map Outline',
    description: 'Hierarchical nested bullet tree outlining structural relationships between concepts with short definitions.',
    icon: FileCode,
    accent: 'from-rose-500 to-pink-600',
    border: 'border-rose-500/30'
  }
];

export function AiNotesInterface({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(initialNotes.length === 0);
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Create fields
  const [inputTitle, setInputTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('Detailed Study Guide');
  
  // Edit fields
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  
  // Quick Action Modal states
  const [showStickyModal, setShowStickyModal] = useState(false);
  const [stickyTitle, setStickyTitle] = useState('');
  const [stickyContent, setStickyContent] = useState('');
  const [stickyColor, setStickyColor] = useState('#fef08a'); // Tailwind yellow-200
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskSubject, setTaskSubject] = useState('');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskStartTime, setTaskStartTime] = useState('19:00');
  const [taskEndTime, setTaskEndTime] = useState('20:00');
  const [taskType, setTaskType] = useState('REVISION');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with selected note
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setIsEditMode(false);
    }
  }, [selectedNote]);

  // Clean title when a file is uploaded
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Strip extension for title suggestion if no title entered yet
      if (!inputTitle) {
        const suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
        setInputTitle(suggestedTitle);
      }
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(" ");
        fullText += pageText + "\n\n";
      }
      return fullText;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (file.type === 'text/plain') {
      return await file.text();
    } else {
      throw new Error('Unsupported file type. Please upload a PDF, Word (.docx), or Text (.txt) file.');
    }
  };

  const handleGenerateNote = async () => {
    if (!inputTitle.trim()) {
      toast.error('Please enter a note title.');
      return;
    }

    let sourceText = inputText.trim();
    let sourceName = 'Manual Input';

    if (uploadedFile) {
      setIsGenerating(true);
      setGenerationPhase('Extracting contents from uploaded file...');
      try {
        sourceText = await extractTextFromFile(uploadedFile);
        sourceName = uploadedFile.name;
      } catch (err: any) {
        toast.error(err.message || 'Failed to extract text from file.');
        setIsGenerating(false);
        return;
      }
    }

    if (!sourceText.trim()) {
      toast.error('Please upload a file or paste document text.');
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setGenerationPhase('Analyzing document structures & core concepts...');

    // Small delay to let UI register state change
    await new Promise(resolve => setTimeout(resolve, 600));
    setGenerationPhase('Generating structured markdown guide using AI...');

    try {
      const noteContent = await generateAiNoteFromText(sourceText, inputTitle, selectedPreset);
      setGenerationPhase('Formatting layout and saving to database...');

      const savedNote = await createAiNote(inputTitle, noteContent, sourceName, selectedPreset);
      
      // Update local state
      setNotes(prev => [savedNote as any, ...prev]);
      setSelectedNote(savedNote as any);
      setIsCreateMode(false);
      
      // Reset form fields
      setInputTitle('');
      setInputText('');
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      toast.success('Beautiful AI notes generated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate AI notes. Please verify your API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!selectedNote) return;
    if (!editTitle.trim()) {
      toast.error('Title cannot be empty.');
      return;
    }

    try {
      const updated = await updateAiNote(selectedNote.id, editTitle, editContent);
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, title: editTitle, content: editContent } : n));
      setSelectedNote({ ...selectedNote, title: editTitle, content: editContent });
      setIsEditMode(false);
      toast.success('Study notes updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update note.');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this study note?')) return;
    
    try {
      await deleteAiNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setIsCreateMode(true);
      }
      toast.success('Study note deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete note.');
    }
  };

  const handleCopyToClipboard = () => {
    if (!selectedNote) return;
    navigator.clipboard.writeText(selectedNote.content);
    toast.success('Markdown copied to clipboard.');
  };

  const handleDownloadNote = () => {
    if (!selectedNote) return;
    const blob = new Blob([selectedNote.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedNote.title.toLowerCase().replace(/\s+/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Markdown file downloaded.');
  };

  // Quick Action: Send Selected Text to Sticky Note
  const handleOpenStickyModal = () => {
    const selectedText = window.getSelection()?.toString() || '';
    setStickyTitle(`Insight: ${selectedNote?.title || 'Note'}`);
    setStickyContent(selectedText || selectedNote?.content.slice(0, 150) + '...' || '');
    setShowStickyModal(true);
  };

  const handleSaveStickyNote = async () => {
    if (!stickyTitle.trim() || !stickyContent.trim()) {
      toast.error('Title and content are required for sticky notes.');
      return;
    }

    try {
      await createStickyNote(stickyTitle, stickyContent, stickyColor);
      setShowStickyModal(false);
      toast.success('Sticky Note created on dashboard.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sticky note.');
    }
  };

  // Quick Action: Add Revision Block to Schedule
  const handleOpenTaskModal = () => {
    setTaskSubject(`${selectedNote?.title || 'Revision'} Review`);
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskSubject.trim()) {
      toast.error('Subject is required.');
      return;
    }

    try {
      await createQuickTask({
        subject: taskSubject,
        startTime: taskStartTime,
        endTime: taskEndTime,
        type: taskType,
        date: new Date(taskDate)
      });
      setShowTaskModal(false);
      toast.success('Revision task scheduled in calendar.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule task.');
    }
  };

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Sidebar List panel */}
      <AnimatePresence initial={false}>
        {!isSidebarCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-80 border-r border-border/40 bg-card/25 flex flex-col h-full overflow-hidden shrink-0"
          >
            <div className="p-6 border-b border-border/40 flex items-center justify-between">
              <h2 className="font-heading font-black text-xl text-foreground">AI-Notes</h2>
              <Button 
                onClick={() => { setSelectedNote(null); setIsCreateMode(true); }}
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                title="Generate New Note"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-border/40 bg-muted/10 relative">
              <Search className="absolute left-9 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-55" />
              <Input 
                placeholder="Search study guides..." 
                className="pl-10 h-10 rounded-xl bg-background/50 border-border/40 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/25"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Notes list explorer */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
              <AnimatePresence>
                {filteredNotes.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground/50 text-sm">
                    No study guides found.
                  </div>
                ) : (
                  filteredNotes.map(note => {
                    const isSelected = selectedNote?.id === note.id;
                    const dateText = new Date(note.createdAt).toLocaleDateString(undefined, { 
                      month: 'short', 
                      day: 'numeric' 
                    });
                    const matchedPreset = PRESETS.find(p => p.name === note.stylePreset);
                    const PresetIcon = matchedPreset?.icon || FileText;

                    return (
                      <motion.div
                        key={note.id}
                        layoutId={`note-card-${note.id}`}
                        onClick={() => { setSelectedNote(note); setIsCreateMode(false); }}
                        className={cn(
                          "group p-4 rounded-2xl cursor-pointer transition-all duration-300 relative border flex items-start gap-3.5 select-none active:scale-[0.98]",
                          isSelected 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 border-primary/20" 
                            : "border-border/30 hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          isSelected 
                            ? "bg-white/10 text-primary-foreground" 
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                        )}>
                          <PresetIcon className="h-4.5 w-4.5" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                              {dateText}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                              {note.stylePreset?.split(' ')[0]}
                            </span>
                          </div>
                          <h4 className="font-heading font-black text-sm tracking-tight truncate">
                            {note.title}
                          </h4>
                          <p className={cn(
                            "text-xs truncate opacity-70",
                            isSelected ? "text-primary-foreground" : "text-muted-foreground"
                          )}>
                            {note.sourceName || 'Pasted content'}
                          </p>
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 hover:bg-destructive/10 hover:text-destructive",
                            isSelected ? "text-primary-foreground/80 hover:bg-white/10 hover:text-white" : "text-muted-foreground"
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace content */}
      <div className="flex-1 bg-background/50 h-full overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          {/* GENERATION MODE / UPLOAD WIZARD */}
          {(isCreateMode || !selectedNote) && (
            <motion.div 
              key="wizard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 scrollbar-thin"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h1 className="text-4xl font-heading font-black tracking-tight text-foreground">
                    AI-Notes Studio
                  </h1>
                  <p className="text-muted-foreground font-semibold text-base max-w-2xl">
                    Upload text documents, lecture files, or copy/paste raw syllabus text to convert them into beautifully structured, styled study resources.
                  </p>
                </div>

                {/* Sidebar Toggle button (Desktop) */}
                <Button
                  onClick={() => setIsSidebarCollapsed(prev => !prev)}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl hidden md:flex hover:bg-muted text-muted-foreground border border-border/40 transition-all shrink-0 self-start"
                  title={isSidebarCollapsed ? "Show Sidebar List" : "Fullscreen Mode (Collapse Sidebar)"}
                >
                  {isSidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {/* Upload Zone & Form Card */}
              {isGenerating ? (
                <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-[32px] p-16 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1.5 bg-primary animate-pulse w-full" />
                  
                  {/* Glowing spinner */}
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin shadow-lg" />
                  
                  <div className="space-y-2 max-w-md">
                    <h3 className="font-heading font-black text-xl text-foreground">
                      Generating Study Notes
                    </h3>
                    <p className="text-primary font-bold text-sm tracking-wider uppercase">
                      {generationPhase}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This takes a few moments as the AI organizes chapters, outlines definitions, and styles the layout.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                  {/* Left Column: Form & Files */}
                  <div className="xl:col-span-3 space-y-6">
                    <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-[28px] p-6 shadow-md space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="title" className="font-heading font-black text-sm uppercase tracking-wider text-muted-foreground/75">
                          Note Title
                        </Label>
                        <Input 
                          id="title"
                          placeholder="e.g. Chapter 4: Computer Network Protocols"
                          className="h-11 rounded-xl bg-background/50 border-border/40 text-base focus-visible:ring-1 focus-visible:ring-primary/25"
                          value={inputTitle}
                          onChange={(e) => setInputTitle(e.target.value)}
                        />
                      </div>

                      {/* Drag Drop zone */}
                      <div className="space-y-2">
                        <Label className="font-heading font-black text-sm uppercase tracking-wider text-muted-foreground/75">
                          Upload Lecture File
                        </Label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 select-none group",
                            uploadedFile && "border-primary/40 bg-primary/5"
                          )}
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileChange}
                          />
                          <UploadCloud className={cn(
                            "h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mb-3",
                            uploadedFile && "text-primary"
                          )} />
                          
                          {uploadedFile ? (
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-foreground truncate max-w-[280px]">
                                {uploadedFile.name}
                              </p>
                              <p className="text-xs text-muted-foreground font-semibold">
                                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • Click to replace file
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-foreground">
                                Drag and drop your file here, or browse
                              </p>
                              <p className="text-xs text-muted-foreground font-semibold">
                                PDF, Word (.docx), or Text (.txt) files
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manual Text paste */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="manualText" className="font-heading font-black text-sm uppercase tracking-wider text-muted-foreground/75">
                            Paste Study Content (or type raw text)
                          </Label>
                          {uploadedFile && (
                            <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                              Using File Text Instead
                            </span>
                          )}
                        </div>
                        <Textarea 
                          id="manualText"
                          placeholder="Paste lecture materials, slides transcript, or study definitions here..."
                          className="min-h-[160px] rounded-xl bg-background/50 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/25 resize-y"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          disabled={!!uploadedFile}
                        />
                      </div>

                      <Button 
                        onClick={handleGenerateNote}
                        className="w-full h-12 rounded-xl text-base font-bold shadow-md shadow-primary/10 select-none cursor-pointer active:scale-98 transition-all"
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate AI Notes
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Style presets */}
                  <div className="xl:col-span-2 space-y-4">
                    <Label className="font-heading font-black text-sm uppercase tracking-wider text-muted-foreground/75 block">
                      Choose AI Note Style Accent
                    </Label>

                    <div className="grid grid-cols-1 gap-4">
                      {PRESETS.map(preset => {
                        const Icon = preset.icon;
                        const isSelected = selectedPreset === preset.name;
                        return (
                          <div
                            key={preset.name}
                            onClick={() => setSelectedPreset(preset.name)}
                            className={cn(
                              "border border-border/40 bg-card/40 backdrop-blur-xl rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-md flex items-start gap-4 select-none relative overflow-hidden",
                              isSelected ? `border-primary bg-primary/5 ring-1 ring-primary/20` : "hover:border-border/80"
                            )}
                          >
                            {isSelected && (
                              <div className={cn(
                                "absolute top-0 right-0 h-10 w-10 flex items-center justify-center text-primary"
                              )}>
                                <Check className="h-5 w-5" />
                              </div>
                            )}

                            <div className={cn(
                              "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-sm",
                              preset.accent
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="space-y-1 flex-1 pr-6">
                              <h4 className="font-heading font-black text-sm text-foreground tracking-tight">
                                {preset.name}
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {preset.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* VIEWING / EDITING SELECTED NOTE */}
          {(!isCreateMode && selectedNote) && (
            <motion.div 
              key={`workspace-${selectedNote.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Workspace Header toolbar */}
              <div className="p-6 border-b border-border/40 bg-card/25 backdrop-blur-lg flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Button
                    onClick={() => { setSelectedNote(null); setIsCreateMode(true); }}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl md:hidden hover:bg-muted"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  {/* Sidebar Toggle button (Desktop) */}
                  <Button
                    onClick={() => setIsSidebarCollapsed(prev => !prev)}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hidden md:flex hover:bg-muted text-muted-foreground border border-border/40 transition-all shrink-0"
                    title={isSidebarCollapsed ? "Show Sidebar List" : "Fullscreen Mode (Collapse Sidebar)"}
                  >
                    {isSidebarCollapsed ? <PanelLeft className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
                  </Button>

                  <div className="min-w-0 space-y-1">
                    {isEditMode ? (
                      <Input 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="font-heading font-black text-xl tracking-tight text-foreground bg-background/50 h-10 max-w-md rounded-xl border-border/40 px-3"
                      />
                    ) : (
                      <h1 className="font-heading font-black text-2xl tracking-tight text-foreground truncate">
                        {selectedNote.title}
                      </h1>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Source:</span>
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground normal-case font-semibold truncate max-w-[140px]">
                        {selectedNote.sourceName || 'Manual paste'}
                      </span>
                      <span>• Accent:</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold truncate">
                        {selectedNote.stylePreset || 'Sleek Study Notes'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toolbar buttons */}
                <div className="flex items-center gap-2">
                  {isEditMode ? (
                    <>
                      <Button
                        onClick={handleUpdateNote}
                        size="sm"
                        className="h-9 rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setEditTitle(selectedNote.title);
                          setEditContent(selectedNote.content);
                          setIsEditMode(false);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl font-semibold border"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => setIsEditMode(true)}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-all"
                        title="Edit Markdown Notes"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      <Button
                        onClick={handleCopyToClipboard}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-all"
                        title="Copy Markdown"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        onClick={handleDownloadNote}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-all"
                        title="Export Markdown"
                      >
                        <Download className="h-4 w-4" />
                      </Button>

                      <Button
                        onClick={() => handleDeleteNote(selectedNote.id)}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground border border-border/40 transition-all"
                        title="Delete Notes"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions Shortcuts bar */}
              {!isEditMode && (
                <div className="px-6 py-3.5 bg-primary/5 border-b border-border/30 flex items-center justify-between flex-wrap gap-2 text-sm select-none">
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span>Quick study helpers:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleOpenStickyModal}
                      className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline transition-all"
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                      Create Dashboard Sticky Note
                    </button>
                    <span className="text-muted-foreground/30">•</span>
                    <button 
                      onClick={handleOpenTaskModal}
                      className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline transition-all"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule Revision Block
                    </button>
                  </div>
                </div>
              )}

              {/* View / Edit area */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                {isEditMode ? (
                  <div className="flex-1 p-6 h-full overflow-hidden flex flex-col">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 rounded-[20px] bg-background/50 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/25 resize-none p-6 font-mono text-sm leading-relaxed overflow-y-auto"
                      placeholder="Write notes content directly in markdown..."
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-8 md:p-12 scrollbar-thin">
                    <article className="prose prose-slate dark:prose-invert max-w-4xl mx-auto leading-relaxed md:leading-loose text-foreground/90 space-y-6">
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 {...props} className="font-heading font-black text-3xl md:text-4xl text-foreground tracking-tight border-b border-border/30 pb-3 mt-10 mb-6" />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 {...props} className="font-heading font-black text-2xl text-foreground tracking-tight mt-8 mb-4" />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 {...props} className="font-heading font-black text-lg text-foreground tracking-tight mt-6 mb-2" />
                          ),
                          p: ({ node, ...props }) => (
                            <p {...props} className="text-base text-foreground/80 leading-relaxed mb-4" />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul {...props} className="list-disc pl-6 space-y-2 mb-4 text-base text-foreground/80" />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol {...props} className="list-decimal pl-6 space-y-2 mb-4 text-base text-foreground/80" />
                          ),
                          li: ({ node, ...props }) => (
                            <li {...props} className="pl-1" />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong {...props} className="font-bold text-foreground" />
                          ),
                          code: ({ node, ...props }) => (
                            <code {...props} className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-sm font-semibold text-primary" />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote {...props} className="border-l-4 border-primary pl-4 italic text-muted-foreground/95 bg-muted/10 py-2.5 pr-2.5 rounded-r-xl my-4" />
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-6 rounded-2xl border border-border/40">
                              <table {...props} className="min-w-full divide-y divide-border/40" />
                            </div>
                          ),
                          th: ({ node, ...props }) => (
                            <th {...props} className="px-4 py-3 bg-muted font-bold text-left text-xs uppercase tracking-wider" />
                          ),
                          td: ({ node, ...props }) => (
                            <td {...props} className="px-4 py-3 text-sm border-t border-border/30" />
                          ),
                        }}
                      >
                        {selectedNote.content}
                      </ReactMarkdown>
                    </article>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QUICK ACTION 1: CREATE STICKY NOTE MODAL */}
      <AnimatePresence>
        {showStickyModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/50 rounded-[28px] p-6 w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="space-y-1">
                <h3 className="font-heading font-black text-xl text-foreground">
                  Send to Sticky Note
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  This note will be pinned to your dashboard as a draggable reminder card.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stickyTitle" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                  <Input 
                    id="stickyTitle"
                    className="rounded-xl border-border/40 h-10 bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                    value={stickyTitle}
                    onChange={(e) => setStickyTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stickyContent" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content</Label>
                  <Textarea 
                    id="stickyContent"
                    className="rounded-xl border-border/40 min-h-[110px] bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                    value={stickyContent}
                    onChange={(e) => setStickyContent(e.target.value)}
                  />
                </div>

                {/* Color accents */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Pin Color Accent</Label>
                  <div className="flex items-center gap-3">
                    {[
                      { hex: '#fef08a', name: 'yellow' },
                      { hex: '#bbf7d0', name: 'green' },
                      { hex: '#bfdbfe', name: 'blue' },
                      { hex: '#fbcfe8', name: 'pink' },
                      { hex: '#ddd6fe', name: 'purple' },
                    ].map(col => (
                      <button
                        key={col.hex}
                        onClick={() => setStickyColor(col.hex)}
                        className={cn(
                          "h-7 w-7 rounded-full transition-transform active:scale-90 border",
                          stickyColor === col.hex ? "scale-110 border-primary ring-2 ring-primary/20" : "border-border/30"
                        )}
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  onClick={() => setShowStickyModal(false)}
                  variant="ghost" 
                  className="rounded-xl font-semibold border"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveStickyNote}
                  className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/10 cursor-pointer"
                >
                  Pin Note
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK ACTION 2: SCHEDULE REVISION BLOCK MODAL */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/50 rounded-[28px] p-6 w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="space-y-1">
                <h3 className="font-heading font-black text-xl text-foreground">
                  Schedule Revision Task
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  Create a specific study session linked to this topic in your scheduler.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taskSubject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject/Task Name</Label>
                  <Input 
                    id="taskSubject"
                    className="rounded-xl border-border/40 h-10 bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                    value={taskSubject}
                    onChange={(e) => setTaskSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taskDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input 
                    id="taskDate"
                    type="date"
                    className="rounded-xl border-border/40 h-10 bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Time</Label>
                    <Input 
                      id="startTime"
                      type="time"
                      className="rounded-xl border-border/40 h-10 bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                      value={taskStartTime}
                      onChange={(e) => setTaskStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Time</Label>
                    <Input 
                      id="endTime"
                      type="time"
                      className="rounded-xl border-border/40 h-10 bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/25"
                      value={taskEndTime}
                      onChange={(e) => setTaskEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Session Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTaskType('HOMEWORK')}
                      className={cn(
                        "py-2 px-4 rounded-xl border text-xs font-black tracking-wide uppercase transition-all",
                        taskType === 'HOMEWORK' 
                          ? "bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/10" 
                          : "border-border/30 hover:bg-muted"
                      )}
                    >
                      Homework
                    </button>
                    <button
                      onClick={() => setTaskType('REVISION')}
                      className={cn(
                        "py-2 px-4 rounded-xl border text-xs font-black tracking-wide uppercase transition-all",
                        taskType === 'REVISION' 
                          ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/10" 
                          : "border-border/30 hover:bg-muted"
                      )}
                    >
                      Revision
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  onClick={() => setShowTaskModal(false)}
                  variant="ghost" 
                  className="rounded-xl font-semibold border"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveTask}
                  className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/10 cursor-pointer"
                >
                  Schedule Session
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
