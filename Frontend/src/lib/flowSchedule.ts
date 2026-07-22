import { Habit, Task } from "../context/DataContext";
import { hasCompletionInRange, isActiveDay } from "./habitSchedule";
import { formatClock24 } from "./flowFormat";

export type AgendaTag = "Planning" | "Focus block" | "Habit" | "Review";

export interface AgendaItem {
  id: string;
  startMinutes: number;
  endMinutes: number;
  /** "09:00–09:30" mono label. */
  time: string;
  title: string;
  meta: string;
  tag: AgendaTag;
  /** CSS var for the color bar + tag text. */
  colorVar: string;
  /** Struck + dimmed in the agenda. */
  done: boolean;
}

const TAG_COLOR: Record<AgendaTag, string> = {
  Planning: "--f-accent",
  Review: "--f-accent",
  "Focus block": "--f-hi",
  Habit: "--f-done",
};

export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function endOfDay(now: Date): Date {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isHabitCheckedToday(habit: Habit, now = new Date()): boolean {
  return hasCompletionInRange(habit, startOfDay(now), endOfDay(now));
}

export function habitsForToday(habits: Habit[], now = new Date()): Habit[] {
  return habits.filter(habit => isActiveDay(habit, now));
}

/**
 * Deterministic day plan derived from real tasks and habits — the same
 * heuristic the old "AI Smart Schedule" used, expressed as dense agenda rows:
 * planning at 9, high-priority focus blocks from 10, habits over lunch,
 * medium/low work in the afternoon, review at 5.
 */
export function buildDayAgenda(tasks: Task[], habits: Habit[], now = new Date()): AgendaItem[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const items: AgendaItem[] = [];

  const push = (
    id: string,
    startMinutes: number,
    durationMinutes: number,
    title: string,
    meta: string,
    tag: AgendaTag,
    doneOverride?: boolean,
  ) => {
    const endMinutes = startMinutes + durationMinutes;
    items.push({
      id,
      startMinutes,
      endMinutes,
      time: `${formatClock24(startMinutes)}–${formatClock24(endMinutes)}`,
      title,
      meta,
      tag,
      colorVar: TAG_COLOR[tag],
      done: doneOverride ?? endMinutes <= nowMinutes,
    });
  };

  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const dueSoon = tasks
    .filter(task => !task.completed && task.dueDate && new Date(task.dueDate) <= weekAhead)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  push("planning-morning", 9 * 60, 30, "Morning planning session", "", "Planning");

  dueSoon
    .filter(task => task.priority === "high")
    .slice(0, 2)
    .forEach((task, index) => {
      push(task.id, (10 + index) * 60, 60, task.title, index === 0 ? "peak hours" : "auto-scheduled", "Focus block");
    });

  habitsForToday(habits, now)
    .slice(0, 2)
    .forEach((habit, index) => {
      const checked = isHabitCheckedToday(habit, now);
      push(habit.id, (12 + index) * 60, 30, habit.title, checked ? "" : "available now", "Habit", checked);
    });

  dueSoon
    .filter(task => task.priority === "medium")
    .slice(0, 2)
    .forEach((task, index) => {
      push(task.id, (14 + index) * 60, 45, task.title, "auto-scheduled", "Focus block");
    });

  dueSoon
    .filter(task => task.priority === "low")
    .slice(0, 1)
    .forEach(task => {
      push(task.id, 16 * 60, 30, task.title, "auto-scheduled", "Focus block");
    });

  if (dueSoon.length > 0) {
    push("review-evening", 17 * 60, 30, "Review and planning", "", "Review");
  }

  return items.sort((a, b) => a.startMinutes - b.startMinutes);
}

/** First agenda item that has not started yet — the Dashboard "Up next" row. */
export function upNextItem(items: AgendaItem[], now = new Date()): AgendaItem | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return items.find(item => !item.done && item.startMinutes >= nowMinutes) ?? items.find(item => !item.done) ?? null;
}
