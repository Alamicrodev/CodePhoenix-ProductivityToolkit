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
import { useData } from "../context/DataContext";
import { buildMonthlyHistory, buildWeeklyHistory } from "../lib/habitStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface HabitHistoryChartProps {
  habit: Habit;
}

function HistoryBars({ data }: { data: { label: string; completed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" className="text-xs" minTickGap={16} />
        <YAxis allowDecimals={false} className="text-xs" width={32} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="completed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HabitHistoryChart({ habit }: HabitHistoryChartProps) {
  const { currentTime } = useData();
  const now = new Date(currentTime);

  const weekly = useMemo(() => buildWeeklyHistory(habit, now, 26), [habit, currentTime]);
  const monthly = useMemo(() => buildMonthlyHistory(habit, now, 12), [habit, currentTime]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Tabs defaultValue="weekly">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">History</h3>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="weekly">
          <HistoryBars data={weekly} />
        </TabsContent>
        <TabsContent value="monthly">
          <HistoryBars data={monthly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
