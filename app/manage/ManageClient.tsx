'use client';

import { useMemo } from 'react';
import { Clock, Layers } from 'lucide-react';

import { Panel, PanelTitle } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { ManageForm } from '@/components/ManageForm';
import { DeleteTemplateButton } from '@/components/DeleteTemplateButton';
import { EditTemplateForm } from '@/components/EditTemplateForm';
import { useIsArchived } from '@/components/ArchiveContext';
import { cn } from '@/lib/utils';
import { DAY_NAMES, toMinutes } from '@/lib/school';

import { StudyLegend, StudyTypeIcon, StudyTypePill, studyBlockClass } from '../timetable/study-block';

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

const blockMinutes = (start: string, end: string) => {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e < s) e += 24 * 60; // a block that runs past midnight
  return e - s;
};

const formatMinutes = (mins: number) => {
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h${rem > 0 ? ` ${rem}m` : ''}`;
  return `${rem}m`;
};

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
        {WEEK.map((day) => {
          const blocks = byDay.get(day) ?? [];
          const minutes = blocks.reduce((sum, t) => sum + blockMinutes(t.startTime, t.endTime), 0);
          return (
            <Panel key={day}>
              <PanelTitle
                className={cn(blocks.length === 0 && 'mb-0')}
                action={
                  blocks.length > 0 ? (
                    <span className="text-sm font-medium text-muted-foreground">
                      {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} · {formatMinutes(minutes)}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">Free</span>
                  )
                }
              >
                {DAY_NAMES[day]}
              </PanelTitle>

              {blocks.length > 0 && (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {blocks.map((t) => (
                    <li
                      key={t.id}
                      className={cn('flex items-center justify-between gap-3 px-4 py-3', studyBlockClass(t.type))}
                    >
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-2 font-bold text-foreground">
                          <StudyTypeIcon type={t.type} />
                          <span className="truncate">{t.subject}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
                          <span className="flex items-center gap-1 tabular-nums">
                            <Clock aria-hidden="true" className="size-3" />
                            {t.startTime} – {t.endTime}
                          </span>
                          <span>{formatMinutes(blockMinutes(t.startTime, t.endTime))}</span>
                          {t.deadlineDay && <span>Due {t.deadlineDay}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="hidden sm:inline-flex">
                          <StudyTypePill type={t.type} />
                        </span>
                        <EditTemplateForm template={t} subjects={subjects} />
                        <DeleteTemplateButton id={t.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
