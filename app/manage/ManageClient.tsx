'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { ManageForm } from '@/components/ManageForm';
import { DeleteTemplateButton } from '@/components/DeleteTemplateButton';
import { EditTemplateForm } from '@/components/EditTemplateForm';
import { useIsArchived } from '@/components/ArchiveContext';
import { DAY_NAMES, toMinutes } from '@/lib/school';

import { StudyLegend } from '../timetable/study-block';
import { blockMinutes, formatMinutes } from '@/lib/schedule-layout';
import { ScheduleBoard } from '@/components/ScheduleBoard';

type TemplateType = {
  id: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

/** Monday first, as the schema's 0=Sunday dayOfWeek values. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function ManageClient({
  initialTemplates,
  subjects,
}: {
  initialTemplates: TemplateType[];
  subjects: { id: string; name: string }[];
}) {
  const archived = useIsArchived();

  const byDay = useMemo(() => {
    const map = new Map<number, TemplateType[]>();
    for (const t of initialTemplates) {
      const list = map.get(t.dayOfWeek) ?? [];
      list.push(t);
      map.set(t.dayOfWeek, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    }
    return map;
  }, [initialTemplates]);

  const stats = useMemo(() => {
    const dayMinutes = new Map<number, number>();
    let total = 0;
    for (const t of initialTemplates) {
      const mins = blockMinutes(t.startTime, t.endTime);
      total += mins;
      dayMinutes.set(t.dayOfWeek, (dayMinutes.get(t.dayOfWeek) ?? 0) + mins);
    }
    let busiest: number | null = null;
    for (const day of WEEK) {
      const mins = dayMinutes.get(day) ?? 0;
      if (mins > 0 && (busiest === null || mins > (dayMinutes.get(busiest) ?? 0))) busiest = day;
    }
    return {
      total,
      homework: initialTemplates.filter((t) => t.type !== 'REVISION').length,
      revision: initialTemplates.filter((t) => t.type === 'REVISION').length,
      busiest,
      busiestMinutes: busiest === null ? 0 : (dayMinutes.get(busiest) ?? 0),
    };
  }, [initialTemplates]);

  if (initialTemplates.length === 0) {
    return (
      <EmptyState
        icon={<Layers />}
        title="No study routine yet"
        description={
          archived
            ? 'This academic year finished without a study routine recorded.'
            : 'Add the blocks you study every week - "Maths, Thursday 19:00 to 21:30". Each one appears on its weekday in your Week and Month, ready to tick off.'
        }
        action={archived ? undefined : <ManageForm subjects={subjects} variant="outline" />}
        className="py-12"
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-border/60 pb-6 text-sm">
        <p><span className="mr-2 text-muted-foreground">Weekly study</span><strong className="font-medium tabular-nums">{formatMinutes(stats.total)}</strong></p>
        <p><span className="mr-2 text-muted-foreground">Routine</span><strong className="font-medium">{initialTemplates.length} blocks across {byDay.size} days</strong></p>
        {stats.busiest !== null && <p><span className="mr-2 text-muted-foreground">Busiest day</span><strong className="font-medium">{DAY_NAMES[stats.busiest]}</strong></p>}
      </div>
      <StudyLegend />
      <ScheduleBoard
        title="Your recurring week"
        description="Select a block to edit its time, subject or deadline"
        emptyLabel="No study planned"
        days={WEEK.map((day) => {
          const blocks = byDay.get(day) ?? [];
          const minutes = blocks.reduce((sum, block) => sum + blockMinutes(block.startTime, block.endTime), 0);
          return { key: String(day), title: DAY_NAMES[day], summary: blocks.length ? `${blocks.length} blocks · ${formatMinutes(minutes)}` : 'Free evening' };
        })}
        entries={initialTemplates.map((template) => ({
          id: template.id,
          day: String(template.dayOfWeek),
          title: template.subject,
          startTime: template.startTime,
          endTime: template.endTime,
          kind: template.type === 'REVISION' ? 'revision' : 'homework',
          detail: template.deadlineDay ? `Due ${template.deadlineDay} · Repeats every week` : 'Repeats every week',
        }))}
        renderActions={archived ? undefined : (entry) => {
          const template = initialTemplates.find((item) => item.id === entry.id);
          return template && <><EditTemplateForm template={template} subjects={subjects} showLabel /><DeleteTemplateButton id={template.id} subject={template.subject} showLabel /></>;
        }}
      />
    </>
  );
}
