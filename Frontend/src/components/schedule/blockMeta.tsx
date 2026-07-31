import { ScheduleBlock } from "../../lib/schedulePlan";
import { formatDueLabel } from "../../lib/taskDates";
import { parseDateOnlyLocal } from "../../lib/timeFormat";

/** Secondary meta text for a block: due state or habit streak. */
export function blockExtra(
  block: ScheduleBlock,
  todayKey: string,
): { text: string; className: string } | null {
  if (block.kind === "task" && block.dueDate) {
    const now = parseDateOnlyLocal(todayKey);
    if (block.dueDate < todayKey) {
      return { text: `Overdue · ${formatDueLabel(block.dueDate, now)}`, className: "text-priority-high" };
    }
    if (block.dueDate === todayKey) {
      return { text: "Due today", className: "text-priority-high" };
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
