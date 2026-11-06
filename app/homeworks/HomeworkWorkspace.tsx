'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardList, FileUp, Loader2, PenLine, RotateCcw, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { completeHomework, reopenHomework, saveHomeworkWork, updateHomeworkDetails } from '@/lib/homework-actions';
import { HOMEWORK_TEXT_MAX, HOMEWORK_TITLE_MAX, isImageUrl } from '@/lib/homework-work';
import { useIsArchived } from '@/components/ArchiveContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FileSlot, uploadName } from './FileSlot';

export type WorkspaceHomework = {
  id: string;
  title: string;
  subject: string;
  dueDay: string;
  description: string;
  answer: string;
  briefFileUrl: string | null;
  answerFileUrl: string | null;
  proofUrl: string | null;
  isCompleted: boolean;
  /** "Thu 6 Nov", in the user's timezone. */
  completedLabel: string | null;
};

type FileState = { picked: File | null; removed: boolean };
const NO_CHANGE: FileState = { picked: null, removed: false };

/**
 * One homework, worked on in one place: what was set and your answers (text
 * and an optional photo or PDF each), then finishing it with proof.
 */
export function HomeworkWorkspace({
  homework: hw,
  subjects,
  onDirtyChange,
}: {
  homework: WorkspaceHomework;
  subjects: string[];
  /** So a list beside this can warn before switching away from unsaved work. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const archived = useIsArchived();
  const [saving, startSaving] = useTransition();

  const [description, setDescription] = useState(hw.description);
  const [answer, setAnswer] = useState(hw.answer);
  const [brief, setBrief] = useState<FileState>(NO_CHANGE);
  const [answerFile, setAnswerFile] = useState<FileState>(NO_CHANGE);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    description !== hw.description ||
    answer !== hw.answer ||
    brief.picked !== null ||
    brief.removed ||
    answerFile.picked !== null ||
    answerFile.removed;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  /** Save the work; resolves true when saved (or nothing to save). */
  const saveWork = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    const form = new FormData();
    form.set('homeworkId', hw.id);
    form.set('description', description);
    form.set('answer', answer);
    if (brief.picked) form.set('briefFile', brief.picked);
    if (brief.removed) form.set('removeBriefFile', '1');
    if (answerFile.picked) form.set('answerFile', answerFile.picked);
    if (answerFile.removed) form.set('removeAnswerFile', '1');
    try {
      const result = await saveHomeworkWork(form);
      if ('error' in result && result.error) {
        setError(result.error);
        return false;
      }
      setError(null);
      setBrief(NO_CHANGE);
      setAnswerFile(NO_CHANGE);
      router.refresh();
      return true;
    } catch {
      setError('Could not save. Check your connection and try again.');
      return false;
    }
  }, [dirty, hw.id, description, answer, brief, answerFile, router]);

  const save = () =>
    startSaving(async () => {
      if (await saveWork()) toast.success('Saved.');
    });

  // Ctrl+S / Cmd+S saves; leaving with unsaved work asks first.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const readOnly = archived;

  return (
    <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-12">
      <div className="min-w-0 space-y-6 @3xl:col-span-8">
        <Panel>
          <PanelTitle icon={<ClipboardList />}>What was set</PanelTitle>
          <div className="space-y-4">
            <Textarea
              aria-label="What was set"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              maxLength={HOMEWORK_TEXT_MAX}
              placeholder="Type or paste the task as it was given: the questions, page numbers, anything the teacher said."
              className="min-h-32 field-sizing-content text-[15px] leading-relaxed"
            />
            <FileSlot
              label="what was set"
              url={hw.briefFileUrl}
              picked={brief.picked}
              removed={brief.removed}
              disabled={readOnly}
              onPick={(picked) => setBrief({ picked, removed: false })}
              onRemove={() => setBrief({ picked: null, removed: true })}
              onUndo={() => setBrief(NO_CHANGE)}
            />
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={<PenLine />}>My answers</PanelTitle>
          <div className="space-y-4">
            <Textarea
              aria-label="My answers"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              readOnly={readOnly}
              maxLength={HOMEWORK_TEXT_MAX}
              placeholder="Write your answers here, or attach a photo of your work below."
              className="min-h-56 field-sizing-content text-[15px] leading-relaxed"
            />
            <FileSlot
              label="your answers"
              url={hw.answerFileUrl}
              picked={answerFile.picked}
              removed={answerFile.removed}
              disabled={readOnly}
              onPick={(picked) => setAnswerFile({ picked, removed: false })}
              onRemove={() => setAnswerFile({ picked: null, removed: true })}
              onUndo={() => setAnswerFile(NO_CHANGE)}
            />
          </div>
        </Panel>

        {!readOnly && (
          <div
            className={cn(
              'sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur transition-opacity',
              dirty || error ? 'border-primary/30 opacity-100' : 'pointer-events-none border-border/60 opacity-0'
            )}
            aria-hidden={!dirty && !error}
          >
            <p role={error ? 'alert' : undefined} className={cn('text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
              {error ?? 'You have unsaved changes.'}
            </p>
            <Button onClick={save} disabled={saving || !dirty} className="shrink-0">
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
              <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] sm:inline">Ctrl S</kbd>
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-6 @3xl:col-span-4 lg:sticky lg:top-6">
        <FinishPanel homework={hw} readOnly={readOnly} saveFirst={saveWork} hasUnsaved={dirty} />
        <DetailsPanel homework={hw} subjects={subjects} readOnly={readOnly} />
      </div>
    </div>
  );
}

function FinishPanel({
  homework: hw,
  readOnly,
  saveFirst,
  hasUnsaved,
}: {
  homework: WorkspaceHomework;
  readOnly: boolean;
  saveFirst: () => Promise<boolean>;
  hasUnsaved: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [proof, setProof] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canReuse = Boolean(hw.proofUrl);

  const finish = () =>
    start(async () => {
      if (!(await saveFirst())) return;
      const form = new FormData();
      form.set('homeworkId', hw.id);
      if (proof) form.set('file', proof);
      else if (canReuse) form.set('keepProof', '1');
      try {
        const result = await completeHomework(form);
        if (result.error) return void toast.error(result.error);
        toast.success('Homework finished. +200 XP');
        setProof(null);
        router.refresh();
      } catch {
        toast.error('Could not finish it. Check your connection and try again.');
      }
    });

  const reopen = () =>
    start(async () => {
      try {
        const result = await reopenHomework(hw.id);
        if (result.error) return void toast.error(result.error);
        toast.success('Marked as not done.');
        router.refresh();
      } catch {
        toast.error('Could not change it. Try again.');
      }
    });

  if (hw.isCompleted) {
    return (
      <Panel className="border-success/30">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">Finished</p>
            <p className="text-sm text-muted-foreground">{hw.completedLabel ? `On ${hw.completedLabel}` : 'Done'}</p>
          </div>
        </div>
        {hw.proofUrl && <ProofPreview url={hw.proofUrl} />}
        {!readOnly && (
          <Button variant="outline" onClick={reopen} disabled={pending} className="mt-4 w-full">
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Mark as not done
          </Button>
        )}
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle icon={<CheckCircle2 />}>Finish</PanelTitle>
      <p className="mb-4 text-sm text-muted-foreground">Add a photo or PDF of the finished work as proof, then mark it as finished.</p>
      {readOnly ? (
        <p className="text-sm text-muted-foreground">This year is finished, so its homework is read-only.</p>
      ) : (
        <div className="space-y-4">
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label="Proof of work"
            onChange={(e) => {
              setProof(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          {proof ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
              <FileUp className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{proof.name}</span>
              <button type="button" onClick={() => setProof(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Change
              </button>
            </div>
          ) : canReuse ? (
            <div className="space-y-2">
              <ProofPreview url={hw.proofUrl!} />
              <button type="button" onClick={() => input.current?.click()} className="text-xs font-medium text-primary hover:underline">
                Use a different file
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <FileUp className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Add proof of work</span>
              <span className="text-xs text-muted-foreground">Photo, screenshot or PDF</span>
            </button>
          )}
          <Button onClick={finish} disabled={pending || (!proof && !canReuse)} className="w-full" size="lg">
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark as finished
          </Button>
          {hasUnsaved && <p className="text-xs text-muted-foreground">Your unsaved changes are saved first.</p>}
        </div>
      )}
    </Panel>
  );
}

function ProofPreview({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl border border-border/60 bg-muted/30 transition-colors hover:border-primary/40"
    >
      {isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads, served by our own route
        <img src={url} alt="Proof of work" className="max-h-56 w-full object-contain" />
      ) : null}
      <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
        <FileUp className="size-4 shrink-0 text-primary" />
        <span className="truncate">{uploadName(url)}</span>
        <span className="ml-auto shrink-0 text-xs text-primary">Open</span>
      </span>
    </a>
  );
}

function DetailsPanel({ homework: hw, subjects, readOnly }: { homework: WorkspaceHomework; subjects: string[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(hw.title);
  const [subject, setSubject] = useState(hw.subject);
  const [dueDay, setDueDay] = useState(hw.dueDay);
  const changed = title !== hw.title || subject !== hw.subject || dueDay !== hw.dueDay;
  const options = subjects.includes(hw.subject) ? subjects : [hw.subject, ...subjects];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const result = await updateHomeworkDetails(hw.id, { title, subject, dueDay });
        if (result.error) return void toast.error(result.error);
        toast.success('Details saved.');
        router.refresh();
      } catch {
        toast.error('Could not save the details. Try again.');
      }
    });
  };

  return (
    <Panel>
      <PanelTitle icon={<Settings2 />}>Details</PanelTitle>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={readOnly || pending} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hw-title">Title</Label>
            <Input id="hw-title" value={title} maxLength={HOMEWORK_TITLE_MAX} required onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hw-subject">Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="hw-subject" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hw-due">Due</Label>
            <Input id="hw-due" type="date" required value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </div>
        </fieldset>
        {!readOnly && changed && (
          <Button type="submit" variant="outline" disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save details
          </Button>
        )}
      </form>
    </Panel>
  );
}
