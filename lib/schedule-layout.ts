/** Shared time geometry for the three schedule canvases. No browser or database dependencies. */
export type ScheduleEntry = {
  id: string;
  day: string;
  title: string;
  startTime: string;
  endTime: string;
  kind: 'school' | 'homework' | 'revision' | 'break';
  state?: 'done' | 'missed' | 'active';
  detail?: string;
};

export const scheduleMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function entryRange(entry: Pick<ScheduleEntry, 'startTime' | 'endTime'>) {
  const start = scheduleMinutes(entry.startTime);
  let end = scheduleMinutes(entry.endTime);
  if (end < start) end += 1440;
  return { start, end };
}

export function scheduleDuration(entry: Pick<ScheduleEntry, 'startTime' | 'endTime'>) {
  const { start, end } = entryRange(entry);
  return formatMinutes(end - start);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
}

export function blockMinutes(start: string, end: string): number {
  const range = entryRange({ startTime: start, endTime: end });
  const duration = range.end - range.start;
  return Number.isFinite(duration) ? duration : 0;
}

export type ScheduleGroup = { day: string; start: number; end: number; entries: ScheduleEntry[] };

/** Keep clashing blocks visible at full width instead of hiding one underneath another. */
export function scheduleGroups(entries: ScheduleEntry[]): ScheduleGroup[] {
  const days = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const items = days.get(entry.day) ?? [];
    items.push(entry);
    days.set(entry.day, items);
  }
  const groups: ScheduleGroup[] = [];
  for (const [day, items] of days) {
    const sorted = [...items].sort((a, b) => scheduleMinutes(a.startTime) - scheduleMinutes(b.startTime) || a.id.localeCompare(b.id));
    let group: ScheduleGroup | undefined;
    for (const entry of sorted) {
      const { start, end } = entryRange(entry);
      if (group && start < group.end) {
        group.entries.push(entry);
        group.end = Math.max(group.end, end);
      } else {
        group = { day, start, end: Math.max(start + 1, end), entries: [entry] };
        groups.push(group);
      }
    }
  }
  return groups;
}

/**
 * All days share the same time boundaries. Expand short intervals enough to
 * read their titles; long gaps stay quiet. This also handles overnight study.
 */
export function scheduleLayout(entries: ScheduleEntry[]) {
  const groups = scheduleGroups(entries);
  const start = groups.length ? Math.floor(Math.min(...groups.map((group) => group.start)) / 60) * 60 : 8 * 60;
  const end = groups.length ? Math.ceil(Math.max(...groups.map((group) => group.end)) / 60) * 60 : 18 * 60;
  const boundaries = new Set([start, end]);
  for (let hour = start; hour <= end; hour += 60) boundaries.add(hour);
  for (const group of groups) { boundaries.add(group.start); boundaries.add(group.end); }
  const points = [...boundaries].sort((a, b) => a - b);
  const heights = points.slice(1).map((point, i) => (point - points[i]) * 1.1);
  for (const group of groups) {
    const first = points.indexOf(group.start);
    const last = points.indexOf(group.end);
    const actual = heights.slice(first, last).reduce((sum, height) => sum + height, 0);
    const minimum = group.entries.reduce((sum, entry) => sum + (entry.kind === 'break'
      ? 44 + Math.max(0, Math.ceil(entry.title.length / 18) - 1) * 16
      : Math.max(88, Math.ceil(entry.title.length / 14) * 20 + 60)), 0)
      + (group.entries.length > 1 ? 24 + (group.entries.length - 1) * 4 : 0);
    if (actual < minimum) {
      for (let i = first; i < last; i++) heights[i] += (minimum - actual) * (points[i + 1] - points[i]) / (group.end - group.start);
    }
  }
  return { groups, points, heights, start, end };
}

export function scheduleOffset(minute: number, points: number[], heights: number[]) {
  let offset = 0;
  for (let i = 0; i < heights.length; i++) {
    if (minute <= points[i + 1]) return offset + Math.max(0, minute - points[i]) / (points[i + 1] - points[i]) * heights[i];
    offset += heights[i];
  }
  return offset;
}

export function scheduleHour(minute: number) {
  const hours = Math.floor(minute / 60);
  return `${String(hours % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}${hours >= 24 ? ' +1' : ''}`;
}
