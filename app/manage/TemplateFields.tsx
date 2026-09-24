'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DAY_NAMES } from '@/lib/school';

export type TemplateFormValues = {
  dayOfWeek: string;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

/** Monday first, as the schema's 0=Sunday dayOfWeek values. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/**
 * The fields of a study-routine block, shared by the add and edit dialogs so
 * the two cannot drift apart.
 */
export function TemplateFields({
  idPrefix,
  values,
  onChange,
  subjects,
}: {
  idPrefix: string;
  values: TemplateFormValues;
  onChange: (next: TemplateFormValues) => void;
  subjects: { id: string; name: string }[];
}) {
  const set = (patch: Partial<TemplateFormValues>) => onChange({ ...values, ...patch });
  // An edited block may name a subject that has since been renamed or removed;
  // keep it selectable so opening the dialog does not silently blank it.
  const subjectNames = subjects.map((s) => s.name);
  if (values.subject && !subjectNames.includes(values.subject)) subjectNames.unshift(values.subject);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-subject`}>Subject</Label>
        <Select value={values.subject} onValueChange={(v) => set({ subject: v })} required>
          <SelectTrigger id={`${idPrefix}-subject`} className="w-full">
            <SelectValue placeholder="Choose a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjectNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjectNames.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have no subjects yet.{' '}
            <Link href="/subjects" className="font-medium text-primary hover:underline">
              Add one on Subjects
            </Link>{' '}
            first.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-day`}>Day</Label>
          <Select value={values.dayOfWeek} onValueChange={(v) => set({ dayOfWeek: v })}>
            <SelectTrigger id={`${idPrefix}-day`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK.map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {DAY_NAMES[day]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-type`}>Type</Label>
          <Select value={values.type} onValueChange={(v) => set({ type: v })}>
            <SelectTrigger id={`${idPrefix}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOMEWORK">Homework</SelectItem>
              <SelectItem value="REVISION">Revision</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Starts</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            required
            value={values.startTime}
            onChange={(e) => set({ startTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end`}>Ends</Label>
          <Input
            id={`${idPrefix}-end`}
            type="time"
            required
            value={values.endTime}
            onChange={(e) => set({ endTime: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-deadline`}>Due day</Label>
        <Input
          id={`${idPrefix}-deadline`}
          required
          value={values.deadlineDay}
          onChange={(e) => set({ deadlineDay: e.target.value })}
          placeholder="e.g. Wednesday"
        />
        <p className="text-xs text-muted-foreground">The day this work has to be handed in.</p>
      </div>
    </div>
  );
}
