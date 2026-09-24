"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUSES, type GradeFormValues } from "./marks-model";

/**
 * The fields of one subject grade, shared by "Add subject" and "Edit". With
 * subjects on record the name is a picker; without, it is typed.
 */
export function GradeFields({
  idPrefix,
  values,
  onChange,
  subjects,
}: {
  idPrefix: string;
  values: GradeFormValues;
  onChange: (next: GradeFormValues) => void;
  subjects: { id: string; name: string }[];
}) {
  const set = (patch: Partial<GradeFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-subject`}>Subject</Label>
        {subjects.length > 0 ? (
          <Select value={values.subject} onValueChange={(val) => set({ subject: val })}>
            <SelectTrigger id={`${idPrefix}-subject`} className="h-10 w-full rounded-xl">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((sub) => (
                <SelectItem key={sub.id} value={sub.name}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={`${idPrefix}-subject`}
            required
            value={values.subject}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="e.g. Physics"
            className="h-10 rounded-xl"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-score`}>Mark (%)</Label>
          <Input
            id={`${idPrefix}-score`}
            required
            value={values.grade}
            onChange={(e) => set({ grade: e.target.value })}
            placeholder="e.g. 92"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Standing</Label>
          <Select value={values.status} onValueChange={(val) => set({ status: val })}>
            <SelectTrigger id={`${idPrefix}-status`} className="h-10 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-feedback`}>How to improve</Label>
        <Input
          id={`${idPrefix}-feedback`}
          value={values.aiFeedback}
          onChange={(e) => set({ aiFeedback: e.target.value })}
          placeholder="e.g. Practise problem solving daily."
          className="h-10 rounded-xl"
        />
      </div>
    </div>
  );
}
