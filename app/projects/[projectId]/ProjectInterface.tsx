'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BrainCircuit,
  FileText,
  Gauge,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { cn } from '@/lib/utils';
import {
  createProjectDoc,
  deleteProjectDoc,
  updateProjectDoc,
  updateProjectProgress,
} from '@/lib/project-actions';
import { askAIBuddy } from '@/lib/ai-actions';
import { ProjectWithDocs } from '@/lib/types';

function Typewriter({ text, speed = 10 }: { text: string; speed?: number }) {
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
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
}

type DocLite = { id: string; title: string; content: string };

export function ProjectInterface({ project }: { project: ProjectWithDocs }) {
  const archived = useIsArchived();
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [docContent, setDocContent] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [projectProgress, setProjectProgress] = useState(project.progress);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<DocLite | null>(null);

  // Warn before leaving or refreshing with unsaved edits.
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

  const loadDoc = (doc: DocLite) => {
    setActiveDocId(doc.id);
    setDocTitle(doc.title);
    setDocContent(doc.content);
    setHasUnsavedChanges(false);
  };

  const handleSelectDoc = (doc: DocLite) => {
    if (doc.id === activeDocId) return;
    if (hasUnsavedChanges) {
      // Hold the switch until the student confirms discarding their edits.
      setPendingDoc(doc);
      return;
    }
    loadDoc(doc);
  };

  const handleCreateDoc = async () => {
    const title = 'Untitled doc';
    setIsCreating(true);
    try {
      const newDoc = await createProjectDoc(project.id, { title, content: '' });
      loadDoc({ id: newDoc.id, title, content: '' });
    } catch (error) {
      console.error(error);
      toast.error('That doc could not be created. Try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!activeDocId) return;
    setIsSaving(true);
    try {
      await updateProjectDoc(activeDocId, project.id, { title: docTitle, content: docContent });
      setHasUnsavedChanges(false);
      toast.success('Saved.');
    } catch (error) {
      console.error(error);
      toast.error('Your changes could not be saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAskAi = async () => {
    if (!aiInput.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setAiResponse('');
    const context = `Context: I am working on a project titled "${project.title}". ${
      project.description ? `Description: ${project.description}` : ''
    }. Existing docs: ${project.docs.map((d) => d.title).join(', ')}.`;
    const result = await askAIBuddy(`${context}\n\nUser Question: ${aiInput}`, []);
    setIsAiLoading(false);
    if (result.text) setAiResponse(result.text);
    else if (result.error) setAiResponse(`Error: ${result.error}`);
    setAiInput('');
  };

  return (
    <Page>
      <PageHeader
        title={project.title}
        description={project.description || 'Plan it in docs and keep track of how far along it is.'}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/projects">
                <ArrowLeft />
                All projects
              </Link>
            </Button>
            {!archived && (
              <Button size="lg" onClick={handleCreateDoc} disabled={isCreating}>
                {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                New doc
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <Panel>
              <PanelTitle
                icon={<Gauge />}
                action={<span className="text-sm font-bold tabular-nums text-primary">{projectProgress}%</span>}
              >
                Progress
              </PanelTitle>
              <Slider
                value={[projectProgress]}
                onValueChange={(val) => setProjectProgress(val[0])}
                // Saved once when the thumb is let go, not on every step.
                onValueCommit={(val) => {
                  updateProjectProgress(project.id, val[0]).catch(() =>
                    toast.error('Progress could not be saved. Try again.')
                  );
                }}
                max={100}
                step={1}
                disabled={archived}
                aria-label="Project progress"
                className="py-2"
              />
            </Panel>

            <Panel>
              <PanelTitle icon={<FileText />}>Docs</PanelTitle>
              {project.docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No docs yet.</p>
              ) : (
                <ul className="space-y-2">
                  {project.docs.map((doc) => (
                    <li key={doc.id} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectDoc(doc)}
                        aria-current={activeDocId === doc.id ? 'true' : undefined}
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          activeDocId === doc.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </button>
                      {!archived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-auto w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete doc ${doc.title}`}
                          onClick={() => setDocToDelete(doc.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelTitle icon={<BrainCircuit />}>Ask AI</PanelTitle>
              <p className="text-sm text-muted-foreground">
                Brainstorm features, outline a doc or plan the next steps for this project.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setIsAiOpen(true)}>
                <Sparkles />
                Ask about {project.title}
              </Button>
            </Panel>
          </div>

          <div className="lg:col-span-8">
            <Panel className="flex min-h-[60vh] flex-col">
              {activeDocId ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                    <input
                      value={docTitle}
                      aria-label="Doc title"
                      readOnly={archived}
                      onChange={(e) => {
                        setDocTitle(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="min-w-0 flex-1 bg-transparent font-heading text-xl font-bold outline-none focus-visible:underline"
                    />
                    {!archived && (
                      <div className="flex shrink-0 items-center gap-3">
                        {hasUnsavedChanges && (
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            Unsaved changes
                          </span>
                        )}
                        <Button onClick={handleSaveDoc} disabled={isSaving || !hasUnsavedChanges}>
                          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                  <textarea
                    value={docContent}
                    aria-label="Doc content"
                    readOnly={archived}
                    onChange={(e) => {
                      setDocContent(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Ideas, features, research, a plan…"
                    className="mt-4 flex-1 resize-none bg-transparent text-base leading-relaxed outline-none"
                  />
                </>
              ) : (
                <EmptyState
                  className="my-auto"
                  icon={<FileText />}
                  title={project.docs.length === 0 ? 'Start the first doc' : 'Pick a doc to open it'}
                  description="Docs hold the plan: what you are building, what is left, and what you have found out."
                  action={
                    !archived && (
                      <Button onClick={handleCreateDoc} disabled={isCreating}>
                        {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                        New doc
                      </Button>
                    )
                  }
                />
              )}
            </Panel>
          </div>
        </div>
      </PageBody>

      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ask AI</DialogTitle>
            <DialogDescription>About {project.title}. It can see the project&apos;s description and doc titles.</DialogDescription>
          </DialogHeader>

          <div className="min-h-32 flex-1 overflow-y-auto">
            {isAiLoading ? (
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </p>
            ) : aiResponse ? (
              <div className="rounded-xl border border-border/40 bg-muted/40 p-4">
                <Typewriter text={aiResponse} />
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAiResponse('')}>
                  Clear
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Try &ldquo;What should the first milestone be?&rdquo; or &ldquo;Outline a doc for the testing plan.&rdquo;
              </p>
            )}
          </div>

          <div className="relative">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              aria-label="Your question"
              placeholder="Ask anything about this project"
              className="min-h-24 w-full resize-none rounded-xl border border-input bg-transparent p-3 pr-14 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskAi();
                }
              }}
            />
            <Button
              size="icon"
              aria-label="Send question"
              className="absolute bottom-3 right-3"
              onClick={handleAskAi}
              disabled={isAiLoading || !aiInput.trim()}
            >
              <Send />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
        title="Delete this doc?"
        description="The doc and everything in it will be removed. You cannot undo this."
      />

      <ConfirmModal
        isOpen={pendingDoc !== null}
        onClose={() => setPendingDoc(null)}
        onConfirm={() => {
          if (pendingDoc) loadDoc(pendingDoc);
          setPendingDoc(null);
        }}
        title="Discard unsaved changes?"
        description="You have unsaved edits in this doc. Switching now will discard them."
      />
    </Page>
  );
}
