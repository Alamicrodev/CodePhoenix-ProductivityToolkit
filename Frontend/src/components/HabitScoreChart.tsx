import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { buildScoreSeries } from "../lib/habitStats";

const MAX_CHART_POINTS = 180;

interface HabitScoreChartProps {
  habit: Habit;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * score;

  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="#22c55e"
          strokeDasharray={`${progress} ${circumference - progress}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

export function HabitScoreChart({ habit }: HabitScoreChartProps) {
  const { currentTime } = useData();
  const now = new Date(currentTime);

  const points = useMemo(() => buildScoreSeries(habit, now), [habit, currentTime]);
  const score = points.length > 0 ? points[points.length - 1].score : 0;

  const chartData = useMemo(() => {
    const step = Math.max(1, Math.ceil(points.length / MAX_CHART_POINTS));
    return points
      .filter((_, index) => index % step === 0 || index === points.length - 1)
      .map(point => ({
        label: point.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: Math.round(point.score * 100),
      }));
  }, [points]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Habit Strength</h3>
        <ScoreRing score={score} />
      </div>
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" minTickGap={24} />
            <YAxis domain={[0, 100]} className="text-xs" width={32} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [`${value}%`, "Strength"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Complete this habit a few times to see its strength develop.
        </p>
      )}
    </div>
  );
}
