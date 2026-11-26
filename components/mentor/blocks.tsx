import { cn } from "@/lib/utils";
import { dayLabel, hoursMinutes, type HeatCell } from "@/lib/mentor-model";

const WEEKDAY_LETTERS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Study time per day as a calendar of squares, one column per week. */
export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 gap-[3px] pt-5 text-[10px] text-muted-foreground" aria-hidden>
        {WEEKDAY_LETTERS.map((d, i) => (
          <span key={i} className="flex h-[14px] items-center leading-none">{d}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="grid gap-[3px] text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} aria-hidden>
          {weeks.map((w, i) => {
            const first = w[0].day;
            const showMonth = i === 0 || first.slice(5, 7) !== weeks[i - 1][0].day.slice(5, 7);
            return <span key={first} className="h-4 truncate">{showMonth ? MONTHS[Number(first.slice(5, 7)) - 1] : ""}</span>;
          })}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.flat().map((c) => (
            <span
              key={c.day}
              title={c.future ? dayLabel(c.day) : `${dayLabel(c.day)}: ${c.minutes ? hoursMinutes(c.minutes) : "nothing done"}`}
              className={cn("h-[14px] rounded-[4px]", c.future ? "bg-transparent outline outline-1 -outline-offset-1 outline-border/60" : `m-heat-${c.level}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>None</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} className={cn("size-3 rounded-[3px]", `m-heat-${l}`)} aria-hidden />
      ))}
      <span>3h+</span>
    </div>
  );
}

/** Done minutes per week as small bars, oldest first; the last one is this week. */
export function WeekBars({ weeks }: { weeks: number[] }) {
  const max = Math.max(60, ...weeks);
  return (
    <div className="flex h-10 items-end gap-1" role="img" aria-label={`Last ${weeks.length} weeks: ${weeks.map(hoursMinutes).join(", ")}`}>
      {weeks.map((m, i) => (
        <span
          key={i}
          title={`${i === weeks.length - 1 ? "This week" : `${weeks.length - 1 - i} weeks ago`}: ${hoursMinutes(m)}`}
          className={cn("w-full rounded-t-[4px]", i === weeks.length - 1 ? "bg-[var(--m-accent)]" : "bg-[var(--m-accent)]/35")}
          style={{ height: `${Math.max(6, (m / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
