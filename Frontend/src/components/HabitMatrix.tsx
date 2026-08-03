import { useMemo } from "react";
import { Link } from "react-router";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { addDays, startOfLocalDay } from "../lib/habitSchedule";
import { buildDayStatuses, getCurrentScore } from "../lib/habitStats";
import { HabitDayCell } from "./HabitDayCell";
import { useHabitDayToggle } from "./useHabitDayToggle";

const DAY_COUNT = 7;

interface HabitMatrixProps {
  habits: Habit[];
}

function HabitMatrixRow({ habit, days, index }: { habit: Habit; days: Date[]; index: number }) {
  const { currentTime } = useData();
  const toggle = useHabitDayToggle(habit);
  const now = new Date(currentTime);

  const statuses = useMemo(
    () => buildDayStatuses(habit, now, days[0], days[days.length - 1]),
    [habit, currentTime],
  );
  const score = useMemo(() => getCurrentScore(habit, now), [habit, currentTime]);

  return (
    <div className="flex items-center gap-2 border-t border-border py-2">
      <div className="sticky left-0 z-10 flex min-w-40 flex-1 flex-col bg-card pr-2">
        <span className="flex items-center gap-1.5">
          {/* The 1-9 check-in shortcut needs an anchor on screen. */}
          {index < 9 && (
            <span className="shrink-0 font-mono text-[10px] text-tertiary" aria-hidden="true">
              {index + 1}
            </span>
          )}
          <Link
            to={`/habits/${habit.id}`}
            className="truncate text-[13px] font-medium hover:underline"
            title={habit.title}
          >
            {habit.title}
          </Link>
        </span>
        <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
      </div>
      <div className="flex gap-2">
        {statuses.map(day => (
          <HabitDayCell key={day.key} habit={habit} day={day} toggle={toggle} />
        ))}
      </div>
    </div>
  );
}

export function HabitMatrix({ habits }: HabitMatrixProps) {
  const { currentTime } = useData();
  const now = new Date(currentTime);
  const today = startOfLocalDay(now);
  const days = useMemo(
    () => Array.from({ length: DAY_COUNT }, (_, index) => addDays(today, index - (DAY_COUNT - 1))),
    [currentTime],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 pb-2">
        <div className="sticky left-0 z-10 min-w-40 flex-1 bg-card" />
        <div className="flex gap-2">
          {days.map(day => (
            <div
              key={day.toISOString()}
              className="flex h-10 w-10 flex-col items-center justify-center text-xs text-muted-foreground shrink-0"
            >
              <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="font-medium text-foreground">{day.getDate()}</span>
            </div>
          ))}
        </div>
      </div>
      {habits.map((habit, index) => (
        <HabitMatrixRow key={habit.id} habit={habit} days={days} index={index} />
      ))}
    </div>
  );
}
