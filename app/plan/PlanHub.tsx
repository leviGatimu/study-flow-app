import type { ReactNode } from 'react';
import Link from 'next/link';
import { format, isSameMonth } from 'date-fns';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronRight,
  GraduationCap,
  Layers,
  LayoutGrid,
  School,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { HubTile } from '@/components/ui/hub-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

import { fromDayKey, type AgendaDay, type PlanHubData } from './plan-model';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const homeworkHref = (subject: string) => `/homeworks?subject=${encodeURIComponent(subject)}`;

/**
 * The Plan section's front door: one tile per Plan page, each carrying the
 * live fact that makes it worth opening, then the next seven days with every
 * kind of dated work merged into one list.
 */
export function PlanHub({ data }: { data: PlanHubData }) {
  const today = fromDayKey(data.todayKey);
  const { calendar, week, timetable, year } = data;
  const hasTimetable = timetable.blocks > 0;

  const nextExamLabel = calendar.nextExam
    ? `Next exam ${format(fromDayKey(calendar.nextExam.dateKey), 'EEE d')} · ${calendar.nextExam.title}`
    : 'No exams coming up';

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 animate-in fade-in duration-300">
      <PageHeader
        title="Plan"
        description={`${format(today, 'EEEE d MMMM yyyy')} · your calendar, week, timetable and term in one place.`}
      />

      <nav aria-label="Plan pages" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HubTile
          href="/calendar"
          icon={<Calendar />}
          label={`Calendar · ${calendar.monthLabel}`}
          tone="blue"
          value={
            calendar.monthBlocks + calendar.monthExams > 0
              ? `${plural(calendar.monthBlocks, 'block')}${calendar.monthExams ? ` · ${plural(calendar.monthExams, 'exam')}` : ''}`
              : 'Nothing this month'
          }
          detail={nextExamLabel}
        />
        <HubTile
          href="/timetable"
          icon={<LayoutGrid />}
          label="This Week"
          tone="emerald"
          value={week.total > 0 ? `${week.done} of ${week.total} done` : 'No blocks this week'}
          detail={
            week.total > 0
              ? `${Math.round((week.done / week.total) * 100)}% of this week's study blocks`
              : 'Blocks appear while a term is running'
          }
        />
        <HubTile
          href="/manage"
          icon={<Layers />}
          label="Weekly Timetable"
          tone="purple"
          value={hasTimetable ? plural(timetable.blocks, 'recurring block') : 'Not set up'}
          detail={
            hasTimetable
              ? `Across ${plural(timetable.days, 'day')} of the week`
              : 'Add the blocks you study every week'
          }
        />
        <HubTile
          href="/year"
          icon={<GraduationCap />}
          label="Year & Terms"
          tone="amber"
          value={year.value}
          detail={year.detail}
        />
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section
          className="min-w-0 lg:col-span-2"
          title="Next 7 days"
          description="Study blocks, homework due and exams, day by day."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar">
                Calendar <ChevronRight />
              </Link>
            </Button>
          }
        >
          {!hasTimetable && !data.isArchive && (
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                No weekly timetable yet, so no study blocks are planned.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/manage">Set up timetable</Link>
              </Button>
            </div>
          )}
          <Agenda days={data.agenda} todayKey={data.todayKey} />
        </Section>

        <div className="min-w-0 space-y-6">
          {data.overdueHomework.length > 0 && (
            <Section title="Overdue homework" description={plural(data.overdueCount, 'item') + ' past due'}>
              <Panel padded={false} className="divide-y divide-border">
                {data.overdueHomework.map((h) => (
                  <Link
                    key={h.id}
                    href={homeworkHref(h.subject)}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <AlertCircle className="size-4 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{h.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {h.subject} · was due {format(fromDayKey(h.dateKey), 'EEE d MMM')}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
                {data.overdueCount > data.overdueHomework.length && (
                  <Link
                    href="/homeworks"
                    className="block px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 last:rounded-b-2xl"
                  >
                    See all {data.overdueCount} overdue
                  </Link>
                )}
              </Panel>
            </Section>
          )}

          <Section title="Related">
            <Panel padded={false} className="divide-y divide-border">
              <RelatedLink href="/exams" icon={<GraduationCap />} label="Exams" detail="Dates, revision plans and results" />
              <RelatedLink href="/homeworks" icon={<BookOpen />} label="Homework" detail="Everything you have to hand in" />
              <RelatedLink href="/school-timetable" icon={<School />} label="School Timetable" detail="Your lessons during the school day" />
            </Panel>
          </Section>
        </div>
      </div>
    </div>
  );
}

function RelatedLink({ href, icon, label, detail }: { href: string; icon: ReactNode; label: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 first:rounded-t-2xl last:rounded-b-2xl"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Agenda({ days, todayKey }: { days: AgendaDay[]; todayKey: string }) {
  const empty = days.every((d) => d.tasks.total === 0 && d.homework.length === 0 && d.exams.length === 0);
  if (empty) {
    return (
      <EmptyState
        icon={<Calendar />}
        title="A clear week"
        description="No study blocks, homework or exams in the next 7 days."
      />
    );
  }

  const today = fromDayKey(todayKey);

  return (
    <Panel padded={false} className="divide-y divide-border">
      {days.map((day, i) => {
        const date = fromDayKey(day.dateKey);
        const isToday = i === 0;
        const nothing = day.tasks.total === 0 && day.homework.length === 0 && day.exams.length === 0;
        return (
          <div key={day.dateKey} className="flex gap-4 px-4 py-3.5 sm:px-5">
            <div
              className={cn(
                'flex w-12 shrink-0 flex-col items-center justify-center self-start rounded-xl py-1.5',
                isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              )}
            >
              <span className={cn('text-[11px] font-medium', isToday ? 'opacity-90' : 'text-muted-foreground')}>
                {format(date, 'EEE')}
              </span>
              <span className="font-heading text-lg font-semibold leading-none">{format(date, 'd')}</span>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {isToday ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEEE')}
                {!isSameMonth(date, today) && ` · ${format(date, 'MMMM')}`}
              </p>

              {nothing && <p className="text-sm text-muted-foreground">Nothing planned</p>}

              {day.exams.map((e) => (
                <AgendaLine
                  key={e.id}
                  href={`/exams/${encodeURIComponent(e.id)}`}
                  icon={<GraduationCap />}
                  tone="text-rose-600 dark:text-rose-400"
                  primary={e.title}
                  secondary={[kindLabel(e.kind), e.startTime].filter(Boolean).join(' · ')}
                />
              ))}

              {day.homework.map((h) => (
                <AgendaLine
                  key={h.id}
                  href={homeworkHref(h.subject)}
                  icon={<BookOpen />}
                  tone="text-amber-600 dark:text-amber-400"
                  primary={h.title}
                  secondary={`${h.subject} · homework due`}
                />
              ))}

              {day.tasks.total > 0 && (
                <AgendaLine
                  href="/timetable"
                  icon={<LayoutGrid />}
                  tone="text-primary"
                  primary={
                    <>
                      {plural(day.tasks.total, 'study block')}
                      <span className="font-normal text-muted-foreground">
                        {' · '}
                        {day.tasks.done > 0 ? `${day.tasks.done} done` : `from ${day.tasks.firstStart}`}
                        {day.tasks.missed > 0 && (
                          <span className="text-destructive">{` · ${day.tasks.missed} missed`}</span>
                        )}
                      </span>
                    </>
                  }
                  secondary={day.tasks.subjects.join(', ')}
                />
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

function AgendaLine({
  href,
  icon,
  tone,
  primary,
  secondary,
}: {
  href: string;
  icon: ReactNode;
  tone: string;
  primary: ReactNode;
  secondary?: string;
}) {
  return (
    <Link
      href={href}
      className="group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{primary}</span>
        {secondary && <span className="block truncate text-xs text-muted-foreground">{secondary}</span>}
      </span>
      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </Link>
  );
}

function kindLabel(kind: string) {
  const k = kind.toUpperCase();
  if (k === 'MIDTERM') return 'Midterm';
  return k.charAt(0) + k.slice(1).toLowerCase();
}
