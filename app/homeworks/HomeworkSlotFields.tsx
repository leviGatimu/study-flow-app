'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { blockMinutes } from '@/lib/schedule-layout';
import { suggestHomeworkSlot } from '@/lib/homework-actions';

const DEFAULT_MINUTES = 60;

/**
 * The day and time homework will be done. Picking a day fills in that day's
 * next free time, which can then be changed. Submits as doDay, startTime and
 * endTime in the surrounding form.
 */
export function HomeworkSlotFields({
  idPrefix,
  defaultDay,
  defaultStart,
  defaultEnd,
}: {
  idPrefix: string;
  defaultDay?: string | null;
  /** The block's current time, when it already has one. */
  defaultStart?: string | null;
  defaultEnd?: string | null;
}) {
  const [day, setDay] = useState(defaultDay || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(defaultStart ?? '');
  const [endTime, setEndTime] = useState(defaultEnd ?? '');
  const [full, setFull] = useState(false);
  const latest = useRef(0);

  const suggest = async (nextDay: string, minutes: number) => {
    const request = ++latest.current;
    const slot = await suggestHomeworkSlot(nextDay, minutes).catch(() => null);
    // A slower answer for a day no longer picked must not overwrite a newer one.
    if (request !== latest.current) return;
    setFull(!slot);
    if (slot) {
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
    }
  };

  const hasDefault = Boolean(defaultStart && defaultEnd);
  const initialDay = useRef(day);
  useEffect(() => {
    if (!hasDefault) void suggest(initialDay.current, DEFAULT_MINUTES);
  }, [hasDefault]);

  const pickDay = (next: string) => {
    setDay(next);
    if (!next) return;
    const minutes = startTime && endTime && startTime !== endTime ? blockMinutes(startTime, endTime) : DEFAULT_MINUTES;
    void suggest(next, minutes);
  };

  return (
    <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
      <legend className="px-1 text-sm font-medium">When will you do it?</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-day`}>Day</Label>
          <Input id={`${idPrefix}-day`} name="doDay" type="date" required value={day} onChange={(e) => pickDay(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-start`}>Start</Label>
          <Input id={`${idPrefix}-start`} name="startTime" type="time" required value={startTime} onChange={(e) => { latest.current++; setStartTime(e.target.value); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-end`}>End</Label>
          <Input id={`${idPrefix}-end`} name="endTime" type="time" required value={endTime} onChange={(e) => { latest.current++; setEndTime(e.target.value); }} className="h-10" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {full ? 'That day has no free evening time left. Pick another day or set a time yourself.' : 'This goes on your schedule. The time shown is the next free one that day.'}
      </p>
    </fieldset>
  );
}
