'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';

import { Panel } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { ManageForm } from '@/components/ManageForm';
import { DeleteTemplateButton } from '@/components/DeleteTemplateButton';
import { EditTemplateForm } from '@/components/EditTemplateForm';
import { useIsArchived } from '@/components/ArchiveContext';
import { DAY_NAMES, toMinutes } from '@/lib/school';

import { StudyLegend } from '../timetable/study-block';
import { DayBlock, DayColumns, blockMinutes, formatMinutes } from '@/components/DayColumns';

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
      <Panel>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat label="Study time per week" value={formatMinutes(stats.total)} />
          <Stat
            label="Blocks"
            value={initialTemplates.length}
            hint={`${stats.homework} homework · ${stats.revision} revision`}
          />
          <Stat
            label="Busiest day"
            value={stats.busiest === null ? '-' : DAY_NAMES[stats.busiest]}
            hint={stats.busiest === null ? undefined : formatMinutes(stats.busiestMinutes)}
          />
          <Stat
            label="Days with study"
            value={`${byDay.size} / 7`}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        <StudyLegend />
        <DayColumns
          label="Weekly study routine, Monday to Sunday"
          days={WEEK.map((day) => {
            const blocks = byDay.get(day) ?? [];
            const minutes = blocks.reduce((sum, t) => sum + blockMinutes(t.startTime, t.endTime), 0);
            return {
              key: String(day),
              title: DAY_NAMES[day],
              empty: 'Free',
              summary:
                blocks.length > 0
                  ? { label: `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}`, value: formatMinutes(minutes) }
                  : null,
              items: blocks.map((t) => {
                const revision = t.type === 'REVISION';
                return (
                  <DayBlock
                    key={t.id}
                    accent={revision ? 'revision' : 'homework'}
                    srLabel={revision ? 'Revision' : 'Homework'}
                    time={`${t.startTime} – ${t.endTime}`}
                    title={t.subject}
                    meta={
                      <>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatMinutes(blockMinutes(t.startTime, t.endTime))}
                        </span>
                        {t.deadlineDay && <span>· Due {t.deadlineDay}</span>}
                      </>
                    }
                    actions={
                      <>
                        <EditTemplateForm template={t} subjects={subjects} />
                        <DeleteTemplateButton id={t.id} subject={t.subject} />
                      </>
                    }
                  />
                );
              }),
            };
          })}
        />
      </div>
    </>
  );
}
