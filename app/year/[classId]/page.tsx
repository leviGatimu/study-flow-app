import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock, FileText, Flame, FolderOpen,
  GraduationCap, History, ListChecks, Moon, Sun, Sunrise, Sunset, Target, TrendingUp,
} from "lucide-react";
import { getUserId } from "@/lib/auth";
import { loadYearHome } from "@/lib/year-recap-data";
import { hours, monthName, studyTimeLabel, WEEKDAYS, type YearRecap } from "@/lib/year-recap";
import { openArchivedYear } from "@/app/archive-actions";
import { cn } from "@/lib/utils";
import { Page, PageBody } from "@/components/ui/page";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { Stat } from "@/components/ui/stat";
import { PlayRecap } from "@/components/year/PlayRecap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A year's home: where opening a finished year lands. Its highlights, the
 * terms, what was studied most and when, the recap story, and a way into that
 * year's pages.
 */
export default async function YearHomePage({ params }: { params: Promise<{ classId: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/welcome");

  const { classId } = await params;
  const home = await loadYearHome(classId);
  if (!home) notFound();

  const r = home.recap;
  const finished = home.status !== "ACTIVE";

  return (
    <Page>
      <Hero recap={r} classId={home.classId} finished={finished} />

      <PageBody>
        {r.blocksDone === 0 && (
          <p className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Nothing was ticked off in {r.label}, so there is little to show yet. Finished blocks, exams and homework fill this page in.
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm lg:grid-cols-4">
          <Stat
            icon={<Clock />}
            tone="primary"
            label="Time studied"
            value={`${hours(r.minutes).toLocaleString("en-GB")}h`}
            hint={r.focusMinutes > 0 ? `${hours(r.focusMinutes)}h in focus sessions` : `${r.blocksDone} blocks done`}
          />
          <Stat
            icon={<Flame />}
            label="Days studied"
            value={r.activeDays}
            hint={r.longestRun > 0 ? `Longest run ${r.longestRun} ${r.longestRun === 1 ? "day" : "days"} in a row` : "No days yet"}
          />
          <Stat
            icon={<CheckCircle2 />}
            tone={r.completion >= 80 ? "success" : "default"}
            label="Blocks done"
            value={`${r.completion}%`}
            hint={`${r.blocksDone.toLocaleString("en-GB")} of ${r.blocksPlanned.toLocaleString("en-GB")} planned`}
          />
          <Stat
            icon={<GraduationCap />}
            label="Exam average"
            value={r.examAverage !== null ? `${Math.round(r.examAverage)}%` : "None"}
            hint={
              r.bestExam
                ? `Best: ${r.bestExam.subject ?? r.bestExam.title} ${Math.round(r.bestExam.percent)}%`
                : r.examsTaken > 0
                  ? `${r.examsTaken} exams, no marks entered`
                  : "No exams this year"
            }
          />
        </div>

        {r.terms.length > 0 && <Terms terms={r.terms} />}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Subjects recap={r} />
          <div className="space-y-6 lg:col-span-5">
            <Months recap={r} />
            <When recap={r} />
          </div>
        </div>

        <LookBack classId={home.classId} label={r.label} recap={r} />
      </PageBody>
    </Page>
  );
}

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m ? `${h}h ${m}m` : `${h}h`;
}

function range(r: YearRecap): string {
  const m = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${m(r.startedAt)} – ${r.completedAt ? m(r.completedAt) : "now"}`;
}

function Hero({ recap: r, classId, finished }: { recap: YearRecap; classId: string; finished: boolean }) {
  const max = Math.max(1, ...r.months.map((m) => m.minutes));
  return (
    <div className="px-4 pt-6 md:px-8">
      <Link href="/year" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> Year &amp; terms
      </Link>

      <section
        aria-labelledby={`year-${classId}`}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 p-6 text-white shadow-xl sm:p-10"
      >
        {/* The year's shape, month by month, as a faint backdrop. */}
        {r.months.length > 1 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-0 flex h-2/3 items-end gap-1.5 opacity-20 sm:inset-x-10">
            {r.months.map((m) => (
              <div key={m.key} className="flex-1 rounded-t-md bg-white" style={{ height: `${Math.max(3, (m.minutes / max) * 100)}%` }} />
            ))}
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
              {finished ? "Finished year" : "This year so far"} · {range(r)}
            </p>
            <h1 id={`year-${classId}`} className="break-words font-heading text-5xl font-black tracking-tight sm:text-7xl">
              {r.label}
            </h1>
            <div className="flex flex-wrap gap-2 pt-1 text-sm font-semibold">
              {r.grade && <span className="rounded-full bg-white px-3 py-1 text-slate-950">Grade {r.grade}</span>}
              <span className="rounded-full bg-white/15 px-3 py-1">{hours(r.minutes).toLocaleString("en-GB")} hours</span>
              <span className="rounded-full bg-white/15 px-3 py-1">{r.activeDays} days studied</span>
              {r.subjects[0] && <span className="rounded-full bg-white/15 px-3 py-1">Most studied: {r.subjects[0].subject}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <PlayRecap recap={r} />
            <p className="text-sm text-white/70">Your year as a story, about a minute long.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Terms({ terms }: { terms: YearRecap["terms"] }) {
  const most = Math.max(1, ...terms.map((t) => t.minutes));
  return (
    <Panel>
      <PanelTitle icon={<CalendarDays />}>Terms</PanelTitle>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {terms.map((t, i) => (
          <li key={`${t.name}-${i}`} className="relative rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Term {i + 1}</p>
                <p className="truncate font-heading text-lg font-bold text-foreground">{t.name}</p>
              </div>
              {t.grade && <Pill tone="primary">{t.grade}</Pill>}
            </div>
            <p className="mt-3 text-sm tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{hours(t.minutes)}h</span> studied
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(t.minutes / most) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Subjects({ recap: r }: { recap: YearRecap }) {
  const shown = r.subjects.slice(0, 8);
  const max = Math.max(1, shown[0]?.minutes ?? 1);
  return (
    <Panel className="lg:col-span-7">
      <PanelTitle icon={<TrendingUp />} action={r.subjects.length > 0 && <Pill>{r.subjects.length} subjects</Pill>}>
        Most studied
      </PanelTitle>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Subjects show here once blocks are ticked off.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((s, i) => (
            <li key={s.subject} className="space-y-1.5">
              <div className="flex items-baseline gap-3 text-sm">
                <span className={cn("w-5 font-heading font-black tabular-nums", i === 0 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.subject}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{hours(s.minutes)}h</span> · {s.share}%
                </span>
              </div>
              <div className="ml-8 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/50")} style={{ width: `${(s.minutes / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Months({ recap: r }: { recap: YearRecap }) {
  if (r.months.length === 0) return null;
  const max = Math.max(1, ...r.months.map((m) => m.minutes));
  const peak = r.busiestMonth?.key;
  return (
    <Panel>
      <PanelTitle icon={<CalendarDays />} action={peak && <Pill tone="primary">Best: {monthName(peak, false)}</Pill>}>
        Each month
      </PanelTitle>
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Hours studied each month. The most was ${peak ? monthName(peak) : "none"}.`}>
        {r.months.map((m) => (
          <div key={m.key} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-md transition-colors", m.key === peak ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/60")}
              style={{ height: `${Math.max(3, (m.minutes / max) * 100)}%` }}
              title={`${monthName(m.key)}: ${hours(m.minutes)}h`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] font-medium uppercase text-muted-foreground" aria-hidden="true">
        {r.months.map((m) => (
          <span key={m.key} className="flex-1 text-center">{monthName(m.key, false).slice(0, 3)}</span>
        ))}
      </div>
    </Panel>
  );
}

function HourIcon({ hour }: { hour: number }) {
  if (hour < 9 && hour >= 5) return <Sunrise />;
  if (hour < 17 && hour >= 9) return <Sun />;
  if (hour < 21 && hour >= 17) return <Sunset />;
  return <Moon />;
}

function When({ recap: r }: { recap: YearRecap }) {
  if (r.favouriteHour === null) return null;
  const rows: [string, string][] = [
    ["Favourite time", `${String(r.favouriteHour).padStart(2, "0")}:00`],
    ...(r.busiestWeekday ? [["Busiest day", `${WEEKDAYS[r.busiestWeekday.weekday]}s`] as [string, string]] : []),
    ...(r.bestDay
      ? [[
          "Best single day",
          `${new Date(`${r.bestDay.day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} · ${hm(r.bestDay.minutes)}`,
        ] as [string, string]]
      : []),
    ...(r.longestSessionMinutes > 0 ? [["Longest focus session", `${r.longestSessionMinutes} min`] as [string, string]] : []),
    ...(r.homeworkDone > 0 ? [["Homework finished", `${r.homeworkDone} (${r.homeworkOnTime} on time)`] as [string, string]] : []),
    ...(r.practiceAttempts > 0 ? [["Practice tries", `${r.practiceAttempts}${r.practiceBest !== null ? `, best ${r.practiceBest}%` : ""}`] as [string, string]] : []),
    ...(r.xp > 0 ? [["XP earned", r.xp.toLocaleString("en-GB")] as [string, string]] : []),
  ];
  return (
    <Panel>
      <PanelTitle icon={<HourIcon hour={r.favouriteHour} />}>How you studied</PanelTitle>
      <p className="mb-3 text-sm text-muted-foreground">{studyTimeLabel(r.favouriteHour)}</p>
      <dl className="divide-y divide-border/60 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

const LOOK_BACK = [
  { to: "/calendar", label: "Calendar", hint: "Every block, day by day", icon: CalendarDays },
  { to: "/history", label: "Completed work", hint: "What you finished", icon: History },
  { to: "/marks", label: "Marks", hint: "Report cards and targets", icon: Target },
  { to: "/exams", label: "Exams", hint: "Dates and results", icon: GraduationCap },
  { to: "/homeworks", label: "Homework", hint: "Everything set and done", icon: ListChecks },
  { to: "/summaries", label: "Reports", hint: "Daily and weekly reports", icon: FileText },
  { to: "/resources", label: "Resources", hint: "Your files from the year", icon: FolderOpen },
] as const;

/** Each link opens this year onto that page (a form, because opening sets which year the app reads). */
function LookBack({ classId, label, recap: r }: { classId: string; label: string; recap: YearRecap }) {
  return (
    <section aria-labelledby="look-back" className="space-y-4">
      <div>
        <h2 id="look-back" className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
          <BookOpen className="size-5 text-primary" /> Look back at {label}
        </h2>
        <p className="text-sm text-muted-foreground">
          Opens the page as it was in {label}. Everything is read-only; the bar at the top takes you back to {r.completedAt ? "your current year" : "today"}.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LOOK_BACK.map(({ to, label: name, hint, icon: Icon }) => (
          <form key={to} action={openArchivedYear}>
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="to" value={to} />
            <button
              type="submit"
              className="group flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
