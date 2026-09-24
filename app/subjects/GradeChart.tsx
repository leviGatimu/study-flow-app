"use client";

import { useSyncExternalStore } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GradePoint } from "./subject-model";

const noSubscribe = () => () => {};

/** One subject's report-card grades across terms, on a 0-100 scale. */
export function GradeChart({ data }: { data: GradePoint[] }) {
  // ResponsiveContainer measures the DOM, so it only renders on the client.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  return (
    <div className="h-48 w-full" role="img" aria-label={`Grades by term: ${data.map((d) => `${d.term} ${d.rawGrade}`).join(", ")}`}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="subject-grade-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="term"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                fontSize: "12px",
                background: "var(--color-popover)",
                color: "var(--color-popover-foreground)",
              }}
              formatter={(value, _name, item) => [`${value}% (${(item.payload as GradePoint).rawGrade})`, "Grade"]}
            />
            <Area
              type="monotone"
              dataKey="grade"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#subject-grade-fill)"
              dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
