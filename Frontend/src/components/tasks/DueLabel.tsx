import { formatDueLabel, isOverdue } from "../../lib/taskDates";
import { formatClockTime12 } from "../../lib/timeFormat";

interface DueLabelProps {
  dueDate: string | null;
  dueTime: string | null;
  size?: "sm" | "md";
}

/** Right-aligned compact due label; today/overdue rendered in the alert color. */
export function DueLabel({ dueDate, dueTime, size = "md" }: DueLabelProps) {
  const width = size === "md" ? "w-[76px]" : "w-[68px]";
  if (!dueDate) {
    return <span className={`${width} shrink-0`} />;
  }
  const urgent = isOverdue(dueDate) || formatDueLabel(dueDate) === "Today";

  return (
    <span
      className={`shrink-0 text-right text-xs whitespace-nowrap ${width} ${
        urgent ? "text-priority-high font-medium" : "text-tertiary"
      }`}
      title={dueTime ? `Due ${formatDueLabel(dueDate)} at ${formatClockTime12(dueTime)}` : undefined}
    >
      {formatDueLabel(dueDate)}
      {dueTime ? ` · ${formatClockTime12(dueTime)}` : ""}
    </span>
  );
}
