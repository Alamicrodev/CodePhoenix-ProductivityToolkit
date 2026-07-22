import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { buildCalendarMonth, getHabitHistoryStart } from "../lib/habitStats";
import { HabitDayCell } from "./HabitDayCell";
import { useHabitDayToggle } from "./useHabitDayToggle";
import { Button } from "./ui/button";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HabitCalendarHeatmapProps {
  habit: Habit;
}

export function HabitCalendarHeatmap({ habit }: HabitCalendarHeatmapProps) {
  const { currentTime } = useData();
  const now = new Date(currentTime);
  const toggle = useHabitDayToggle(habit);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const historyStart = useMemo(() => getHabitHistoryStart(habit, now), [habit, currentTime]);
  const calendar = useMemo(
    () => buildCalendarMonth(habit, now, view.year, view.month),
    [habit, currentTime, view.year, view.month],
  );

  const monthIndex = view.year * 12 + view.month;
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const firstMonthIndex = historyStart.getFullYear() * 12 + historyStart.getMonth();

  const goToMonth = (index: number) => {
    setView({ year: Math.floor(index / 12), month: index % 12 });
  };

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Calendar</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={monthIndex <= firstMonthIndex}
            onClick={() => goToMonth(monthIndex - 1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={monthIndex >= currentMonthIndex}
            onClick={() => goToMonth(monthIndex + 1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="text-center text-xs text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {calendar.weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) =>
                day ? (
                  <div key={day.key} className="relative">
                    <HabitDayCell
                      habit={habit}
                      day={day}
                      toggle={toggle}
                      className="aspect-square w-full"
                    />
                    <span className="pointer-events-none absolute left-1 top-0.5 text-[9px] leading-none text-muted-foreground">
                      {day.date.getDate()}
                    </span>
                  </div>
                ) : (
                  <div key={`empty-${dayIndex}`} className="aspect-square w-full" />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-yellow-500" />
            <span>Skipped</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950" />
            <span>Missed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
