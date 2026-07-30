import { parseClockTime, parseDateOnlyLocal, startOfLocalDay } from "./timeFormat";

export type TaskPriority = "low" | "medium" | "high";

export type FilterDueDate =
  | "all"
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "noDate";

/** Fields shared by tasks and subtasks that due-date sorting operates on. */
export interface DueSortable {
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Whole days between today and the due date; negative when overdue. */
export function daysUntilDue(dueDate: string, now = new Date()): number {
  const due = parseDateOnlyLocal(dueDate);
  const today = startOfLocalDay(now);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

export function isOverdue(dueDate: string | null, now = new Date()): boolean {
  if (!dueDate) {
    return false;
  }
  return daysUntilDue(dueDate, now) < 0;
}

/** Days from today through the end of the calendar week (Sunday); 0 when today is Sunday. */
function daysUntilWeekEnd(now: Date): number {
  return (7 - startOfLocalDay(now).getDay()) % 7;
}

export function matchesDueDateFilter(
  dueDate: string | null,
  filter: FilterDueDate,
  now = new Date(),
): boolean {
  if (filter === "all") {
    return true;
  }
  if (!dueDate) {
    return filter === "noDate";
  }

  const diff = daysUntilDue(dueDate, now);

  switch (filter) {
    case "overdue":
      return diff < 0;
    case "today":
      return diff === 0;
    case "tomorrow":
      return diff === 1;
    case "thisWeek":
      return diff >= 0 && diff <= daysUntilWeekEnd(now);
    case "later":
      return diff > daysUntilWeekEnd(now);
    case "noDate":
      return false;
    default:
      return true;
  }
}

export function formatDueDate(dueDate: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDateOnlyLocal(dueDate);
  return options ? date.toLocaleDateString("en-US", options) : date.toLocaleDateString();
}

function dueTimeMinutes(time: string | null): number {
  if (!time) {
    return Number.POSITIVE_INFINITY;
  }
  const { hours, minutes } = parseClockTime(time);
  return hours * 60 + minutes;
}

/** Sort by due date, then due time, then priority; items without dates/times go last. */
export function compareByDueDate(a: DueSortable, b: DueSortable): number {
  const dateA = a.dueDate ? parseDateOnlyLocal(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const dateB = b.dueDate ? parseDateOnlyLocal(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (dateA !== dateB) {
    return dateA - dateB;
  }

  const timeA = dueTimeMinutes(a.dueTime);
  const timeB = dueTimeMinutes(b.dueTime);
  if (a.dueDate && b.dueDate && timeA !== timeB) {
    return timeA - timeB;
  }

  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

/** Sort by priority, breaking ties by due date and time. */
export function compareByPriority(a: DueSortable, b: DueSortable): number {
  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return compareByDueDate(a, b);
}
