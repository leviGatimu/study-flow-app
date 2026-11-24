import Link from "next/link";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import type { SubjectProgress } from "@/lib/subject-progress";
import { GoalBar, neededText, ResultChips, sourceText } from "./GoalProgress";

const NEEDED_TONE = {
  success: "text-success",
  warning: "text-orange-600 dark:text-orange-400",
  danger: "text-destructive",
  default: "text-muted-foreground",
} as const;

/**
 * On an exam's page: where this subject stands against its target now that
 * the result is in, counting every exam marked this term.
 */
export function ExamGoalPanel({ progress }: { progress: SubjectProgress }) {
  const { subject, current, target, gap } = progress;
  const needed = neededText(progress);

  return (
    <Panel className="rounded-3xl">
      <PanelTitle
        tone="emerald"
        icon={<Flag />}
        action={
          gap !== null &&
          (gap >= 0 ? <Pill tone="success">On target</Pill> : <Pill tone="warning">{Math.abs(gap)} points to go</Pill>)
        }
      >
        Your goal
      </PanelTitle>

      {target === null ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {current === null
              ? `No target set for ${subject} yet.`
              : `You are at ${current}% in ${subject}. Set a target to see how far you are from it.`}
          </p>
          <Link href="/marks?view=goals" className="inline-block font-medium text-primary hover:underline">
            Set a target for {subject}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Where you are</dt>
              <dd className="font-heading text-2xl font-black tabular-nums text-foreground">
                {current === null ? "None" : `${current}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Target</dt>
              <dd className="font-heading text-2xl font-black tabular-nums text-primary">{target}%</dd>
            </div>
          </dl>
          <GoalBar current={current} target={target} />
          <p className="text-xs text-muted-foreground">{sourceText(progress)}</p>
          <ResultChips progress={progress} />
          {needed && <p className={cn("text-sm", NEEDED_TONE[needed.tone])}>{needed.text}</p>}
        </div>
      )}

      <Link
        href="/marks?view=focus"
        className="mt-4 block border-t border-border/40 pt-3 text-sm font-medium text-primary hover:underline"
      >
        See which subjects need you most
      </Link>
    </Panel>
  );
}
