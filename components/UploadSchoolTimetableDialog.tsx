'use client';

/**
 * Read a school timetable off a photo, then let the user fix it before it lands.
 *
 * Deliberately two steps. The model is good at reading a grid and bad at being
 * certain, and a misread digit moves a lesson by hours - which the student would
 * discover by missing it. So the extraction only ever produces a PROPOSAL, shown
 * as an editable list, and nothing is written until the button at the bottom is
 * pressed. Same shape as the exam-timetable importer for the same reason.
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  Loader2,
  Sparkles,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { readTimetableFile } from '@/lib/file-extract';
import { cn } from '@/lib/utils';
import { DAY_NAMES, weekdayOrder } from '@/lib/school';
import {
  extractSchoolTimetable,
  replaceSchoolTimetable,
  type SchoolLessonInput,
} from '@/lib/school-actions';

type Step = 'idle' | 'analyzing' | 'review' | 'saving';

/** Days that appear in the proposal, in the order a week runs. */
const daysIn = (lessons: SchoolLessonInput[]) =>
  [...new Set(lessons.map((l) => l.dayOfWeek))].sort((a, b) => weekdayOrder(a) - weekdayOrder(b));

/**
 * Controlled by the parent rather than wrapping its own trigger: the parent
 * already renders real buttons in two places (the empty state and the toolbar),
 * and a <span onClick> standing in for one of them would not be reachable from
 * the keyboard.
 */
export function UploadSchoolTimetableDialog({
  existingCount,
  onClose,
}: {
  /** How many lessons are already saved, so the button can say what it replaces. */
  existingCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [dropped, setDropped] = useState(0);
  const [lessons, setLessons] = useState<SchoolLessonInput[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => onClose();

  const handleFile = async (file: File) => {
    setError(null);
    setNoKey(false);
    setFileName(file.name);
    setStep('analyzing');
    try {
      const read = await readTimetableFile(file);
      const res = await extractSchoolTimetable(
        read.kind === 'image' ? { image: read.image } : { text: read.text }
      );

      if ('error' in res) {
        if (res.error.toLowerCase().includes('no ai api key')) setNoKey(true);
        setError(res.error);
        setStep('idle');
        return;
      }
      if (res.lessons.length === 0) {
        setError(
          'No lessons could be read from that file. Try a straighter, better-lit photo — or add your lessons by hand.'
        );
        setStep('idle');
        return;
      }

      setLessons(res.lessons);
      setDropped(res.dropped);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
      setStep('idle');
    }
  };

  const edit = (index: number, patch: Partial<SchoolLessonInput>) =>
    setLessons((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const save = async () => {
    setStep('saving');
    setError(null);
    const res = await replaceSchoolTimetable(lessons);
    if (res?.error) {
      setError(res.error);
      setStep('review');
      return;
    }
    router.refresh();
    close();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload your school timetable</DialogTitle>
          <DialogDescription>
            A photo of the timetable on the wall works. You get to check and fix everything
            before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center cursor-pointer transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}
            >
              <Upload className="w-7 h-7 text-muted-foreground" />
              <p className="font-medium text-foreground">Drop a photo here, or click to choose</p>
              <p className="text-sm text-muted-foreground">
                Image, PDF or Word document. A clear, straight-on photo reads best.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="text-destructive">{error}</p>
                  {noKey && (
                    <Link href="/settings" className="underline text-destructive font-medium">
                      Add an AI key in Settings
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="font-medium text-foreground">Reading {fileName}…</p>
            <p className="text-sm text-muted-foreground">This takes a few seconds.</p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {lessons.length} lesson{lessons.length === 1 ? '' : 's'} read from {fileName}
                </p>
                <p className="text-muted-foreground">
                  Check the times and names. {dropped > 0 && `${dropped} row${dropped === 1 ? '' : 's'} could not be read and ${dropped === 1 ? 'was' : 'were'} left out. `}
                  Nothing is saved until you press the button below.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {daysIn(lessons).map((day) => (
                <div key={day} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">{DAY_NAMES[day]}</h4>
                  {lessons
                    .map((lesson, index) => ({ lesson, index }))
                    .filter(({ lesson }) => lesson.dayOfWeek === day)
                    .map(({ lesson, index }) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2"
                      >
                        <Input
                          type="time"
                          value={lesson.startTime}
                          aria-label="Starts"
                          className="w-28 shrink-0"
                          onChange={(e) => edit(index, { startTime: e.target.value })}
                        />
                        <Input
                          type="time"
                          value={lesson.endTime}
                          aria-label="Ends"
                          className="w-28 shrink-0"
                          onChange={(e) => edit(index, { endTime: e.target.value })}
                        />
                        <Input
                          value={lesson.subject}
                          aria-label="Lesson"
                          className="flex-1 min-w-0"
                          onChange={(e) => edit(index, { subject: e.target.value })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          aria-label={`Remove ${lesson.subject}`}
                          onClick={() =>
                            setLessons((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border/40">
              <Button variant="ghost" onClick={close} disabled={step === 'saving'}>
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button onClick={save} disabled={step === 'saving' || lessons.length === 0}>
                {step === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : existingCount > 0 ? (
                  `Replace my ${existingCount} saved lessons`
                ) : (
                  `Save ${lessons.length} lessons`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
