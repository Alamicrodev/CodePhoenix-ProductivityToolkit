import type { Habit } from "../context/DataContext";
import {
  addDays,
  buildHourlySlotsForDay,
  endOfLocalDay,
  hasCompletionInRange,
  hasSkipInRange,
  isActiveDay,
  localDateKey,
  parseStoredDate,
  startOfLocalDay,
  startOfWeek,
} from "./habitSchedule";
import type { HabitHistorySlot } from "./habitSchedule";

export type DayCellStatus =
  | "completed"
  | "partial"
  | "skipped"
  | "missed"
  | "pending"
  | "inactive"
  | "before-start";

export interface HabitDayStatus {
  date: Date;
  key: string;
  status: DayCellStatus;
  dueSlots: number;
  completedSlots: number;
  toggleable: boolean;
  /**
   * Today's cell is outlined in the accent regardless of its status — the
   * design system's trailing-week indicator marks "today" separately from
   * done/missed, so it cannot be derived from `status` alone.
   */
  isToday: boolean;
}

/** A day status before buildDayStatuses stamps the isToday flag onto it. */
type DayStatusCore = Omit<HabitDayStatus, "isToday">;

export interface ScorePoint {
  date: Date;
  score: number;
}

export interface StreakInterval {
  start: Date;
  end: Date;
  length: number;
}

export interface PeriodCount {
  periodStart: Date;
  label: string;
  completed: number;
}

export interface CalendarMonthData {
  year: number;
  month: number;
  weeks: (HabitDayStatus | null)[][];
}

// Loop Habit Tracker's daily smoothing constant: a 13-step half-life,
// so 13 consecutive completions from zero land exactly at 50%.
const SCORE_DECAY = 0.5 ** (1 / 13);

function habitCreatedDay(habit: Habit): Date | null {
  return habit.createdAt ? startOfLocalDay(new Date(habit.createdAt)) : null;
}

function skipOccurrences(habit: Habit) {
  return (habit.occurrences ?? []).filter(occ => occ.status === "skipped");
}

export function getHabitHistoryStart(habit: Habit, now: Date): Date {
  const candidates: Date[] = [];
  const created = habitCreatedDay(habit);
  if (created) {
    candidates.push(created);
  }

  for (const entry of habit.completedDates) {
    candidates.push(startOfLocalDay(parseStoredDate(entry)));
  }

  for (const occ of skipOccurrences(habit)) {
    candidates.push(startOfLocalDay(parseStoredDate(occ.timestamp)));
  }

  if (candidates.length === 0) {
    return addDays(startOfLocalDay(now), -90);
  }

  return candidates.reduce((min, date) => (date < min ? date : min));
}

function completionDayKeysInWeek(habit: Habit, weekStart: Date, weekEnd: Date): Set<string> {
  const keys = new Set<string>();
  const lastInstant = new Date(weekEnd.getTime() - 1);

  for (const entry of habit.completedDates) {
    const completion = parseStoredDate(entry);
    if (completion >= weekStart && completion <= lastInstant) {
      keys.add(localDateKey(completion));
    }
  }

  return keys;
}

function skipDayKeys(habit: Habit): Set<string> {
  const keys = new Set<string>();
  for (const occ of skipOccurrences(habit)) {
    keys.add(localDateKey(parseStoredDate(occ.timestamp)));
  }
  return keys;
}

function elapsedHourlySlots(slots: HabitHistorySlot[], now: Date) {
  return slots.filter(slot => slot.end <= now || slot.status === "completed" || slot.status === "skipped");
}

function dailyDayStatus(habit: Habit, day: Date, today: Date, now: Date, created: Date | null): DayStatusCore {
  const base = { date: day, key: localDateKey(day), dueSlots: 1, completedSlots: 0 };

  if (created && day < created) {
    return { ...base, dueSlots: 0, status: "before-start", toggleable: false };
  }

  if (!isActiveDay(habit, day)) {
    return { ...base, dueSlots: 0, status: "inactive", toggleable: false };
  }

  if (day > today) {
    return { ...base, status: "pending", toggleable: false };
  }

  if (hasCompletionInRange(habit, day, endOfLocalDay(day))) {
    return { ...base, completedSlots: 1, status: "completed", toggleable: true };
  }

  if (hasSkipInRange(habit, day, endOfLocalDay(day))) {
    return { ...base, status: "skipped", toggleable: true };
  }

  if (day.getTime() === today.getTime()) {
    return { ...base, status: "pending", toggleable: true };
  }

  return { ...base, status: "missed", toggleable: true };
}

