import { Habit } from "../context/DataContext";
import { buildDayStatuses, DayCellStatus } from "./habitStats";

export interface HabitQuickAddResult {
  title: string;
  /** Duration token like "10m" lands in the description. */
  description: string;
  frequency: "daily" | "weekly";
  activeDays: number[];
}

const DAY_TOKENS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Parses the Habits quick-add: `meditate 10m every weekday` →
 * duration token → description, frequency tokens → frequency + active days.
 */
export function parseHabitQuickAdd(input: string): HabitQuickAddResult | null {
  let text = input.trim();
  if (!text) return null;

  let description = "";
  const durationMatch = text.match(/\b(\d+)\s*(m|min|mins|minutes|h|hr|hours)\b/i);
  if (durationMatch) {
    const unit = durationMatch[2].toLowerCase().startsWith("h") ? "h" : "m";
    description = `${durationMatch[1]}${unit}`;
    text = text.replace(durationMatch[0], "");
  }

  let frequency: "daily" | "weekly" = "daily";
  let activeDays = ALL_DAYS;

  const dayListMatch = text.match(
    /\b(?:every|on)\s+((?:sun|mon|tue|wed|thu|fri|sat)[a-z]*(?:\s*[,/&]?\s*(?:and\s+)?(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*)*)/i,
  );

  if (/\bevery\s+weekday\b/i.test(text) || /\bweekdays\b/i.test(text)) {
    activeDays = [1, 2, 3, 4, 5];
    text = text.replace(/\b(every\s+weekday(s)?|weekdays)\b/i, "");
  } else if (dayListMatch) {
    const days = [...dayListMatch[1].matchAll(/sun|mon|tue|wed|thu|fri|sat/gi)].map(
      match => DAY_TOKENS[match[0].toLowerCase()],
    );
    if (days.length > 0) activeDays = [...new Set(days)].sort();
    text = text.replace(dayListMatch[0], "");
  } else if (/\b(every\s+week|weekly)\b/i.test(text)) {
    frequency = "weekly";
    text = text.replace(/\b(every\s+week|weekly)\b/i, "");
  } else {
    text = text.replace(/\b(every\s+day|daily)\b/i, "");
  }

  text = text.replace(/\s{2,}/g, " ").trim();
  if (!text) return null;

  const title = text.charAt(0).toUpperCase() + text.slice(1);
  return { title, description, frequency, activeDays };
}

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
