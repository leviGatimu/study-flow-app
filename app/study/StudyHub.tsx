import Link from 'next/link';
import {
  Book,
  BrainCircuit,
  Calculator,
  FolderOpen,
  NotebookPen,
  Play,
  StickyNote,
  Timer,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HubTile } from '@/components/ui/hub-tile';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';

/**
 * Everything the Study hub shows, as plain serializable data.
 *
 * The page fetches, this renders - so the hub can be drawn with fake data
 * outside a signed-in session, and so nothing here can query the wrong year.
 */
export type StudyHubData = {
  /** When the data was read, ISO. Relative times are measured from it. */
  now: string;
  notes: { total: number; open: number };
  projects: { active: number; total: number; latestTitle: string | null };
  studySets: { total: number; latestTitle: string | null };
  /** Account-wide: the focus counters are not kept per academic year. */
  focus: { sessions: number; minutes: number };
  subjects: {
    name: string;
    /** When the subject's studio notes were last edited, ISO; null when it has none. */
    notesUpdatedAt: string | null;
    studySets: number;
  }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function editedAgo(iso: string, now: string): string {
  const days = Math.floor((Date.parse(now) - Date.parse(iso)) / DAY_MS);
  if (days <= 0) return 'Edited today';
  if (days === 1) return 'Edited yesterday';
  if (days < 7) return `Edited ${days} days ago`;
  if (days < 60) return `Edited ${Math.floor(days / 7)} wk ago`;
  return `Edited ${Math.floor(days / 30)} mo ago`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function StudyHub({ data }: { data: StudyHubData }) {
  const { notes, projects, studySets, focus, subjects, now } = data;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 animate-in fade-in duration-300">
      <PageHeader
        title="Study"
        description="Your tools for actually doing the work: the AI, your notes and projects, a quiet room per subject, and a timer to keep you in it."
        actions={
          <Button asChild>
            <Link href="/focus">
              <Play className="fill-current" />
              Start focus session
            </Link>
          </Button>
        }
      />

      <div className="space-y-8">
        <Section title="Tools">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <HubTile
              href="/ai"
              icon={<BrainCircuit />}
              label="AI Study"
              tone="purple"
              value={studySets.total ? plural(studySets.total, 'study set') : 'Ask anything'}
              detail={
                studySets.latestTitle
                  ? `Latest: ${studySets.latestTitle}`
                  : 'Quizzes, flashcards and mock exams from your notes'
              }
            />
            <HubTile
              href="/notes"
              icon={<StickyNote />}
              label="Sticky Notes"
              tone="amber"
              value={notes.total ? plural(notes.total, 'note') : 'No notes yet'}
              detail={
                notes.total
                  ? notes.open
                    ? `${notes.open} still open`
                    : 'All ticked off'
                  : 'Quick reminders and scratch thoughts'
              }
            />
            <HubTile
              href="/projects"
              icon={<FolderOpen />}
              label="Projects"
              tone="blue"
              value={
                projects.total
                  ? `${projects.active} active`
                  : 'No projects yet'
              }
              detail={
                projects.latestTitle
                  ? `Latest: ${projects.latestTitle}`
                  : 'Coursework with its own docs'
              }
            />
            <HubTile
              href="/focus"
              icon={<Timer />}
              label="Focus"
              tone="rose"
              value={focus.minutes ? `${formatMinutes(focus.minutes)} focused` : 'Not started'}
              detail={
                focus.sessions
                  ? `${plural(focus.sessions, 'session')}, all time`
                  : 'A timer and music for one task at a time'
              }
            />
            <HubTile
              href="/calculator"
              icon={<Calculator />}
              label="Calculator"
              tone="teal"
              value="Quick maths"
              detail="Scientific mode, history and memory"
            />
            <HubTile
              href="/bible"
              icon={<Book />}
              label="Bible"
              tone="emerald"
              value="Read"
              detail="Scripture, for a pause between sessions"
            />
          </div>
        </Section>

        <Section
          title="Deep work by subject"
          description="Each subject has a studio: its notes and resources side by side, nothing else on screen."
        >
          {subjects.length === 0 ? (
            <EmptyState
              icon={<NotebookPen />}
              title="No subjects yet"
              description="Add your subjects and each one gets its own studio."
              action={
                <Button asChild variant="outline">
                  <Link href="/subjects">Go to Subjects</Link>
                </Button>
              }
            />
          ) : (
            <Panel padded={false} className="p-2">
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {subjects.map((s) => {
                  const facts = [
                    s.notesUpdatedAt ? editedAgo(s.notesUpdatedAt, now) : 'No notes yet',
                    s.studySets ? plural(s.studySets, 'study set') : null,
                  ].filter(Boolean);
                  return (
                    <li key={s.name}>
                      <Link
                        href={`/studio/${encodeURIComponent(s.name)}`}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-sm font-semibold text-primary"
                        >
                          {s.name.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{facts.join(' · ')}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          Open
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </Section>
      </div>
    </div>
  );
}
