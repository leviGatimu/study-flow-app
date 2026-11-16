import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, CalendarClock, CheckCircle2, Crosshair, Timer } from "lucide-react";
import { getUserId } from "@/lib/auth";
import { loadSubjectProgress } from "@/lib/subject-progress-data";
import { rankFocus, type FocusItem, type SubjectProgress } from "@/lib/subject-progress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { GoalBar, neededText, ResultChips, sourceText } from "@/components/marks/GoalProgress";

const DESCRIPTION = "The subjects that need you most right now, worked out from your exam results, targets and coming exams.";

const LEVEL = {
  high: { label: "Most urgent", tone: "danger" },
  medium: { label: "Needs work", tone: "warning" },
  low: { label: "Keep an eye on it", tone: "default" },
} as const;

const REASON_DOT = {
  danger: "bg-destructive",
  warning: "bg-orange-500",
  default: "bg-muted-foreground/50",
} as const;

/** The Focus tab of Marks: subjects ranked by how much attention they need. */
export async function FocusView({ tabs }: { tabs: React.ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect("/welcome");

  let progress: SubjectProgress[];
  try {
    progress = await loadSubjectProgress();
  } catch (error) {
    console.error("Focus failed to load", error);
    return (
      <Page>
        <PageHeader title="Marks" description={DESCRIPTION} />
        {tabs}
        <PageBody>
          <ErrorState
            title="Your subjects could not be ranked"
            description="Something went wrong while reading your exams and marks. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }

  const focus = rankFocus(progress);
  const inFocus = new Set(focus.map((f) => f.progress.subject));
  const onTrack = progress.filter((p) => !inFocus.has(p.subject) && p.current !== null);
  const unmarked = progress.filter((p) => !inFocus.has(p.subject) && p.current === null);
  const hasTargets = progress.some((p) => p.target !== null);
  const nothingToJudge = focus.length === 0 && onTrack.length === 0;

  return (
    <Page>
      <PageHeader title="Marks" description={DESCRIPTION} />
      {tabs}

      <PageBody>
        {nothingToJudge ? (
          <EmptyState
            icon={<Crosshair />}
            title="Nothing to rank yet"
            description="Add your exam results (a midterm, a quiz) or a report card, and set a target for each subject. The subjects that need you most then show here."
            action={
              <>
                <Button asChild>
                  <Link href="/exams">Add an exam result</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/marks?view=goals">Set targets</Link>
                </Button>
              </>
            }
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <Section
              title="Focus on these first"
              description="Ranked by how far each subject is below its target, how close its next exam is, and whether its marks are falling."
              className="lg:col-span-8"
            >
              {focus.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="Every subject is on track"
                  description="Nothing is below its target or falling, and no exam is close for a subject without a mark. Keep it up."
                />
              ) : (
                <ol className="space-y-4">
                  {focus.map((item, i) => (
                    <FocusRow key={item.progress.subject} item={item} rank={i + 1} />
                  ))}
                </ol>
              )}
              {!hasTargets && (
                <p className="pt-4 text-sm text-muted-foreground">
                  Without targets, subjects are compared with your own average.{" "}
                  <Link href="/marks?view=goals" className="font-medium text-primary hover:underline">
                    Set a target for each subject
                  </Link>{" "}
                  to rank them by how far each is from where you want it.
                </p>
              )}
            </Section>

            <div className="space-y-6 lg:col-span-4">
              <Panel>
                <PanelTitle icon={<CheckCircle2 />} action={<Pill tone="success">{onTrack.length}</Pill>}>
                  On track
                </PanelTitle>
                {onTrack.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Subjects at or above their target show here.</p>
                ) : (
                  <ul className="space-y-4">
                    {onTrack.map((p) => (
                      <li key={p.subject} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <Link
                            href={`/subjects?subject=${encodeURIComponent(p.subject)}`}
                            className="min-w-0 truncate font-medium text-foreground hover:underline"
                          >
                            {p.subject}
                          </Link>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            <span className="font-semibold text-foreground">{p.current}%</span>
                            {p.target !== null && <> / {p.target}%</>}
                          </span>
                        </div>
                        <GoalBar current={p.current} target={p.target} className="h-1.5" />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {unmarked.length > 0 && (
                <Panel>
                  <PanelTitle icon={<CalendarClock />} action={<Pill>{unmarked.length}</Pill>}>
                    No marks yet
                  </PanelTitle>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Record a result on the exam page and these subjects are ranked too.
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {unmarked.map((p) => (
                      <li key={p.subject} className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        {p.subject}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  );
}

function FocusRow({ item, rank }: { item: FocusItem; rank: number }) {
  const p = item.progress;
  const level = LEVEL[item.level];
  const needed = neededText(p);
  const next = p.coming[0];
  const encoded = encodeURIComponent(p.subject);

  return (
    <li>
      <Panel className={cn("flex gap-4", item.level === "high" && "border-destructive/30")}>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold tabular-nums",
            item.level === "high" ? "bg-destructive/10 text-destructive" : item.level === "medium" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "bg-muted text-muted-foreground"
          )}
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-words font-heading text-lg font-bold text-foreground">
              <span className="sr-only">{rank}. </span>
              {p.subject}
            </h3>
            <Pill tone={level.tone}>{level.label}</Pill>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {p.current === null ? "No mark yet" : <>Now <span className="font-heading text-base font-bold tabular-nums text-foreground">{p.current}%</span></>}
              </span>
              {p.target !== null && (
                <span className="tabular-nums text-muted-foreground">
                  Target <span className="font-semibold text-primary">{p.target}%</span>
                </span>
              )}
            </div>
            <GoalBar current={p.current} target={p.target} />
            {p.current !== null && <p className="text-xs text-muted-foreground">{sourceText(p)}</p>}
          </div>

          <ul className="space-y-1 text-sm">
            {item.reasons.map((r) => (
              <li key={r.text} className="flex items-start gap-2">
                <span aria-hidden="true" className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", REASON_DOT[r.tone])} />
                <span className="text-foreground/90">{r.text}</span>
              </li>
            ))}
          </ul>

          <ResultChips progress={p} />
          {/* Over 90% is already one of the reasons above. */}
          {needed && needed.tone !== "success" && p.needed !== null && p.needed <= 90 && (
            <p className="text-sm text-muted-foreground">{needed.text}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
            <Button asChild size="sm">
              <Link href={`/ai/practices?subject=${encoded}`}>
                <Brain /> Practice
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/focus?subject=${encoded}`}>
                <Timer /> Focus session
              </Link>
            </Button>
            {next && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/exams/${next.id}`}>
                  <CalendarClock /> {next.title}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </li>
  );
}
