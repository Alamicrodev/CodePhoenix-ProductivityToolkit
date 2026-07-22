import { Habit } from "../context/DataContext";
import { buildDayStatuses, DayCellStatus } from "./habitStats";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Daily", "Weekdays", "Mon / Wed / Fri", "Weekly", "Every 2h" — with a duration suffix from the description. */
export function habitFrequencyLabel(habit: Habit): string {
  let label: string;
  if (habit.frequency === "hourly") {
    label = habit.hourlyInterval && habit.hourlyInterval > 1 ? `Every ${habit.hourlyInterval}h` : "Hourly";
  } else if (habit.frequency === "weekly") {
    label = "Weekly";
  } else {
    const days = habit.activeDays ?? [];
    if (days.length === 0 || days.length === 7) label = "Daily";
    else if (days.length === 5 && [1, 2, 3, 4, 5].every(day => days.includes(day))) label = "Weekdays";
    else label = [...days].sort().map(day => DAY_NAMES[day]).join(" / ");
  }

  const durationSuffix = habit.description && /^\d+[mh]$/.test(habit.description) ? ` · ${habit.description}` : "";
  return label + durationSuffix;
}

export type WeekSquareState = "done" | "skipped" | "empty";

export interface WeekSquare {
  key: string;
  state: WeekSquareState;
  isToday: boolean;
  label: string;
}

function squareState(status: DayCellStatus): WeekSquareState {
  if (status === "completed" || status === "partial") return "done";
  if (status === "skipped") return "skipped";
  return "empty";
}

/** Trailing 7 days ending today, for the per-row dot squares. */
export function trailingWeekSquares(habit: Habit, now = new Date()): WeekSquare[] {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return buildDayStatuses(habit, now, from, to).map((status, index) => ({
    key: status.key,
    state: squareState(status.status),
    isToday: index === 6,
    label: status.date.toLocaleDateString("en-US", { weekday: "short" }),
  }));
}

/** Two-letter weekday initials for the trailing week, today last. */
export function trailingWeekLabels(now = new Date()): { label: string; isToday: boolean }[] {
  const labels: { label: string; isToday: boolean }[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    labels.push({
      label: day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      isToday: offset === 0,
    });
  }
  return labels;
}
