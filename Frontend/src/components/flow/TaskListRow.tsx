import { Task } from "../../context/DataContext";
import {
  QUADRANT_META,
  effectiveQuadrant,
  formatDueLabel,
  formatDoneAt,
} from "../../lib/flowTasks";
import { PriorityBars } from "./PriorityBars";

interface TaskListRowProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
}

// Dense (~30px) list row: checkbox · priority bars · title/desc · quadrant tag · due date.
export function TaskListRow({ task, onToggle, onEdit }: TaskListRowProps) {
  if (task.completed) {
    return (
      <div className="group flex items-center gap-[10px] rounded-md px-2 py-[6px] opacity-[0.62] hover:bg-[var(--f-hover)] hover:opacity-85">
        <button
          type="button"
          role="checkbox"
          aria-checked="true"
          aria-label={`Reopen "${task.title}"`}
          title="Reopen"
          onClick={() => onToggle(task)}
          className="flex h-[15px] w-[15px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--f-done)] text-[9px] text-white"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1 cursor-default" onClick={() => onEdit(task)}>
          <span className="line-through">{task.title}</span>
        </div>
        <span className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">
          {formatDoneAt(task.completedAt)}
        </span>
      </div>
    );
  }

  const quadrant = QUADRANT_META[effectiveQuadrant(task)];
  const due = formatDueLabel(task.dueDate);

  return (
    <div className="group flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)]">
      <button
        type="button"
        role="checkbox"
        aria-checked="false"
        aria-label={`Mark done "${task.title}"`}
        title="Mark done"
        onClick={() => onToggle(task)}
        className="h-[15px] w-[15px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--f-text3)] hover:border-[var(--f-done)]"
      />
      <PriorityBars priority={task.priority} />
      <div
        className="flex min-w-0 flex-1 cursor-default items-baseline gap-2"
        onClick={() => onEdit(task)}
      >
        <span className="truncate font-medium">{task.title}</span>
        {task.description && (
          <span className="truncate text-[12px] text-[var(--f-text3)]">{task.description}</span>
        )}
      </div>
      <span
        className="whitespace-nowrap rounded border border-[var(--f-border)] px-[6px] py-[1px] text-[11px]"
        style={{ color: `var(${quadrant.colorVar})` }}
      >
        {quadrant.name}
      </span>
      <span
        className="w-[70px] whitespace-nowrap text-right text-[12px]"
        style={{ color: due?.urgent ? "var(--f-hi)" : "var(--f-text3)" }}
      >
        {due?.label ?? ""}
      </span>
    </div>
  );
}
