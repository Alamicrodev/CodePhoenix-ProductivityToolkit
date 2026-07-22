import { Task } from "../context/DataContext";

export type Quadrant = NonNullable<Task["quadrant"]>;
export type Priority = Task["priority"];

export const QUADRANT_ORDER: Quadrant[] = [
  "urgent-important",
  "not-urgent-important",
  "urgent-not-important",
  "not-urgent-not-important",
];

export const QUADRANT_META: Record<
  Quadrant,
  { name: string; hint: string; colorVar: string }
> = {
  "urgent-important": {
    name: "Do first",
    hint: "Urgent & important",
    colorVar: "--f-qdo",
  },
  "not-urgent-important": {
    name: "Schedule",
    hint: "Not urgent & important",
    colorVar: "--f-qsch",
  },
  "urgent-not-important": {
    name: "Delegate",
    hint: "Urgent & not important",
    colorVar: "--f-qdel",
  },
  "not-urgent-not-important": {
    name: "Eliminate",
    hint: "Not urgent & not important",
    colorVar: "--f-qeli",
  },
};

export const PRIORITY_META: Record<Priority, { label: string; bars: number; colorVar: string }> = {
  high: { label: "High priority", bars: 3, colorVar: "--f-hi" },
  medium: { label: "Medium priority", bars: 2, colorVar: "--f-med" },
  low: { label: "Low priority", bars: 1, colorVar: "--f-low" },
};

// Quick-add auto-assignment: high → Do first, medium → Schedule, low → Eliminate.
export function defaultQuadrantForPriority(priority: Priority): Quadrant {
  if (priority === "high") return "urgent-important";
  if (priority === "low") return "not-urgent-not-important";
  return "not-urgent-important";
}

// Tasks created before the redesign may have no quadrant; bucket them the same
// way quick-add would so every task is visible in the matrix and gets a tag.
export function effectiveQuadrant(task: Pick<Task, "quadrant" | "priority">): Quadrant {
  return task.quadrant ?? defaultQuadrantForPriority(task.priority);
}

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface QuickAddResult {
  title: string;
  priority: Priority;
  dueDate: string | null;
  quadrant: Quadrant;
}

/**
 * Parses the quick-add draft: `!high` / `!med` / `!medium` / `!low` set the
 * priority (default medium), `today` / `tomorrow` set the due date. Tokens are
 * stripped from the title and the title is capitalized.
 */
export function parseQuickAdd(input: string, now = new Date()): QuickAddResult | null {
  let text = input.trim();
  if (!text) return null;

  let priority: Priority = "medium";
  if (/!high\b/i.test(text)) priority = "high";
  else if (/!low\b/i.test(text)) priority = "low";
  text = text.replace(/!(high|med|medium|low)\b/gi, "");

  let dueDate: string | null = null;
  if (/\btoday\b/i.test(text)) {
    dueDate = toLocalISODate(now);
    text = text.replace(/\btoday\b/i, "");
  } else if (/\btomorrow\b/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dueDate = toLocalISODate(tomorrow);
    text = text.replace(/\btomorrow\b/i, "");
  }

  text = text.replace(/\s{2,}/g, " ").trim();
  if (!text) return null;

  const title = text.charAt(0).toUpperCase() + text.slice(1);
  return { title, priority, dueDate, quadrant: defaultQuadrantForPriority(priority) };
}

function parseDueDate(dueDate: string): Date {
  // due_date is an ISO date (YYYY-MM-DD); parse as local, not UTC.
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface DueLabel {
  label: string;
  /** Today or overdue — rendered in --f-hi. */
  urgent: boolean;
}

export function formatDueLabel(dueDate: string | null, now = new Date()): DueLabel | null {
  if (!dueDate) return null;

  const due = parseDueDate(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { label: "Today", urgent: true };
  if (diffDays === 1) return { label: "Tomorrow", urgent: false };

  const label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { label, urgent: diffDays < 0 };
}

/** "Jul 21, 6:20 PM" — completion timestamp on completed rows. */
export function formatDoneAt(completedAt: string | null): string {
  if (!completedAt) return "";
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

/** Determines the quadrant auto-categorize assigns (due within 2 days = urgent, high/medium = important). */
export function autoCategorizeQuadrant(task: Pick<Task, "dueDate" | "priority">, now = new Date()): Quadrant {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isUrgent = (() => {
    if (!task.dueDate) return false;
    const due = parseDueDate(task.dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    return diffDays <= 2;
  })();
  const isImportant = task.priority === "high" || task.priority === "medium";

  if (isUrgent && isImportant) return "urgent-important";
  if (!isUrgent && isImportant) return "not-urgent-important";
  if (isUrgent && !isImportant) return "urgent-not-important";
  return "not-urgent-not-important";
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export type SortBy = "dueDate" | "priority";

export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const byDue = (a: Task, b: Task) => {
    const dateA = a.dueDate ? parseDueDate(a.dueDate).getTime() : Infinity;
    const dateB = b.dueDate ? parseDueDate(b.dueDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;

    const minutes = (time: string | null) => {
      if (!time) return Infinity;
      const [hours, mins] = time.split(":").map(Number);
      return hours * 60 + mins;
    };
    return minutes(a.dueTime) - minutes(b.dueTime);
  };
  const byPriority = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  return [...tasks].sort((a, b) =>
    sortBy === "dueDate" ? byDue(a, b) || byPriority(a, b) : byPriority(a, b) || byDue(a, b),
  );
}

export function userInitials(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
}
