import { AlarmClock, CheckCircle2, ClipboardList, Clock, ListTodo } from 'lucide-react';

import { requireMentorStudent, loadMentorHomework } from '@/lib/mentor-data';
import { cleanSubject, dayLabel, homeworkBuckets, relativeDay, type MentorHomework } from '@/lib/mentor-model';
import { Card, CardHead, Empty, Kpi, MentorHero, MentorPage } from '@/components/mentor/ui';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Homework that is late, due soon, later, and finished lately. Answers are never shown. */
export default async function MentorHomework() {
  const student = await requireMentorStudent();
  const { today } = student;
  const b = homeworkBuckets(await loadMentorHomework(student), today);
  const open = b.late.length + b.soon.length + b.later.length;

  return (
    <MentorPage>
      <MentorHero
        eyebrow="Homework"
        title={open ? `${open} still to do` : 'All homework done'}
        description={b.late.length ? `${b.late.length} past the due date.` : 'Nothing is late.'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Late" value={b.late.length} icon={<AlarmClock />} tone={b.late.length ? 'missed' : 'accent'} sub="past the due date" />
        <Kpi label="Due soon" value={b.soon.length} icon={<Clock />} tone="warn" sub="today or in 3 days" />
        <Kpi label="Later" value={b.later.length} icon={<ListTodo />} tone="primary" sub="due after that" />
        <Kpi label="On time" value={b.onTime === null ? '–' : `${b.onTime}%`} icon={<CheckCircle2 />} sub={`of ${b.done.length} done in 30 days`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        <Column title="Late" hint="Past the due date" items={b.late} today={today} tone="missed" />
        <Column title="Due soon" hint="Today and the next 3 days" items={b.soon} today={today} tone="warn" />
        <Column title="Later" hint="Further ahead" items={b.later} today={today} tone="primary" />
        <Column title="Done lately" hint="Finished in the last 30 days" items={b.done} today={today} tone="accent" done />
      </div>
    </MentorPage>
  );
}

function Column({ title, hint, items, today, tone, done = false }: { title: string; hint: string; items: MentorHomework[]; today: string; tone: 'missed' | 'warn' | 'primary' | 'accent'; done?: boolean }) {
  const bar = { missed: 'border-l-[var(--m-missed)]', warn: 'border-l-[var(--m-warn)]', primary: 'border-l-primary', accent: 'border-l-[var(--m-accent)]' }[tone];
  return (
    <Card>
      <CardHead title={`${title} · ${items.length}`} hint={hint} icon={<ClipboardList />} />
      {items.length === 0 ? (
        <Empty title="None" />
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.id} className={cn('rounded-2xl border border-l-4 border-border/60 p-3', bar)}>
              <p className="truncate text-sm font-semibold">{h.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {cleanSubject(h.subject)} ·{' '}
                {done
                  ? `done ${h.completed ? dayLabel(h.completed) : ''}${h.completed && h.completed > h.due ? ' (late)' : ''}`
                  : `due ${dayLabel(h.due)} (${relativeDay(h.due, today).toLowerCase()})`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
