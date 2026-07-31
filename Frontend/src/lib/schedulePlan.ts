import { Habit, Task } from "../context/DataContext";
import { findCompletionMarkerForDay } from "./habitStats";
import { isActiveDay } from "./habitSchedule";
import { TaskPriority, compareByPriority } from "./taskDates";
import { parseClockTime, parseDateOnlyLocal } from "./timeFormat";

/** Visible day range of the timeline: 8:00–18:00, 68px per hour. */
export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;
export const HOUR_PX = 68;
/** Vertical offset of the 8 AM line inside the grid canvas. */
export const GRID_PAD = 8;
/** Total canvas height: 10h × 68px + 16. */
export const GRID_HEIGHT = ((DAY_END - DAY_START) / 60) * HOUR_PX + 16;

/** `start` for blocks whose task/habit has no time of day. */
export const UNTIMED = -1;

export type BlockKind = "task" | "habit";

export interface ScheduleBlock {
  id: string;
  /** Minutes from midnight, or UNTIMED when no time is set. */
  start: number;
  /** Display duration in minutes (estimated from priority for tasks). */
  dur: number;
  kind: BlockKind;
  title: string;
  desc?: string;
  done: boolean;
  priority?: TaskPriority;
  /** Date key (YYYY-MM-DD) for task blocks; drives overdue/due-today styling. */
  dueDate?: string | null;
  /** Habit streak in days. */
  streak?: number;
  /** Backing task/habit id; toggles write through to the workspace. */
  sourceId: string;
}

export interface DayBlocks {
  /** Blocks with a time of day, sorted by start with overlaps cascaded. */
  timed: ScheduleBlock[];
  /** Blocks scheduled for the day but without a time. */
  untimed: ScheduleBlock[];
}

/* ---------------------------------- formatting ---------------------------------- */

/** "9:30" or "10:30 AM" (period only when `withPeriod`). */
export function formatMinutes(min: number, withPeriod = false): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  const period = withPeriod ? (h >= 12 ? " PM" : " AM") : "";
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

/** "30m", "1h", "1h 30m". */
export function formatBlockDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** "9:30 – 10:30 AM" (en dash, period on the end only). */
export function formatTimeRange(start: number, end: number): string {
  return `${formatMinutes(start)} – ${formatMinutes(end, true)}`;
}

/* ---------------------------------- derivation ---------------------------------- */

/** Display duration of a task block, estimated from its priority. */
const TASK_DURATION: Record<TaskPriority, number> = { high: 60, medium: 45, low: 30 };
const HABIT_DURATION = 30;

/** Estimated display duration for a task of the given priority. */
export function estimatedTaskDuration(priority: TaskPriority): number {
  return TASK_DURATION[priority];
}

/** Minutes from a "HH:MM" clock string. */
export function clockToMinutes(value: string): number {
  const { hours, minutes } = parseClockTime(value);
  return hours * 60 + minutes;
}

/** Minutes from midnight for a Date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function taskBlock(task: Task): ScheduleBlock {
  return {
    id: `task-${task.id}`,
    start: task.dueTime ? clockToMinutes(task.dueTime) : UNTIMED,
    dur: TASK_DURATION[task.priority],
    kind: "task",
    title: task.title,
    desc: task.description || undefined,
    done: task.completed,
    priority: task.priority,
    dueDate: task.dueDate,
    sourceId: task.id,
  };
}

function habitBlock(habit: Habit, day: Date): ScheduleBlock {
  return {
    id: `habit-${habit.id}`,
    start: habit.activeHours?.start ? clockToMinutes(habit.activeHours.start) : UNTIMED,
    dur: HABIT_DURATION,
    kind: "habit",
    title: habit.title,
    desc: habit.description || undefined,
    done: findCompletionMarkerForDay(habit, day) !== null,
    streak: habit.streak,
    sourceId: habit.id,
  };
}

/**
 * Cascades overlapping timed blocks: a block starting before the previous one
 * ends is pushed down to render after it, so simultaneous items stack instead
 * of covering each other.
 */
export function layoutTimedBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  let prevEnd = Number.NEGATIVE_INFINITY;
  return sorted.map(block => {
    const start = Math.max(block.start, prevEnd);
    prevEnd = start + block.dur;
    return start === block.start ? block : { ...block, start };
  });
}

