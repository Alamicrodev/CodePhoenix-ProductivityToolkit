import { useMemo } from "react";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { localDateKey, startOfLocalDay } from "../lib/habitSchedule";
import { getBestStreaks } from "../lib/habitStats";

interface HabitStreaksCardProps {
  habit: Habit;
}

function formatStreakDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function HabitStreaksCard({ habit }: HabitStreaksCardProps) {
  const { currentTime } = useData();
  const now = new Date(currentTime);

  const streaks = useMemo(() => getBestStreaks(habit, now, 5), [habit, currentTime]);
  const maxLength = streaks.length > 0 ? streaks[0].length : 1;
  const todayKey = localDateKey(startOfLocalDay(now));
  const unit = habit.frequency === "weekly" ? "wk" : habit.frequency === "hourly" ? "slot" : "day";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 font-semibold">Best Streaks</h3>
      {streaks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Complete this habit to start a streak.
        </p>
      ) : (
        <div className="space-y-3">
          {streaks.map(streak => {
            const isOngoing = localDateKey(streak.end) >= todayKey;
            return (
              <div
                key={`${streak.start.toISOString()}-${streak.end.toISOString()}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-24 shrink-0 text-right text-muted-foreground">
                  {formatStreakDate(streak.start)}
                </span>
                <div className="flex-1">
                  <div
                    className="flex h-6 min-w-8 items-center justify-center rounded-md bg-orange-500 px-2 text-xs font-semibold text-white dark:bg-orange-600"
                    style={{ width: `${Math.max(15, (streak.length / maxLength) * 100)}%` }}
                  >
                    {streak.length} {unit}
                    {streak.length === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="w-24 shrink-0 text-muted-foreground">
                  {isOngoing ? "today" : formatStreakDate(streak.end)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
