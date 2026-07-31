import { ScheduleBlock, UNTIMED } from "../../lib/schedulePlan";
import { formatDueLabel } from "../../lib/taskDates";
import { parseDateOnlyLocal } from "../../lib/timeFormat";

/**
 * Secondary meta text for a block: due state or habit streak. Red is reserved
 * for genuinely late work — a done task is never red, and a task due today
 * only turns red once its due time has passed (untimed tasks have the whole
 * day, so they stay neutral).
 */
export function blockExtra(
  block: ScheduleBlock,
  todayKey: string,
  nowMin: number,
): { text: string; className: string } | null {
  if (block.kind === "task" && block.dueDate) {
    const now = parseDateOnlyLocal(todayKey);
    if (block.dueDate < todayKey) {
      return {
        text: `Overdue · ${formatDueLabel(block.dueDate, now)}`,
        className: block.done ? "text-tertiary" : "text-priority-high",
      };
    }
    if (block.dueDate === todayKey) {
      const missed = !block.done && block.start !== UNTIMED && nowMin >= block.start;
      return { text: "Due today", className: missed ? "text-priority-high" : "text-tertiary" };
    }
    return { text: `Due ${formatDueLabel(block.dueDate, now)}`, className: "text-tertiary" };
  }
  if (block.kind === "habit" && block.streak != null) {
    return { text: `${block.streak}-day streak`, className: "text-done" };
  }
  return null;
}

/** Kind glyph shown before the title: ◎ for habits (tasks show priority bars). */
export function KindGlyph({ kind }: { kind: ScheduleBlock["kind"] }) {
  if (kind === "habit") {
    return <span className="shrink-0 text-[11px] text-done" aria-hidden="true">◎</span>;
  }
  return null;
}
