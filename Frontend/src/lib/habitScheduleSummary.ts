import type { Habit } from "../context/DataContext";
import { formatClockTime12, parseClockTime } from "./timeFormat";

export function describeHabitListMeta(habit: Habit): string {
  const activeDays = habit.activeDays ?? [];
  const days = formatActiveDays(activeDays);
  const pieces: string[] = [];

  if (habit.frequency === "hourly") {
    const interval = Math.max(1, Math.round(habit.hourlyInterval ?? 1));
    const label = interval === 1 ? "Every hour" : `Every ${interval} hours`;
    const frequency = habit.activeHours
      ? `${label} (${formatClockTime12(habit.activeHours.start)}-${formatClockTime12(habit.activeHours.end)})`
      : label;
    pieces.push(frequency);
    if (days !== "every day") {
      pieces.push(days);
    }
    return pieces.join(" | ");
  } else if (habit.frequency === "weekly") {
    pieces.push("Weekly");
  } else if (days === "every day") {
    pieces.push("Daily");
  } else {
    pieces.push(days);
  }

  if (habit.frequency === "daily" && habit.activeHours) {
    const start = formatClockTime12(habit.activeHours.start);
    const end = formatClockTime12(habit.activeHours.end);
    pieces.push(start === end ? start : `${start}-${end}`);
  }

  return pieces.join(" | ");
}

/**
 * Plain-English descriptions of a habit's schedule, for the creation modal.
 *
 * Strings only — deliberately no date walking. `habitSchedule.ts` is the
 * frontend half of a byte-for-byte mirror of
 * `backend/app/services/habit_progress.py`; a second engine here would drift
 * from both. The slot-count arithmetic below is the one exception and mirrors
 * `_hourly_day_slots` exactly.
 */
export interface HabitScheduleDraft {
  frequency: Habit["frequency"];
  hourlyInterval: number;
  /** Always 1–7 entries while editing; [] (= every day) is only a save format. */
  activeDays: number[];
  activeHours: { start: string; end: string } | null;
}

const MINUTES_PER_DAY = 24 * 60;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAYS = "1,2,3,4,5";
const WEEKEND = "0,6";

/** "every day" · "weekdays" · "weekends" · "Mon, Wed, Fri". */
export function formatActiveDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === 7) {
    return "every day";
  }
  const key = sorted.join(",");
  if (key === WEEKDAYS) return "weekdays";
  if (key === WEEKEND) return "weekends";
  return sorted.map(day => DAY_SHORT[day]).join(", ");
}

function minutesOf(value: string) {
  const { hours, minutes } = parseClockTime(value);
  return hours * 60 + minutes;
}

/** Mirrors `_hourly_day_slots` — how many check-ins an hourly habit asks for. */
export function hourlySlotsPerDay(
  hourlyInterval: number,
  activeHours: { start: string; end: string } | null,
): number {
  const interval = Math.max(1, Math.round(hourlyInterval));
  if (!activeHours) {
    return Math.ceil(MINUTES_PER_DAY / (interval * 60));
  }
  const span = minutesOf(activeHours.end) - minutesOf(activeHours.start);
  // A zero or inverted window is "all day" to the schedule engine.
  const windowMinutes = span > 0 ? span : MINUTES_PER_DAY;
  return Math.max(1, Math.ceil(windowMinutes / (interval * 60)));
}

/**
 * One line naming everything the schedule actually does — including the two
 * things a user cannot otherwise discover: that a weekly habit restricted to
 * certain days can only be checked in on those days, and that a time on a
 * daily habit is what places it on the Schedule timeline.
 */
export function describeHabitSchedule(draft: HabitScheduleDraft): string {
  const days = formatActiveDays(draft.activeDays);

  if (draft.frequency === "hourly") {
    const interval = Math.max(1, Math.round(draft.hourlyInterval));
    const window = draft.activeHours
      ? `${formatClockTime12(draft.activeHours.start)}–${formatClockTime12(draft.activeHours.end)}`
      : "all day";
    const slots = hourlySlotsPerDay(interval, draft.activeHours);
    return `Every ${interval}h · ${days} · ${window} · ~${slots} check-in${slots === 1 ? "" : "s"} a day`;
  }

  if (draft.frequency === "weekly") {
    // activeDays gates completion for weekly habits too — say so.
    return draft.activeDays.length === 7
      ? "Once a week · check in any day"
      : `Once a week · ${days} only`;
  }

  const time = draft.activeHours
    ? `${formatClockTime12(draft.activeHours.start)} on the schedule`
    : "not on the schedule timeline";
  return `Once a day · ${days} · ${time}`;
}