function hourlyDayStatus(habit: Habit, day: Date, today: Date, now: Date, created: Date | null): DayStatusCore {
  const base = { date: day, key: localDateKey(day) };

  if (created && day < created && endOfLocalDay(day) < created) {
    return { ...base, dueSlots: 0, completedSlots: 0, status: "before-start", toggleable: false };
  }

  if (!isActiveDay(habit, day)) {
    return { ...base, dueSlots: 0, completedSlots: 0, status: "inactive", toggleable: false };
  }

  if (day > today) {
    return { ...base, dueSlots: 0, completedSlots: 0, status: "pending", toggleable: false };
  }

  const cutoff = day.getTime() === today.getTime() ? now : endOfLocalDay(day);
  const slots = buildHourlySlotsForDay(habit, day, cutoff, created);
  const due = elapsedHourlySlots(slots, now);
  const completedSlots = due.filter(slot => slot.status === "completed").length;
  const skippedSlots = due.filter(slot => slot.status === "skipped").length;

  if (due.length === 0) {
    return { ...base, dueSlots: 0, completedSlots: 0, status: day.getTime() === today.getTime() ? "pending" : "inactive", toggleable: false };
  }

  const dueSlots = due.length;
  if (completedSlots === dueSlots) {
    return { ...base, dueSlots, completedSlots, status: "completed", toggleable: true };
  }

  if (completedSlots > 0) {
    return { ...base, dueSlots, completedSlots, status: "partial", toggleable: true };
  }

  if (skippedSlots === dueSlots) {
    return { ...base, dueSlots, completedSlots, status: "skipped", toggleable: true };
  }

  if (day.getTime() === today.getTime()) {
    return { ...base, dueSlots, completedSlots, status: "pending", toggleable: true };
  }

  return { ...base, dueSlots, completedSlots, status: "missed", toggleable: true };
}

function weeklyDayStatus(
  habit: Habit,
  day: Date,
  today: Date,
  now: Date,
  created: Date | null,
): DayStatusCore {
  const base = { date: day, key: localDateKey(day), dueSlots: 1, completedSlots: 0 };

  if (created && day < created) {
    return { ...base, dueSlots: 0, status: "before-start", toggleable: false };
  }

  const weekStart = startOfWeek(day);
  const weekEnd = addDays(weekStart, 7);
  const completionKeys = completionDayKeysInWeek(habit, weekStart, weekEnd);

  if (completionKeys.size > 0) {
    if (completionKeys.has(base.key)) {
      return { ...base, completedSlots: 1, status: "completed", toggleable: true };
    }

    return { ...base, dueSlots: 0, status: "inactive", toggleable: false };
  }

  if (hasSkipInRange(habit, weekStart, weekEnd)) {
    const skippedKeys = skipDayKeys(habit);
    if (skippedKeys.has(base.key)) {
      return { ...base, status: "skipped", toggleable: true };
    }

    return { ...base, dueSlots: 0, status: "inactive", toggleable: false };
  }

  if (day > today) {
    return { ...base, status: "pending", toggleable: false };
  }

  if (weekEnd.getTime() <= now.getTime()) {
    return { ...base, status: "missed", toggleable: true };
  }

  return { ...base, status: "pending", toggleable: true };
}

export function buildDayStatuses(habit: Habit, now: Date, from: Date, to: Date): HabitDayStatus[] {
  const statuses: HabitDayStatus[] = [];
  const today = startOfLocalDay(now);
  const created = habitCreatedDay(habit);
  const lastDay = startOfLocalDay(to);

  for (let day = startOfLocalDay(from); day <= lastDay; day = addDays(day, 1)) {
    const status =
      habit.frequency === "hourly"
        ? hourlyDayStatus(habit, day, today, now, created)
        : habit.frequency === "weekly"
          ? weeklyDayStatus(habit, day, today, now, created)
          : dailyDayStatus(habit, day, today, now, created);
    // Stamped here rather than in each builder — only this function knows
    // `today`, and all three builders share it.
    statuses.push({ ...status, isToday: day.getTime() === today.getTime() });
  }

  return statuses;
}

