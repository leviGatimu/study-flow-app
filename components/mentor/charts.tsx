"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { dayLabel, hoursMinutes, type DayPoint } from "@/lib/mentor-model";

const noSubscribe = () => () => {};
/** ResponsiveContainer measures the DOM, so charts only draw on the client. */
const useMounted = () => useSyncExternalStore(noSubscribe, () => true, () => false);

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const TOOLTIP = {
  borderRadius: "14px",
  border: "1px solid var(--color-border)",
  fontSize: "12px",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
};

/**
 * Minutes per day as one stacked bar: done, missed, and still to come. Done
 * sits on the baseline so the eye reads it first.
 */
export function StudyTimeChart({ data, today, height = 260 }: { data: DayPoint[]; today: string; height?: number }) {
  const mounted = useMounted();
  const rows = data.map((p) => ({
    day: p.day,
    label: dayLabel(p.day).slice(4),
    done: p.done,
    missed: p.missed,
    open: Math.max(0, p.planned - p.done - p.missed),
  }));
  const total = data.reduce((s, p) => s + p.done, 0);

  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Study time per day, ${hoursMinutes(total)} done in total`}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={14} />
            <YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(m: number) => (m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`)} width={44} />
            <Tooltip
              cursor={{ fill: "var(--m-planned)", opacity: 0.35 }}
              contentStyle={TOOLTIP}
              labelFormatter={(_l, items) => {
                const day = (items?.[0]?.payload as { day?: string } | undefined)?.day;
                return day ? `${dayLabel(day)}${day === today ? " · today" : ""}` : "";
              }}
              formatter={(value, name) => [hoursMinutes(Number(value)), name === "done" ? "Done" : name === "missed" ? "Missed" : "Still to do"]}
            />
            <Bar dataKey="done" stackId="a" fill="var(--m-accent)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="missed" stackId="a" fill="var(--m-missed)" />
            <Bar dataKey="open" stackId="a" fill="var(--m-planned)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export type MarkPoint = { day: string; percent: number; title: string };

/** Each marked exam in date order, as a percentage, with the average as a line. */
export function MarksTrendChart({ data, average, height = 240 }: { data: MarkPoint[]; average: number | null; height?: number }) {
  const mounted = useMounted();
  const rows = data.map((p, i) => ({ ...p, i, label: dayLabel(p.day).slice(4) }));
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Marks over time, average ${average ?? "none"}%`}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} minTickGap={16} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={AXIS} unit="%" width={48} />
            {average !== null && <ReferenceLine y={average} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />}
            <Tooltip
              contentStyle={TOOLTIP}
              labelFormatter={(_l, items) => {
                const p = items?.[0]?.payload as MarkPoint | undefined;
                return p ? `${p.title} · ${dayLabel(p.day)}` : "";
              }}
              formatter={(value) => [`${value}%`, "Mark"]}
            />
            <Line type="monotone" dataKey="percent" stroke="var(--m-accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--m-accent)", stroke: "var(--color-card)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
