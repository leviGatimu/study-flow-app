import {
  Activity,
  CalendarClock,
  CheckCircle,
  FileText,
  Flame,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { Stat } from '@/components/ui/stat';
import { HubTile } from '@/components/ui/hub-tile';

/**
 * Everything the Progress hub shows, already computed and formatted on the
 * server. Plain strings and numbers only, so the page can hand it straight to
 * this component and a harness can render it with made-up values.
 */
export type ProgressHubData = {
  streak: { current: number; best: number; paused: boolean };
  rank: { name: string; level: number; xp: number; xpToNext: number };
  week: { done: number; scheduled: number; minutesDone: number };
  today: { done: number; scheduled: number; summaryGrade: string | null; summaryTime: string };
  marks: { average: number | null; term: string | null };
  goals: { total: number; onTarget: number };
  latestSummary: { label: string; grade: string } | null;
};

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The Progress section's front door: four headline numbers, then one tile per
 * page in the section, each carrying the single fact that page is about. The
 * tiles are the connection - every Progress page is one click from here, and
 * the section tabs lead back.
 */
export function ProgressHub({ data }: { data: ProgressHubData }) {
  const { streak, rank, week, today, marks, goals, latestSummary } = data;

  const averageText = marks.average === null ? 'No marks yet' : `${marks.average.toFixed(1)}%`;

  const todayValue = today.summaryGrade
    ? `Grade ${today.summaryGrade}`
    : today.scheduled === 0
      ? 'Nothing scheduled'
      : `${today.done} of ${today.scheduled} done`;
  const todayDetail = today.summaryGrade
    ? "Today's report is ready"
    : `Report generates at ${today.summaryTime}`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 animate-in fade-in duration-300">
      <PageHeader
        title="Progress"
        description="How your year is going: consistency, marks, goals and the reports that track them."
      />

      <div className="space-y-8">
        <Panel className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
          <Stat
            icon={<Flame className="size-4" />}
            tone="warning"
            label="Current streak"
            value={plural(streak.current, 'day')}
            hint={streak.paused ? 'Paused' : `Best ${plural(streak.best, 'day')}`}
          />
          <Stat
            icon={<Zap className="size-4" />}
            tone="primary"
            label="Level"
            value={`Level ${rank.level}`}
            hint={rank.name}
          />
          <Stat
            icon={<CheckCircle className="size-4" />}
            tone="success"
            label="Done this week"
            value={plural(week.done, 'task')}
            hint={week.scheduled > 0 ? `of ${week.scheduled} scheduled` : 'Nothing scheduled'}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Latest average"
            value={averageText}
            hint={marks.term ?? 'Add a report card in Marks'}
          />
        </Panel>

        <Section title="Pages in Progress" description="Open any of them for the full picture.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HubTile
              href="/insights"
              icon={<Activity />}
              tone="blue"
              label="Insights"
              value={`${formatMinutes(week.minutesDone)} studied`}
              detail="Completed blocks this week"
            />
            <HubTile
              href="/history"
              icon={<CheckCircle />}
              tone="emerald"
              label="History"
              value={`${week.done} completed`}
              detail="Tasks finished this week"
            />
            <HubTile
              href="/marks"
              icon={<TrendingUp />}
              tone="purple"
              label="Marks"
              value={averageText}
              detail={marks.term ? `Latest report: ${marks.term}` : 'Report cards and subject grades'}
            />
            <HubTile
              href="/goals"
              icon={<Target />}
              tone="rose"
              label="Goals"
              value={goals.total === 0 ? 'No targets set' : `${goals.onTarget} of ${goals.total} on target`}
              detail={goals.total === 0 ? 'Set a target grade per subject' : 'At or above target grade'}
            />
            <HubTile
              href="/summaries"
              icon={<FileText />}
              tone="teal"
              label="Weekly summaries"
              value={latestSummary ? latestSummary.label : 'None yet'}
              detail={
                latestSummary
                  ? `Latest week · grade ${latestSummary.grade}`
                  : 'One is generated after each full week'
              }
            />
            <HubTile
              href="/daily-summary"
              icon={<CalendarClock />}
              tone="amber"
              label="Daily summary"
              value={todayValue}
              detail={todayDetail}
            />
            <HubTile
              href="/streak"
              icon={<Flame />}
              tone="orange"
              label="Streak"
              value={plural(streak.current, 'day')}
              detail={streak.paused ? `Paused · best ${plural(streak.best, 'day')}` : `All-time best ${plural(streak.best, 'day')}`}
            />
            <HubTile
              href="/ranks"
              icon={<Trophy />}
              tone="primary"
              label="Ranks"
              value={`${rank.name} · Lv ${rank.level}`}
              detail={`${rank.xpToNext.toLocaleString()} XP to level ${rank.level + 1}`}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
