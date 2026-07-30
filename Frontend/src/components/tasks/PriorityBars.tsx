import { TaskPriority } from "../../lib/taskDates";

const FILLED_COUNT: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };

const FILL_CLASS: Record<TaskPriority, string> = {
  high: "bg-priority-high",
  medium: "bg-priority-medium",
  low: "bg-priority-low",
};

const LABEL: Record<TaskPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

/** Three ascending signal bars; filled count and color encode the priority. */
export function PriorityBars({ priority }: { priority: TaskPriority }) {
  const filled = FILLED_COUNT[priority];

  return (
    <span className="flex items-end gap-[2px] shrink-0" title={LABEL[priority]}>
      {["h-[4px]", "h-[7px]", "h-[11px]"].map((height, index) => (
        <span
          key={height}
          className={`w-[3px] rounded-[1px] ${height} ${
            index < filled ? FILL_CLASS[priority] : "bg-border"
          }`}
        />
      ))}
      <span className="sr-only">{LABEL[priority]}</span>
    </span>
  );
}