export function buildScoreSeries(habit: Habit, now: Date): ScorePoint[] {
  const points: ScorePoint[] = [];
  const today = startOfLocalDay(now);
  const start = getHabitHistoryStart(habit, now);
  let score = 0;

  if (habit.frequency === "weekly") {
    const currentWeek = startOfWeek(now);

    for (let weekStart = startOfWeek(start); weekStart <= currentWeek; weekStart = addDays(weekStart, 7)) {
      const weekEnd = addDays(weekStart, 7);
      const completed = hasCompletionInRange(habit, weekStart, weekEnd);
      const skipped = !completed && hasSkipInRange(habit, weekStart, weekEnd);

      if (weekStart.getTime() === currentWeek.getTime() && !completed) {
        break;
      }

      if (!skipped) {
        score = score * SCORE_DECAY + (completed ? 1 : 0) * (1 - SCORE_DECAY);
      }

      points.push({ date: weekStart, score });
    }

    return points;
  }

  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (!isActiveDay(habit, day)) {
      continue;
    }

    if (habit.frequency === "hourly") {
      const isToday = day.getTime() === today.getTime();
      const cutoff = isToday ? now : endOfLocalDay(day);
      const slots = buildHourlySlotsForDay(habit, day, cutoff, habitCreatedDay(habit));
      const due = elapsedHourlySlots(slots, now);
      const completedSlots = due.filter(slot => slot.status === "completed").length;
      const skippedSlots = due.filter(slot => slot.status === "skipped").length;
      const gradedSlots = due.length - skippedSlots;

      if (due.length === 0 || gradedSlots === 0) {
        continue;
      }

      score = score * SCORE_DECAY + (completedSlots / gradedSlots) * (1 - SCORE_DECAY);
      points.push({ date: day, score });
      continue;
    }

    const completed = hasCompletionInRange(habit, day, endOfLocalDay(day));
    const skipped = !completed && hasSkipInRange(habit, day, endOfLocalDay(day));

    if (day.getTime() === today.getTime() && !completed) {
      break;
    }

    if (!skipped) {
      score = score * SCORE_DECAY + (completed ? 1 : 0) * (1 - SCORE_DECAY);
    }

    points.push({ date: day, score });
  }

  return points;
}

export function getCurrentScore(habit: Habit, now: Date): number {
  const points = buildScoreSeries(habit, now);
  return points.length > 0 ? points[points.length - 1].score : 0;
}

interface StreakUnit {
  start: Date;
  end: Date;
  state: "completed" | "skipped" | "missed" | "pending";
}

function collectStreakUnits(habit: Habit, now: Date): StreakUnit[] {
  const units: StreakUnit[] = [];
  const start = getHabitHistoryStart(habit, now);
  const today = startOfLocalDay(now);
  const created = habitCreatedDay(habit);

  if (habit.frequency === "weekly") {
    const currentWeek = startOfWeek(now);

    for (let weekStart = startOfWeek(start); weekStart <= currentWeek; weekStart = addDays(weekStart, 7)) {
      const weekEnd = addDays(weekStart, 7);
      const completed = hasCompletionInRange(habit, weekStart, weekEnd);
      const skipped = !completed && hasSkipInRange(habit, weekStart, weekEnd);
      const elapsed = weekEnd.getTime() <= now.getTime();
      const state = completed ? "completed" : skipped ? "skipped" : elapsed ? "missed" : "pending";
      units.push({ start: weekStart, end: addDays(weekStart, 6), state });
    }

    return units;
  }

  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (!isActiveDay(habit, day)) {
      continue;
    }

    if (habit.frequency === "hourly") {
      const isToday = day.getTime() === today.getTime();
      const cutoff = isToday ? now : endOfLocalDay(day);
      const slots = buildHourlySlotsForDay(habit, day, cutoff, created);

      for (const slot of slots) {
        const state = slot.status === "pending" ? "pending" : slot.status;
        units.push({ start: slot.start, end: slot.start, state });
      }

      continue;
    }

    const completed = hasCompletionInRange(habit, day, endOfLocalDay(day));
    const skipped = !completed && hasSkipInRange(habit, day, endOfLocalDay(day));
    const isToday = day.getTime() === today.getTime();
    const state = completed ? "completed" : skipped ? "skipped" : isToday ? "pending" : "missed";
    units.push({ start: day, end: day, state });
  }

  return units;
}

