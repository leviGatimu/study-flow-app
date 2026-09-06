'use client';

import { cn } from '@/lib/utils';
import type { PeriodSummary } from '@/lib/summary';

const hours = (mins: number) => Math.round((mins / 60) * 10) / 10;

/**
 * End-of-term / end-of-year report.
 *
 * The grade, headline and per-subject split all come from the same grading
 * engine that scores a week, so a term reads in the language the rest of the
 * app already uses rather than inventing a second vocabulary.
 */
export function PeriodSummaryView({
  summary,
  title,
}: {
  summary: PeriodSummary;
  title?: string;
}) {
  const theme = summary.performance.theme;
  const maxSubjectMinutes = summary.topSubjects[0]?.minutes || 1;
  const completionPct =
    summary.totalSessions === 0
      ? 0
      : Math.round((summary.completedSessions / summary.totalSessions) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-2xl border font-heading text-2xl font-black',
            theme.bg,
            theme.border,
            theme.text
          )}
        >
          {summary.grade}
        </div>
        <div className="min-w-0 space-y-0.5">
          {title && (
            <p className="text-xs font-bold text-muted-foreground">{title}</p>
          )}
          <p className="font-heading text-lg font-bold text-foreground">
            {summary.performance.feedback}
          </p>
          <p className="text-sm text-muted-foreground">
            {summary.performance.detail}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="Blocks done" value={`${summary.completedSessions}/${summary.totalSessions}`} hint={`${completionPct}%`} />
        <Fact label="Time studied" value={`${hours(summary.completedMinutes)}h`} hint={`of ${hours(summary.scheduledMinutes)}h planned`} />
        <Fact label="Active days" value={summary.activeDays} hint={`over ${summary.daysSpanned} days`} />
        <Fact label="Best streak" value={`${summary.longestStreak}d`} hint={summary.examCount ? `${summary.examCount} exams` : undefined} />
      </div>

      {summary.topSubjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">Most studied</p>
          {summary.topSubjects.map((s) => (
            <div key={s.subject} className="space-y-1">
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{s.subject}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {hours(s.minutes)}h
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(4, (s.minutes / maxSubjectMinutes) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.performance.improvements.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground">What to change</p>
          {summary.performance.improvements.slice(0, 3).map((tip, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
