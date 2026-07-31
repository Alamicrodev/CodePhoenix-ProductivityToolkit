import { Habit, Task } from "../context/DataContext";
import { TaskPriority } from "./taskDates";
import { formatDateKeyLocal, parseDateOnlyLocal, parseClockTime } from "./timeFormat";

/** Visible day range of the timeline: 8:00–18:00, 68px per hour. */
export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;
export const HOUR_PX = 68;
/** Vertical offset of the 8 AM line inside the grid canvas. */
export const GRID_PAD = 8;
/** Total canvas height: 10h × 68px + 16. */
export const GRID_HEIGHT = ((DAY_END - DAY_START) / 60) * HOUR_PX + 16;
/** Latest start a quick-added block can get (5:15 PM). */
const NEW_BLOCK_START_CAP = 17 * 60 + 15;
/** A 15m break is auto-inserted after this much continuous work. */
const WORK_BEFORE_BREAK = 120;

export type BlockKind = "task" | "habit" | "planning" | "break";

export interface ScheduleBlock {
  id: string;
  /** Minutes from midnight. */
  start: number;
  /** Duration in minutes. */
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
  sourceId?: string | null;
}

export interface DayPlan {
  /** ISO timestamp of the last optimize/generate. */
  optimizedAt: string;
  blocks: ScheduleBlock[];
}

export type PlanMap = Record<string, DayPlan>;

