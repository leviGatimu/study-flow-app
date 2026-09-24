"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { saveGoal } from "@/lib/goal-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GoalType, SubjectStanding } from "./goals-model";

export const GOAL_SUBJECT_FIELD_ID = "goal-subject";

/**
 * Add a target grade, or change one. The parent remounts this (by key) when
 * the goal being edited changes, so the initial state is always that goal's.
 */
export function GoalForm({
  standings,
  goals,
  editing,
  onFinished,
}: {
  standings: SubjectStanding[];
  goals: GoalType[];
  editing: GoalType | null;
  onFinished: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const editingKnown = editing ? standings.some((s) => s.subject === editing.subject) : false;
  const [selectedSubject, setSelectedSubject] = useState(
    editing ? (editingKnown ? editing.subject : "custom") : ""
  );
  const [customSubject, setCustomSubject] = useState(editing && !editingKnown ? editing.subject : "");
  const [targetGrade, setTargetGrade] = useState(editing ? String(editing.targetGrade) : "85");

  const activeSubject = selectedSubject === "custom" ? customSubject : selectedSubject;
  const standing = useMemo(
    () => (activeSubject ? standings.find((s) => s.subject.toLowerCase() === activeSubject.toLowerCase()) ?? null : null),
    [activeSubject, standings]
  );

  // Subjects that do not have a goal yet (the one being edited still counts as free).
  const available = useMemo(
    () => standings.filter((s) => !goals.some((g) => g.subject === s.subject && g.id !== editing?.id)),
    [standings, goals, editing]
  );

  const target = parseFloat(targetGrade);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subjectName = selectedSubject === "custom" ? customSubject.trim() : selectedSubject;
    if (!subjectName) {
      toast.error("Choose a subject, or type its name.");
      return;
    }
    if (Number.isNaN(target) || target < 0 || target > 100) {
      toast.error("The target must be a number from 0 to 100.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveGoal(subjectName, target);
        if (res.success) {
          toast.success(editing ? "Target updated." : `Target set for ${subjectName}.`);
          setSelectedSubject("");
          setCustomSubject("");
          setTargetGrade("85");
          onFinished();
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "The target could not be saved. Try again.");
      }
    });
  };

  return (
    <Panel>
      <PanelTitle icon={<Target />}>{editing ? `Change target for ${editing.subject}` : "Add a target"}</PanelTitle>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={GOAL_SUBJECT_FIELD_ID}>Subject</Label>
          {editing ? (
            <p id={GOAL_SUBJECT_FIELD_ID} className="flex h-10 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold text-foreground">
              {editing.subject}
            </p>
          ) : (
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger id={GOAL_SUBJECT_FIELD_ID} className="h-10 w-full rounded-xl">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s.subject} value={s.subject}>
                    {s.subject} {s.currentGrade !== undefined ? `(${s.currentGrade.toFixed(0)}% now)` : "(no mark yet)"}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Another subject…</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedSubject === "custom" && !editing && (
          <div className="space-y-2">
            <Label htmlFor="goal-custom-subject">Subject name</Label>
            <Input
              id="goal-custom-subject"
              required
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="e.g. Chemistry"
              className="h-10 rounded-xl"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="goal-target-grade">Target mark</Label>
            <span className="font-heading text-lg font-bold tabular-nums text-primary">{targetGrade}%</span>
          </div>
          <input
            id="goal-target-grade"
            type="range"
            min="50"
            max="100"
            step="1"
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            className="w-full cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Pass (50%)</span>
            <span>Distinction (90%)</span>
            <span>100%</span>
          </div>
        </div>

        {standing && (
          <p className="rounded-xl border border-border/40 bg-muted/40 p-3 text-sm text-muted-foreground">
            {standing.currentGrade === undefined ? (
              <>No mark for {standing.subject} yet. Add a report card in Marks to compare.</>
            ) : target > standing.currentGrade ? (
              <>
                Your latest mark is {standing.currentGrade.toFixed(1)}%, so this aims for{" "}
                <span className="font-semibold text-success">+{(target - standing.currentGrade).toFixed(1)}%</span>.
              </>
            ) : target < standing.currentGrade ? (
              <span className="text-orange-600 dark:text-orange-400">
                This is below your latest mark of {standing.currentGrade.toFixed(1)}%. You could aim higher.
              </span>
            ) : (
              <>This matches your latest mark of {standing.currentGrade.toFixed(1)}%.</>
            )}
          </p>
        )}

        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="outline" onClick={onFinished} className="flex-1">
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? "Saving…" : editing ? "Save target" : "Set target"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
