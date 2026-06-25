'use client';

import { useState, useEffect } from 'react';
import {
  FileText, BrainCircuit, Plus, Send, X,
  Trash2, ChevronLeft, Save, Sparkles, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  createProjectDoc, updateProjectDoc, deleteProjectDoc, updateProjectProgress
} from '@/lib/project-actions';
import { askAIBuddy } from '@/lib/ai-actions';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ProjectWithDocs } from '@/lib/types';

function Typewriter({ text, speed = 10 }: { text: string, speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDisplayedText('');
      let i = 0;
      const timer = setInterval(() => {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
        if (i >= text.length) clearInterval(timer);
      }, speed);
      return () => clearInterval(timer);
    }, 0);
    return () => clearTimeout(timerId);
  }, [text, speed]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
}

export function ProjectInterface({ project }: { project: ProjectWithDocs }) {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [docContent, setDocContent] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [projectProgress, setProjectProgress] = useState(project.progress);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<{ id: string; title: string; content: string } | null>(null);

  // Warn the user before leaving/refreshing the page with unsaved edits.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadDoc = (doc: { id: string; title: string; content: string }) => {
    setActiveDocId(doc.id);
    setDocTitle(doc.title);
    setDocContent(doc.content);
    setHasUnsavedChanges(false);
  };

  const handleSelectDoc = (doc: { id: string; title: string; content: string }) => {
    if (doc.id === activeDocId) return;
    if (hasUnsavedChanges) {
      // Defer the switch until the user confirms discarding unsaved edits.
      setPendingDoc(doc);
      return;
    }
    loadDoc(doc);
  };

  const handleCreateDoc = async () => {
    const title = 'New Documentation';
    const content = '';
    const newDoc = await createProjectDoc(project.id, { title, content });
    loadDoc({ id: newDoc.id, title, content });
  };

  const handleSaveDoc = async () => {
    if (!activeDocId) return;
    setIsSaving(true);
    await updateProjectDoc(activeDocId, project.id, { title: docTitle, content: docContent });
    setIsSaving(false);
    setHasUnsavedChanges(false);
  };

  const handleAskAi = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setAiResponse(''); // Clear previous response
    const context = `Context: I am working on a project titled "${project.title}". ${project.description ? `Description: ${project.description}` : ''}. Existing docs: ${project.docs.map(d => d.title).join(', ')}.`;
    const result = await askAIBuddy(`${context}\n\nUser Question: ${aiInput}`, []);
    setIsAiLoading(false);
    if (result.text) setAiResponse(result.text);
    else if (result.error) setAiResponse(`Error: ${result.error}`);
    setAiInput('');
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar: Docs List */}
      <div className="w-80 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="p-6 border-b bg-background/50">
          <Link href="/projects" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 mb-6">
            <ChevronLeft className="w-3 h-3" /> Back to Hub
          </Link>
          <h2 className="text-2xl font-heading font-black truncate">{project.title}</h2>
          
          <div className="mt-6 space-y-4">
             <div className="flex justify-between items-end">
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overall Progress</span>
               <span className="text-sm font-black text-primary">{projectProgress}%</span>
             </div>
             <Slider 
               value={[projectProgress]} 
               onValueChange={(val) => {
                 setProjectProgress(val[0]);
                 updateProjectProgress(project.id, val[0]);
               }}
               max={100} 
               step={1} 
               className="py-2"
             />
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between px-2 mb-4">
             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documentation</span>
             <Button variant="ghost" size="icon" aria-label="Create new document" title="Create new document" className="h-6 w-6 rounded-lg" onClick={handleCreateDoc}>
               <Plus className="w-4 h-4" />
             </Button>
          </div>
          {project.docs.map(doc => (
            <button
              key={doc.id}
              onClick={() => handleSelectDoc(doc)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group",
                activeDocId === doc.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </div>
              <Trash2
                className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                aria-label="Delete document"
                onClick={(e) => {
                  e.stopPropagation();
                  setDocToDelete(doc.id);
                }}
              />
            </button>
          ))}
        </div>

        <button 
          onClick={() => setIsAiOpen(true)}
          className="m-4 p-6 rounded-3xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-4 hover:bg-primary/20 transition-all group shadow-sm"
        >
           <div className="p-2 bg-primary rounded-xl text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
             <BrainCircuit className="w-5 h-5" />
           </div>
           <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">AI Architect</p>
              <p className="text-[10px] font-bold opacity-70">Ask for project suggestions</p>
           </div>
        </button>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col bg-background relative">
        {activeDocId ? (
          <>
            <div className="h-16 border-b flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <input
                value={docTitle}
                aria-label="Document title"
                onChange={(e) => { setDocTitle(e.target.value); setHasUnsavedChanges(true); }}
                className="bg-transparent border-none font-heading font-black text-xl focus:ring-0 w-full"
              />
              <div className="flex items-center gap-3 shrink-0">
                {hasUnsavedChanges && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
                <Button
                  onClick={handleSaveDoc}
                  disabled={isSaving}
                  className="rounded-xl gap-2 h-10 px-6 font-bold shadow-md shadow-primary/10"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'SAVING...' : 'SAVE'}
                </Button>
              </div>
            </div>
            <textarea
              value={docContent}
              onChange={(e) => { setDocContent(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="Start documenting your project ideas, features, and research..."
              className="flex-1 p-12 text-lg font-medium leading-relaxed resize-none focus:outline-none bg-transparent"
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
             <div className="p-8 bg-muted/50 rounded-[40px] mb-8">
               <FileText className="w-20 h-20 text-muted-foreground/20" />
             </div>
             <h3 className="text-3xl font-heading font-black mb-4 tracking-tight">Project Documentation</h3>
             <p className="text-muted-foreground font-medium max-w-md">
               Select an existing document or create a new one to start outlining your roadmap.
             </p>
             <Button onClick={handleCreateDoc} className="mt-8 h-14 rounded-2xl font-bold px-8 shadow-lg shadow-primary/20 gap-2">
               <Plus className="w-5 h-5" /> CREATE FIRST DOC
             </Button>
          </div>
        )}
      </div>

      {/* AI Sidepanel Overlay */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAiOpen(false)}>
           <div 
             className="w-[500px] h-full bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="p-8 border-b flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                     <BrainCircuit className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="text-xl font-heading font-black">AI Architect</h3>
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Assistant</p>
                   </div>
                 </div>
                 <Button variant="ghost" size="icon" aria-label="Close AI panel" className="rounded-full" onClick={() => setIsAiOpen(false)}>
                   <X className="w-5 h-5" />
                 </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 {aiResponse ? (
                   <div className="prose prose-sm dark:prose-invert max-w-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-muted/30 p-6 rounded-3xl border border-border/40 whitespace-pre-wrap font-medium leading-relaxed text-base">
                        <Typewriter text={aiResponse} />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-4 font-bold text-primary gap-2"
                        onClick={() => setAiResponse('')}
                      >
                         Clear response
                      </Button>
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center">
                      <Sparkles className="w-12 h-12 text-primary/20 mb-6" />
                      <p className="text-muted-foreground font-semibold px-8 leading-relaxed">
                        I can help you brainstorm features, write documentation, or create a roadmap for <span className="text-primary">{project.title}</span>.
                      </p>
                   </div>
                 )}
                 {isAiLoading && (
                   <div className="flex items-center gap-3 p-6 bg-muted/30 rounded-3xl border border-dashed border-primary/20 mt-6 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="font-bold text-sm text-primary uppercase tracking-widest">Architect is thinking...</span>
                   </div>
                 )}
              </div>

              <div className="p-8 border-t bg-muted/10">
                 <div className="relative">
                    <textarea 
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ask the Architect anything..."
                      className="w-full min-h-[120px] p-6 rounded-[32px] bg-background border border-border/60 font-medium focus:ring-2 focus:ring-primary/20 resize-none pr-16"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAskAi();
                        }
                      }}
                    />
                    <Button 
                      size="icon" 
                      className="absolute right-4 bottom-4 h-12 w-12 rounded-2xl shadow-lg shadow-primary/20 active:scale-90 transition-all"
                      onClick={handleAskAi}
                      disabled={isAiLoading || !aiInput.trim()}
                    >
                       <Send className="w-5 h-5" />
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Delete document confirmation */}
      <ConfirmModal
        isOpen={docToDelete !== null}
        onClose={() => setDocToDelete(null)}
        onConfirm={async () => {
          if (docToDelete) {
            await deleteProjectDoc(docToDelete, project.id);
            if (docToDelete === activeDocId) {
              setActiveDocId(null);
              setDocTitle('');
              setDocContent('');
              setHasUnsavedChanges(false);
            }
          }
          setDocToDelete(null);
        }}
        title="Delete document?"
        description="This document and its contents will be permanently removed. You cannot undo this action."
      />

      {/* Discard unsaved changes when switching documents */}
      <ConfirmModal
        isOpen={pendingDoc !== null}
        onClose={() => setPendingDoc(null)}
        onConfirm={() => {
          if (pendingDoc) loadDoc(pendingDoc);
          setPendingDoc(null);
        }}
        title="Discard unsaved changes?"
        description="You have unsaved edits in the current document. Switching now will discard them."
      />
    </div>
  );
}
