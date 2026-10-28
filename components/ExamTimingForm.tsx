'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { updateExamDetails } from '@/lib/exam-actions';
import { examDay, validateExamTimes, type TimedExam } from '@/lib/exam-time';
import { useIsArchived } from '@/components/ArchiveContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel, PanelTitle } from '@/components/ui/panel';

export function ExamTimingForm({ exam, timezone }: { exam: TimedExam & { id: string }; timezone: string }) {
  const router = useRouter();
  const archived = useIsArchived();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(examDay(exam.date));
  const [start, setStart] = useState(exam.startTime ?? '');
  const [end, setEnd] = useState(exam.endTime ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel>
      <PanelTitle icon={<Clock />}>Exam date & time</PanelTitle>
      <form onSubmit={(event) => {
        event.preventDefault();
        const invalid = validateExamTimes(start, end);
        if (invalid) return setError(invalid);
        setError(null);
        startTransition(async () => {
          try {
            const result = await updateExamDetails(exam.id, { date: new Date(`${date}T00:00:00Z`), startTime: start || null, endTime: end || null });
            if (result.error) return setError(result.error);
            toast.success('Exam time saved.');
            router.refresh();
          } catch { setError('Could not save the exam time. Please try again.'); }
        });
      }} className="space-y-4">
        <fieldset disabled={archived || pending} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="edit-exam-date">Date</Label><Input id="edit-exam-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="edit-exam-start">Starts</Label><Input id="edit-exam-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="edit-exam-end">Ends</Label><Input id="edit-exam-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </fieldset>
        <p className="text-sm text-muted-foreground">Times use {timezone}. At the end time, this exam becomes done with marks pending. An earlier end time means the next day. Leave both blank if the time is unknown.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!archived && <Button disabled={pending}>{pending ? 'Saving…' : 'Save exam time'}</Button>}
      </form>
    </Panel>
  );
}
