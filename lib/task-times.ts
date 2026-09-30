/**
 * When a scheduled block actually ends.
 *
 * A block's times are stored as "HH:MM" on the date it starts, so a revision
 * from 22:00 to 01:00 has an end time EARLIER than its start. Pinning "01:00"
 * to the start date puts the end 21 hours before the block even begins - the
 * missed-task sweep then marked such blocks missed the moment they were made.
 * An end at or before the start means the next morning.
 */
export function taskEndsAt(date: Date, startTime: string, endTime: string): Date {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);
  if (endH * 60 + endM <= startH * 60 + startM) end.setDate(end.getDate() + 1);
  return end;
}