const KINDS: BlockKind[] = ["task", "habit", "planning", "break"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

/** localStorage guard for persisted plans. */
export function isPlanMap(value: unknown): value is PlanMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(plan => {
    if (typeof plan !== "object" || plan === null) return false;
    const p = plan as Partial<DayPlan>;
    if (typeof p.optimizedAt !== "string" || !Array.isArray(p.blocks)) return false;
    return p.blocks.every(block => {
      const b = block as Partial<ScheduleBlock>;
      return (
        typeof b.id === "string" &&
        typeof b.start === "number" &&
        typeof b.dur === "number" &&
        b.dur > 0 &&
        typeof b.title === "string" &&
        typeof b.done === "boolean" &&
        KINDS.includes(b.kind as BlockKind) &&
        (b.priority === undefined || PRIORITIES.includes(b.priority))
      );
    });
  });
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

/* ----------------------------------- packing ------------------------------------ */

export const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;

let breakSeq = 0;
const makeBreak = (start: number): ScheduleBlock => ({
  id: `break-${Date.now()}-${breakSeq++}`,
  start,
  dur: 15,
  kind: "break",
  title: "Break",
  done: false,
});

/**
 * Places `items` sequentially from `cursor` (already rounded by the caller).
 * After each block the cursor rounds up to the next 5m; a 15m break is inserted
 * after every ≥120m of continuous work.
 */
export function packBlocks(items: ScheduleBlock[], cursor: number): ScheduleBlock[] {
  const placed: ScheduleBlock[] = [];
  let work = 0;
  for (const item of items) {
    if (work >= WORK_BEFORE_BREAK) {
      placed.push(makeBreak(cursor));
      cursor += 15;
      work = 0;
    }
    placed.push({ ...item, start: cursor });
    cursor = roundUpTo(cursor + item.dur, 5);
    work += item.dur;
  }
  return placed;
}

/**
 * Movable-block ordering: overdue tasks → tasks due on the plan day → other
 * tasks/planning → habits, each tier priority high→low.
 */
export function compareMovable(a: ScheduleBlock, b: ScheduleBlock, dayKey: string): number {
  const tier = (x: ScheduleBlock) => {
    const habitOffset = x.kind === "habit" ? 10 : 0;
    if (x.kind === "task" && x.dueDate) {
      if (x.dueDate < dayKey) return habitOffset + 0;
      if (x.dueDate === dayKey) return habitOffset + 1;
    }
    return habitOffset + 2;
  };
  const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return tier(a) - tier(b) || rank[a.priority ?? "medium"] - rank[b.priority ?? "medium"];
}

/**
 * Repacks the remaining day from `anchor` (minutes). Kept in place: done blocks,
 * blocks already ended, and the in-progress block. Original breaks are dropped
 * and re-inserted by the packer.
 */
export function replanBlocks(blocks: ScheduleBlock[], anchor: number, dayKey: string): ScheduleBlock[] {
  const fixed = blocks.filter(
    b =>
      b.done ||
      b.start + b.dur <= anchor ||
      (b.start <= anchor && b.start + b.dur > anchor && b.kind !== "break"),
  );
  const movable = blocks
    .filter(b => !fixed.includes(b) && b.kind !== "break")
    .sort((a, b) => compareMovable(a, b, dayKey));

  let cursor = roundUpTo(anchor, 15);
  for (const b of fixed) {
    if (!b.done && b.start <= anchor && b.start + b.dur > anchor) {
      cursor = Math.max(cursor, b.start + b.dur);
    }
  }
  return [...fixed, ...packBlocks(movable, cursor)];
}

/** Start slot for a quick-added block: after the last block end + 10, rounded to :15, capped at 5:15 PM. */
export function newBlockStart(blocks: ScheduleBlock[]): number {
  const lastEnd = blocks.length ? Math.max(...blocks.map(b => b.start + b.dur)) : DAY_START + 55;
  return Math.min(roundUpTo(lastEnd + 10, 15), NEW_BLOCK_START_CAP);
}

/* --------------------------------- generation ----------------------------------- */

const TASK_DURATION: Record<TaskPriority, number> = { high: 60, medium: 45, low: 30 };
const MAX_PLAN_TASKS = 6;
const MAX_PLAN_HABITS = 3;

/** True when the habit still needs doing on `dayKey` (daily cadence, or any cadence on a future day). */
function habitOpenOn(habit: Habit, dayKey: string): boolean {
  if (habit.frequency === "hourly") return true;
  return !habit.completedDates.some(d => d.startsWith(dayKey));
}

/**
 * Builds the ordered (unpositioned) block list for a fresh plan from the user's
 * open tasks and habits. The caller packs it with `packBlocks`.
 */
export function buildPlanItems(
  tasks: Task[],
  habits: Habit[],
  dayKey: string,
  options: { excludeTaskIds?: Set<string> } = {},
): ScheduleBlock[] {
  const { excludeTaskIds } = options;
  const horizon = parseDateOnlyLocal(dayKey);
  horizon.setDate(horizon.getDate() + 7);
  const horizonKey = formatDateKeyLocal(horizon);

  const taskBlocks = tasks
    .filter(
      t =>
        !t.completed &&
        !excludeTaskIds?.has(t.id) &&
        t.dueDate !== null &&
        t.dueDate <= horizonKey,
    )
    .map<ScheduleBlock>(t => ({
      id: `task-${t.id}`,
      start: 0,
      dur: TASK_DURATION[t.priority],
      kind: "task",
      title: t.title,
      desc: t.description || undefined,
      done: false,
      priority: t.priority,
      dueDate: t.dueDate,
      sourceId: t.id,
    }))
    .sort((a, b) => compareMovable(a, b, dayKey))
    .slice(0, MAX_PLAN_TASKS);

  const habitBlocks = habits
    .filter(h => habitOpenOn(h, dayKey))
    .sort((a, b) => (a.frequency === "daily" ? 0 : 1) - (b.frequency === "daily" ? 0 : 1))
    .slice(0, MAX_PLAN_HABITS)
    .map<ScheduleBlock>(h => ({
      id: `habit-${h.id}`,
      start: 0,
      dur: 30,
      kind: "habit",
      title: h.title,
      desc: h.description || undefined,
      done: false,
      streak: h.streak,
      sourceId: h.id,
    }));

  const ritual: ScheduleBlock = {
    id: `planning-${dayKey}`,
    start: 0,
    dur: 30,
    kind: "planning",
    title: "Morning planning session",
    done: false,
    priority: "medium",
  };

  return [ritual, ...taskBlocks, ...habitBlocks];
}

/* ------------------------------- AI scheduler map -------------------------------- */

/** Sentinel start for AI items whose `time` is not a clock time. */
const UNPLACED = -1;

export interface AiScheduleItem {
  time: string;
  type: string;
  title: string;
  priority: string;
  duration: string;
  detail?: string | null;
  source_id?: string | null;
  source_type?: "task" | "habit" | "system" | null;
}

function parseTime12(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(value);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function parseDuration(value: string): number {
  const match = /(\d+)\s*(m|min|minute|h|hr|hour)/i.exec(value);
  if (!match) return 30;
  const n = Number(match[1]);
  return /^h/i.test(match[2]) ? n * 60 : n;
}

function isPriority(value: string): value is TaskPriority {
  return PRIORITIES.includes(value as TaskPriority);
}

/**
 * Maps the backend AI scheduler's response into positioned blocks, enriching
 * task/habit items from the workspace. Items carrying real clock times keep
 * them; when some items only have pseudo-times ("Today", "Now", "Sat" — the
 * heuristic fallback), the whole set is placed by the replan engine from
 * `anchor` instead. Returns null when nothing usable comes back.
 */
export function blocksFromAiItems(
  items: AiScheduleItem[],
  tasks: Task[],
  habits: Habit[],
  anchor: number,
  dayKey: string,
): ScheduleBlock[] | null {
  const blocks: ScheduleBlock[] = [];
  items.forEach((item, index) => {
    if (!item.title) return;
    const kind: BlockKind =
      item.type === "task" || item.type === "habit" || item.type === "break"
        ? item.type
        : "planning";
    const task = item.source_type === "task" ? tasks.find(t => t.id === item.source_id) : undefined;
    const habit = item.source_type === "habit" ? habits.find(h => h.id === item.source_id) : undefined;
    blocks.push({
      id: `ai-${index}`,
      start: parseTime12(item.time) ?? UNPLACED,
      dur: parseDuration(item.duration),
      kind: habit ? "habit" : task ? "task" : kind,
      title: item.title,
      // For linked items the workspace description beats the AI's due-date blurb.
      desc: (task ? task.description : habit ? habit.description : item.detail) || undefined,
      done: false,
      priority: task?.priority ?? (isPriority(item.priority) ? item.priority : undefined),
      dueDate: task?.dueDate,
      streak: habit?.streak,
      sourceId: task?.id ?? habit?.id ?? null,
    });
  });
  if (blocks.length === 0) return null;
  if (blocks.every(b => b.start !== UNPLACED)) {
    return blocks.sort((a, b) => a.start - b.start);
  }
  // `anchor + 1` keeps unplaced items strictly movable (not ended/in-progress).
  return replanBlocks(
    blocks.map(b => (b.start === UNPLACED ? { ...b, start: anchor + 1 } : b)),
    anchor,
    dayKey,
  );
}

/* ---------------------------------- derivations ---------------------------------- */

/** Agenda groups: Morning (<12 PM), Afternoon (12–5 PM), Evening (≥5 PM); empty groups omitted, breaks excluded. */
export function agendaGroups(blocks: ScheduleBlock[]): Array<{ name: string; rows: ScheduleBlock[] }> {
  const sorted = [...blocks].filter(b => b.kind !== "break").sort((a, b) => a.start - b.start);
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

/** Today-rail stats: planned = non-break sum, focus = task blocks ≥ 60m, done = x/y non-break. */
export function computePlanStats(blocks: ScheduleBlock[]): PlanStats {
  const real = blocks.filter(b => b.kind !== "break");
  return {
    plannedMin: real.reduce((acc, b) => acc + b.dur, 0),
    focusMin: real
      .filter(b => b.kind === "task" && b.dur >= 60)
      .reduce((acc, b) => acc + b.dur, 0),
    doneCount: real.filter(b => b.done).length,
    totalCount: real.length,
  };
}

/** True when the block is running right now (today only, non-break, undone). */
export function isInProgress(block: ScheduleBlock, nowMin: number, isToday: boolean): boolean {
  return (
    isToday &&
    block.kind !== "break" &&
    !block.done &&
    nowMin >= block.start &&
    nowMin < block.start + block.dur
  );
}

/** Minutes from midnight for a Date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Minutes from a "HH:MM" clock string. */
export function clockToMinutes(value: string): number {
  const { hours, minutes } = parseClockTime(value);
  return hours * 60 + minutes;
}