export function getBestStreaks(habit: Habit, now: Date, limit = 5): StreakInterval[] {
  const units = collectStreakUnits(habit, now);
  const streaks: StreakInterval[] = [];
  let current: StreakInterval | null = null;

  for (const unit of units) {
    if (unit.state === "completed") {
      if (current) {
        current = { start: current.start, end: unit.end, length: current.length + 1 };
      } else {
        current = { start: unit.start, end: unit.end, length: 1 };
      }
      continue;
    }

    if (unit.state === "pending") {
      continue;
    }

    // skipped and missed both break streaks, matching backend habit_progress.py
    if (current) {
      streaks.push(current);
      current = null;
    }
  }

  if (current) {
    streaks.push(current);
  }

  return streaks
    .sort((a, b) => b.length - a.length || b.end.getTime() - a.end.getTime())
    .slice(0, limit);
}

function countCompletionsInRange(habit: Habit, start: Date, end: Date): number {
  const lastInstant = new Date(end.getTime() - 1);
  return habit.completedDates.filter(entry => {
    const completion = parseStoredDate(entry);
    return completion >= start && completion <= lastInstant;
  }).length;
}

export function buildWeeklyHistory(habit: Habit, now: Date, weeks = 26): PeriodCount[] {
  const counts: PeriodCount[] = [];
  const currentWeek = startOfWeek(now);

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = addDays(currentWeek, -7 * index);
    counts.push({
      periodStart: weekStart,
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      completed: countCompletionsInRange(habit, weekStart, addDays(weekStart, 7)),
    });
  }

  return counts;
}

export function buildMonthlyHistory(habit: Habit, now: Date, months = 12): PeriodCount[] {
  const counts: PeriodCount[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - index + 1, 1);
    counts.push({
      periodStart: monthStart,
      label: monthStart.toLocaleDateString("en-US", { month: "short" }),
      completed: countCompletionsInRange(habit, monthStart, monthEnd),
    });
  }

  return counts;
}

export function buildWeekdayFrequency(habit: Habit): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const entry of habit.completedDates) {
    counts[parseStoredDate(entry).getDay()] += 1;
  }

  return counts;
}

export function buildCalendarMonth(habit: Habit, now: Date, year: number, month: number): CalendarMonthData {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const statuses = buildDayStatuses(habit, now, monthStart, monthEnd);
  const weeks: (HabitDayStatus | null)[][] = [];

  let week: (HabitDayStatus | null)[] = new Array(monthStart.getDay()).fill(null);

  for (const status of statuses) {
    week.push(status);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  return { year, month, weeks };
}

// The backend stores daily/weekly markers as the UTC date of the sent
// timestamp; noon UTC guarantees that date matches the intended local
// calendar day for every timezone offset.
export function backfillTimestampForDay(day: Date): Date {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0));
}

export function findCompletionMarkerForDay(habit: Habit, day: Date): string | null {
  const key = localDateKey(day);
  const exact = habit.completedDates.find(entry => entry === key);
  if (exact) {
    return exact;
  }

  return habit.completedDates.find(entry => localDateKey(parseStoredDate(entry)) === key) ?? null;
}

export function findCompletionMarkerForSlot(habit: Habit, start: Date, end: Date): string | null {
  return (
    habit.completedDates.find(entry => {
      const completion = new Date(entry);
      return completion >= start && completion < end;
    }) ?? null
  );
}

export function findSkipTimestampForDay(habit: Habit, day: Date): string | null {
  const key = localDateKey(day);
  const skip = skipOccurrences(habit).find(occ => localDateKey(parseStoredDate(occ.timestamp)) === key);
  return skip?.timestamp ?? null;
}
