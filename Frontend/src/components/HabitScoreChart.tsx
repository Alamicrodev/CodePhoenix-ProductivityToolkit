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

/**
 * Strength reads as a number plus a 3px accent bar. The circular progress ring
 * that used to live here is deleted by name — INSTRUCTIONS-modules.md:15
 * "Remove: … circular progress rings" — and §3 Focus states the same rule for
 * the timer: a bar, "no rings or circles".
 */
function ScoreMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[13.5px] font-semibold tabular-nums">
        {Math.round(score * 100)}%
      </span>
      <div className="h-[3px] w-24 overflow-hidden rounded-sm bg-border">
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.round(score * 100)}%` }}
          aria-hidden="true"
        />
      </div>
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
        <ScoreMeter score={score} />
      </div>
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" minTickGap={24} />
            <YAxis domain={[0, 100]} className="text-xs" width={32} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [`${value}%`, "Strength"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Complete this habit a few times to see its strength develop.
        </p>
      )}
    </div>
  );
}
