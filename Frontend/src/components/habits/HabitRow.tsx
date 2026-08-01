import { Link } from "react-router";
import { Flame } from "lucide-react";
import type { Habit } from "../../context/DataContext";
import type { HabitDayStatus } from "../../lib/habitStats";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { cn } from "../ui/utils";

/**
 * The trailing-week indicator — Style Guide §3 Habits:
 * "9px dots show the trailing week (done = --done, missed = --border, today
 * outlined accent)". Radius 3, gap 3.
 */
function WeekDots({ days }: { days: HabitDayStatus[] }) {
  return (
    <div className="hidden shrink-0 items-center gap-[3px] sm:flex" aria-hidden="true">
      {days.map(day => {
        const done = day.status === "completed";
        const partial = day.status === "partial";
        const skipped = day.status === "skipped";
        return (
          <span
            key={day.key}
            title={`${day.date.toLocaleDateString("en-US", { weekday: "short" })} — ${day.status}`}
            className={cn(
              "h-[9px] w-[9px] rounded-[3px]",
              done && "bg-done",
              partial && "bg-done/50",
              skipped && "bg-priority-medium",
              !done && !partial && !skipped && "bg-border",
              // Today is an accent OUTLINE, layered over whatever state it has.
              day.isToday && "bg-transparent ring-1 ring-inset ring-primary",
              day.isToday && done && "bg-done",
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * One habit = one borderless row inside the list panel, per principle 3
 * ("Rows, not cards"): control · title + inline meta · trailing week ·
 * right-aligned streak. Hover is a --hover background only.
 */
export function HabitRow({
  habit,
  week,
  isCheckedToday,
  onToggleToday,
  index,
}: {
  habit: Habit;
  week: HabitDayStatus[];
  isCheckedToday: boolean;
  onToggleToday: () => void;
  /** 1-9 rows carry their number key as a hint. */
  index: number;
}) {
  const frequencyLabel =
    habit.frequency === "hourly"
      ? "Hourly"
      : habit.frequency === "weekly"
        ? "Weekly"
        : habit.activeDays && habit.activeDays.length > 0 && habit.activeDays.length < 7
          ? habit.activeDays
              .map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
              .join(" ")
          : "Daily";

  return (
    <div className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
      <CircleCheckbox
        checked={isCheckedToday}
        onToggle={onToggleToday}
        label={isCheckedToday ? `Undo check-in: ${habit.title}` : `Check in: ${habit.title}`}
      />
      <Link
        to={`/habits/${habit.id}`}
        className="flex min-w-0 flex-1 items-baseline gap-2 outline-none focus-visible:underline"
      >
        <span className="truncate text-[13px] font-medium">{habit.title}</span>
        <span className="hidden shrink-0 truncate text-xs text-tertiary sm:inline">
          {frequencyLabel}
        </span>
      </Link>
      {index <= 9 && (
        <span className="shrink-0 font-mono text-[10px] text-tertiary opacity-0 group-hover:opacity-100">
          {index}
        </span>
      )}
      <WeekDots days={week} />
      <span className="flex w-[52px] shrink-0 items-center justify-end gap-1 text-xs text-tertiary">
        {habit.streak > 0 && <Flame className="h-3.5 w-3.5" />}
        {habit.streak}
      </span>
    </div>
  );
}
