import { formatDateKeyLocal } from "./timeFormat";
import { TaskPriority } from "./taskDates";

export type TaskQuadrant =
  | "urgent-important"
  | "not-urgent-important"
  | "urgent-not-important"
  | "not-urgent-not-important";

export interface ParsedQuickAdd {
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  quadrant: TaskQuadrant;
  tags: string[];
}

const PRIORITY_TOKEN = /(?:^|\s)!(high|hi|medium|med|low)\b/i;
const DATE_TOKEN = /(?:^|\s)(today|tomorrow)\b/i;
const TAG_TOKEN = /(?:^|\s)#([\w-]+)/g;

const PRIORITY_ALIASES: Record<string, TaskPriority> = {
  high: "high",
  hi: "high",
  medium: "medium",
  med: "medium",
  low: "low",
};

/** Tasks auto-file by priority: high → Do first, medium → Schedule, low → Eliminate. */
export const QUADRANT_BY_PRIORITY: Record<TaskPriority, TaskQuadrant> = {
  high: "urgent-important",
  medium: "not-urgent-important",
  low: "not-urgent-not-important",
};

/**
 * Parse a quick-add draft like `pay rent tomorrow !high` into task fields.
 * Tokens are stripped from the title; the remainder is trimmed and capitalized.
 */
export function parseQuickAdd(input: string, now = new Date()): ParsedQuickAdd {
  let title = input;

  const tags: string[] = [];
  title = title.replace(TAG_TOKEN, (_match, tag: string) => {
    const normalized = tag.toLowerCase();
    if (!tags.includes(normalized)) {
      tags.push(normalized);
    }
    return " ";
  });

  let priority: TaskPriority = "medium";
  const priorityMatch = title.match(PRIORITY_TOKEN);
  if (priorityMatch) {
    priority = PRIORITY_ALIASES[priorityMatch[1].toLowerCase()];
    title = title.replace(PRIORITY_TOKEN, " ");
  }

  let dueDate: string | null = null;
  const dateMatch = title.match(DATE_TOKEN);
  if (dateMatch) {
    const date = new Date(now.getTime());
    if (dateMatch[1].toLowerCase() === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }
    dueDate = formatDateKeyLocal(date);
    title = title.replace(DATE_TOKEN, " ");
  }

  title = title.replace(/\s+/g, " ").trim();
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return { title, priority, dueDate, quadrant: QUADRANT_BY_PRIORITY[priority], tags };
}
