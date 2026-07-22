import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Habit } from "../context/DataContext";
import { buildWeekdayFrequency } from "../lib/habitStats";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HabitFrequencyCardProps {
  habit: Habit;
}

export function HabitFrequencyCard({ habit }: HabitFrequencyCardProps) {
  const data = useMemo(
    () =>
      buildWeekdayFrequency(habit).map((count, index) => ({
        label: WEEKDAY_LABELS[index],
        completed: count,
      })),
    [habit],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 font-semibold">Frequency</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" className="text-xs" />
          <YAxis allowDecimals={false} className="text-xs" width={32} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