/**
 * The day's schedule as the user actually set it up: tasks due that day
 * (placed at their due time) and non-hourly habits active that day (placed at
 * their active-hours start). Items without a time go to `untimed`.
 */
export function deriveDayBlocks(tasks: Task[], habits: Habit[], dayKey: string): DayBlocks {
  const day = parseDateOnlyLocal(dayKey);

  const blocks = [
    ...tasks.filter(t => t.dueDate === dayKey).map(taskBlock),
    ...habits
      .filter(h => h.frequency !== "hourly" && isActiveDay(h, day))
      .map(h => habitBlock(h, day)),
  ];

  const untimed = blocks
    .filter(b => b.start === UNTIMED)
    .sort(
      (a, b) =>
        (a.kind === "habit" ? 1 : 0) - (b.kind === "habit" ? 1 : 0) ||
        compareByPriority(
          { priority: a.priority ?? "medium", dueDate: null, dueTime: null },
          { priority: b.priority ?? "medium", dueDate: null, dueTime: null },
        ) ||
        a.title.localeCompare(b.title),
    );

  return {
    timed: layoutTimedBlocks(blocks.filter(b => b.start !== UNTIMED)),
    untimed,
  };
}

/* ---------------------------------- derivations ---------------------------------- */

/** Agenda groups: Morning (<12 PM), Afternoon (12–5 PM), Evening (≥5 PM); empty groups omitted. */
export function agendaGroups(blocks: ScheduleBlock[]): Array<{ name: string; rows: ScheduleBlock[] }> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  return [
    { name: "Morning", rows: sorted.filter(b => b.start < 12 * 60) },
    { name: "Afternoon", rows: sorted.filter(b => b.start >= 12 * 60 && b.start < 17 * 60) },
    { name: "Evening", rows: sorted.filter(b => b.start >= 17 * 60) },
  ].filter(g => g.rows.length > 0);
}

export interface PlanStats {
  plannedMin: number;
  focusMin: number;
  doneCount: number;
  totalCount: number;
}

/** Today-rail stats: planned = total load, focus = task blocks ≥ 60m, done = x/y. */
export function computePlanStats(blocks: ScheduleBlock[]): PlanStats {
  return {
    plannedMin: blocks.reduce((acc, b) => acc + b.dur, 0),
    focusMin: blocks
      .filter(b => b.kind === "task" && b.dur >= 60)
      .reduce((acc, b) => acc + b.dur, 0),
    doneCount: blocks.filter(b => b.done).length,
    totalCount: blocks.length,
  };
}

/* ------------------------------- drag scheduling -------------------------------- */

/** Drag-and-drop snap grid on the timeline. */
export const SLOT_MINUTES = 15;

/** Snaps a raw minute offset to the 15m grid, clamped to the visible day. */
export function snapToSlot(rawMinutes: number): number {
  const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(Math.max(snapped, DAY_START), DAY_END - SLOT_MINUTES);
}

/** Minutes from midnight → "HH:MM" (the workspace clock-time format). */
export function minutesToClock(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Moves a habit's active-hours window to start at `newStart`, preserving the
 * window length (default 30m when the habit had no window).
 */
export function shiftWindow(
  window: { start: string; end: string } | undefined,
  newStart: number,
): { start: string; end: string } {
  const length = window
    ? Math.max(clockToMinutes(window.end) - clockToMinutes(window.start), SLOT_MINUTES)
    : HABIT_DURATION;
  return { start: minutesToClock(newStart), end: minutesToClock(newStart + length) };
}

/** Converts a Y offset inside the grid canvas (below GRID_PAD) to raw minutes. */
export function minutesFromGridY(y: number): number {
  return ((y - GRID_PAD) / HOUR_PX) * 60 + DAY_START;
}

/** True when the block is running right now (today only, timed, undone). */
export function isInProgress(block: ScheduleBlock, nowMin: number, isToday: boolean): boolean {
  return (
    isToday &&
    block.start !== UNTIMED &&
    !block.done &&
    nowMin >= block.start &&
    nowMin < block.start + block.dur
  );
}
