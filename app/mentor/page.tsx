import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, BookOpen, CalendarDays, Clock, Eye, FileText, Flame, GraduationCap, History, LogOut, Target } from 'lucide-react';

import { getMentorSession, getUserId } from '@/lib/auth';
import { getCurrentUserTimezone, getDailySummaries, getWeeklySummaries, logoutUser } from '@/lib/actions';
import { prisma } from '@/lib/prisma';
import { getScheduleState } from '@/lib/term';
import { taskDayKey } from '@/lib/schedule-placement';
import { getZonedNow } from '@/lib/utils';
import { lastSeenLabel } from '@/lib/last-seen';
import { dailyReports, weeklyReports, type ReportData } from '@/lib/report-model';
import { addDays, changeLabel, hoursMinutes, mentorStats, type MentorDay, type MentorStats } from '@/lib/mentor-model';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const DAY = 'yyyy-MM-dd';
/** Enough history for the 14-day chart, last week and the 30-day subjects. */
const LOOKBACK_DAYS = 40;

/**
 * A mentor's own home: one calm page about how the student is doing, not the
 * student's planner. Read top to bottom like a report card. Links at the top
 * open the student's own pages read-only when the mentor wants the detail.
 * Students are sent to their dashboard; this page is only for mentors.
 */
export default async function MentorPage() {
  const mentor = await getMentorSession();
  const userId = await getUserId();
  if (!userId) redirect('/welcome');
  if (!mentor) redirect('/');

  const timeZone = await getCurrentUserTimezone();
  const today = format(getZonedNow(timeZone), DAY);
  const since = new Date(Date.parse(`${addDays(today, -LOOKBACK_DAYS)}T00:00:00Z`));

  const [progress, schedule, tasks, exams, homework, dailyList, weeklyList] = await Promise.all([
    prisma.userProgress.findUnique({
      where: { userId },
      select: { name: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
    }),
    getScheduleState(userId),
    prisma.task.findMany({
      where: { userId, isDeleted: false, date: { gte: since } },
      select: { subject: true, startTime: true, endTime: true, date: true, isDone: true, isMissed: true },
    }),
    prisma.examEvent.findMany({
      where: { userId, score: { not: null } },
      select: { title: true, date: true, score: true, maxScore: true, subject: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 60,
    }),
    prisma.homework.findMany({
      where: { userId, isCompleted: false },
      select: { dueDate: true },
    }),
    getDailySummaries(),
    getWeeklySummaries(),
  ]);

  const stats = mentorStats(
    tasks.map((t) => ({ ...t, day: taskDayKey(t.date, timeZone) })),
    exams.map((e) => ({
      title: e.title,
      subject: e.subject?.name ?? null,
      day: taskDayKey(e.date, timeZone),
      score: e.score,
      maxScore: e.maxScore,
    })),
    today
  );

  // Homework due dates are stored as UTC midnight of the chosen day.
  const dueKey = (d: Date) => d.toISOString().slice(0, 10);
  const homeworkOpen = homework.length;
  const homeworkLate = homework.filter((h) => dueKey(h.dueDate) < today).length;

  const latestDaily = dailyReports(dailyList.map((d) => ({ ...d, key: format(d.date, DAY) })))[0] ?? null;
  const latestWeekly =
    weeklyReports(weeklyList.map((w) => ({ ...w, startKey: format(w.startDate, DAY), endKey: format(w.endDate, DAY) })))[0] ?? null;

  const name = progress?.name?.trim() || 'Your student';
  const where = [schedule.classLabel, schedule.termName].filter(Boolean).join(' · ');

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-semibold text-foreground">{name}&apos;s progress</p>
              <p className="truncate text-xs text-muted-foreground">
                Mentor view · read only{mentor ? ` · signed in as ${mentor.username}` : ''}
              </p>
            </div>
          </div>
          <nav aria-label="Student pages" className="flex flex-wrap items-center gap-1">
            <NavLink href="/timetable" icon={<CalendarDays />}>Week</NavLink>
            <NavLink href="/history" icon={<History />}>History</NavLink>
            <NavLink href="/summaries" icon={<FileText />}>Reports</NavLink>
            <NavLink href="/marks" icon={<GraduationCap />}>Marks</NavLink>
            <form action={logoutUser}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut /> Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {where || 'No academic year set up yet'}
              {schedule.isRunning ? '' : ' · not studying on a schedule right now'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Last active: <span className="font-medium text-foreground">{lastActiveLabel(progress?.lastActiveDate ?? null)}</span>
          </p>
        </section>

        <HeadlineNumbers stats={stats} streak={progress?.currentStreak ?? 0} best={progress?.longestStreak ?? 0} />

        <Card title="Study time, last 14 days" icon={<Clock />}>
          <StudyChart days={stats.last14} today={today} />
        </Card>

        <Card title="Subjects, last 30 days" icon={<BookOpen />}>
          <SubjectsTable stats={stats} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Recent marks"
            icon={<GraduationCap />}
            action={<Link href="/marks" className="text-xs font-medium text-primary hover:underline">All marks</Link>}
          >
            <MarksList stats={stats} />
          </Card>
          <Card
            title="Latest reports"
            icon={<FileText />}
            action={<Link href="/summaries" className="text-xs font-medium text-primary hover:underline">All reports</Link>}
          >
            <div className="space-y-2">
              <ReportRow label="Weekly" report={latestWeekly} href="/summaries?view=weekly" />
              <ReportRow label="Daily" report={latestDaily} href="/summaries?view=daily" />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Homework:</span>
              <span className="font-medium text-foreground">{homeworkOpen} to do</span>
              {homeworkLate > 0 && <span className="font-medium text-destructive">· {homeworkLate} late</span>}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

/** When the student was last in the app, against this request's clock. */
function lastActiveLabel(lastSeen: Date | null): string {
  return lastSeenLabel(lastSeen, Date.now());
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        {icon}
        <span className="hidden sm:inline">{children}</span>
        <span className="sr-only sm:hidden">{children}</span>
      </Link>
    </Button>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-4" aria-hidden>{icon}</span>
        <h2 className="flex-1 font-heading text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function HeadlineNumbers({ stats, streak, best }: { stats: MentorStats; streak: number; best: number }) {
  const { week, marks } = stats;
  const change = changeLabel(week.changeMinutes);
  const up = (week.changeMinutes ?? 0) >= 0;
  const tiles = [
    {
      label: 'Studied this week',
      value: hoursMinutes(week.doneMinutes),
      note: change ? (
        <span className={cn('inline-flex items-center gap-1', up ? 'text-success' : 'text-destructive')}>
          {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {change}
        </span>
      ) : (
        'nothing to compare yet'
      ),
    },
    {
      label: 'Blocks done this week',
      value: `${week.blocksDone} / ${week.blocksDue}`,
      note: week.completion === null ? 'nothing due yet' : `${week.completion}% of what was due`,
      bar: week.completion,
    },
    {
      label: 'Study streak',
      value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
      note: `best ${best}`,
      icon: streak > 0 ? <Flame className="size-4 text-orange-500" aria-hidden /> : null,
    },
    {
      label: 'Exam average',
      value: marks.average === null ? '—' : `${marks.average}%`,
      note: marks.count ? `${marks.count} marked ${marks.count === 1 ? 'exam' : 'exams'}` : 'no marks yet',
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
          <p className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-bold tabular-nums text-foreground">
            {t.icon}
            {t.value}
          </p>
          {'bar' in t && t.bar !== null && t.bar !== undefined && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${t.bar}%` }} />
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">{t.note}</p>
        </div>
      ))}
    </section>
  );
}

function StudyChart({ days, today }: { days: MentorDay[]; today: string }) {
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const studied = days.filter((d) => d.minutes > 0).length;
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{hoursMinutes(total)}</span> over {studied} of 14 days
      </p>
      <ol className="flex h-40 items-end gap-1.5 sm:gap-2" aria-label="Minutes studied each day">
        {days.map((d) => {
          const label = format(new Date(`${d.day}T12:00:00`), 'EEE d MMM');
          return (
            <li key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${label}: ${hoursMinutes(d.minutes)}`}>
              <div
                className={cn('w-full rounded-md', d.minutes ? (d.day === today ? 'bg-primary' : 'bg-primary/60') : 'bg-muted')}
                style={{ height: d.minutes ? `${Math.max(6, (d.minutes / max) * 100)}%` : '4px' }}
              />
              <span className={cn('text-[10px] tabular-nums', d.day === today ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {format(new Date(`${d.day}T12:00:00`), 'EEEEE')}
              </span>
              <span className="sr-only">{`${label}: ${hoursMinutes(d.minutes)}`}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SubjectsTable({ stats }: { stats: MentorStats }) {
  if (stats.subjects.length === 0) {
    return <p className="text-sm text-muted-foreground">No finished or missed blocks in the last 30 days.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Subject</th>
            <th className="pb-2 text-right font-medium">Done</th>
            <th className="pb-2 text-right font-medium">Missed</th>
            <th className="pb-2 text-right font-medium">Time</th>
            <th className="w-40 pb-2 pl-4 font-medium">Kept up</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {stats.subjects.map((s) => (
            <tr key={s.subject}>
              <td className="max-w-[16rem] truncate py-2.5 pr-3 font-medium text-foreground" title={s.subject}>{s.subject}</td>
              <td className="py-2.5 text-right tabular-nums text-foreground">{s.done}</td>
              <td className={cn('py-2.5 text-right tabular-nums', s.missed ? 'text-destructive' : 'text-muted-foreground')}>{s.missed}</td>
              <td className="py-2.5 text-right tabular-nums text-muted-foreground">{hoursMinutes(s.minutes)}</td>
              <td className="py-2.5 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn('h-full rounded-full', s.completion >= 80 ? 'bg-success' : s.completion >= 50 ? 'bg-primary' : 'bg-destructive')}
                      style={{ width: `${s.completion}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{s.completion}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarksList({ stats }: { stats: MentorStats }) {
  if (stats.marks.recent.length === 0) return <p className="text-sm text-muted-foreground">No exam results entered yet.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {stats.marks.recent.map((m, i) => (
        <li key={`${m.title}-${m.day}-${i}`} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{m.subject ?? m.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {m.subject ? `${m.title} · ` : ''}
              {format(new Date(`${m.day}T12:00:00`), 'd MMM')}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums',
              m.percent >= 70 ? 'bg-success/10 text-success' : m.percent >= 50 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
            )}
          >
            {m.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReportRow({ label, report, href }: { label: string; report: ReportData | null; href: string }) {
  if (!report) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> no report yet
      </div>
    );
  }
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold text-white"
        style={{ backgroundColor: report.color }}
      >
        {report.grade}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {label} · {report.shortTitle}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hoursMinutes(report.doneMinutes)} studied · {report.blocksDone}/{report.blocksTotal} blocks · {report.level}
        </p>
      </div>
    </Link>
  );
}
