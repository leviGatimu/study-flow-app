"use client";

import Link from "next/link";
import { BrainCircuit, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import type { GoalType } from "./goals-model";

/**
 * One subject's target against its latest mark, with the next step: practise
 * when it is behind, add a mark when there is none yet.
 */
export function GoalCard({
  goal,
  current,
  readOnly,
  busy,
  onEdit,
  onDelete,
}: {
  goal: GoalType;
  current: number | undefined;
  readOnly: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isGraded = current !== undefined;
  const isMet = isGraded && current >= goal.targetGrade;
  const gap = isGraded ? current - goal.targetGrade : 0;

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-heading text-lg font-bold text-foreground">{goal.subject}</p>
          {isGraded ? (
            isMet ? (
              <Pill tone="success">Met, {gap >= 0 ? "+" : ""}{gap.toFixed(1)}%</Pill>
            ) : (
              <Pill tone="warning">{Math.abs(gap).toFixed(1)}% to go</Pill>
            )
          ) : (
            <Pill>No mark yet</Pill>
          )}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" aria-label={`Change target for ${goal.subject}`} onClick={onEdit}>
              <Edit2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete target for ${goal.subject}`}
              onClick={onDelete}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Latest mark</dt>
          <dd className="font-heading text-2xl font-black tabular-nums text-foreground">
            {isGraded ? `${current.toFixed(1)}%` : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Target</dt>
          <dd className="font-heading text-2xl font-black tabular-nums text-primary">{goal.targetGrade}%</dd>
        </div>
      </dl>

      {/* The bar is the mark; the tick is the target. */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {isGraded && (
          <div
            className={cn("h-full rounded-full", isMet ? "bg-success" : "bg-orange-500")}
            style={{ width: `${Math.min(current, 100)}%` }}
          />
        )}
        <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${goal.targetGrade}%` }} />
      </div>

      {!isMet && (
        <div className="mt-auto border-t border-border/40 pt-3">
          {isGraded ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/ai?subject=${encodeURIComponent(goal.subject)}`}>
                <BrainCircuit />
                Practice {goal.subject}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/marks">Add a mark</Link>
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
