import { useEffect, useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Task, useData } from "../../context/DataContext";
import {
  compareByDueDate,
  compareByPriority,
  formatDueLabel,
  isOverdue,
} from "../../lib/taskDates";
import { formatClockTime12 } from "../../lib/timeFormat";
import { CircleCheckbox } from "./CircleCheckbox";
import { PriorityBars } from "./PriorityBars";
import { QuadrantTag } from "./QuadrantTag";

interface TaskRowProps {
  task: Task;
  onEdit: () => void;
  isMuted: boolean;
  matchedSubtasks: string[];
  sortBy?: "dueDate" | "priority";
}

function DueLabel({
  dueDate,
  dueTime,
  size = "md",
}: {
  dueDate: string | null;
  dueTime: string | null;
  size?: "sm" | "md";
}) {
  if (!dueDate) {
    return <span className={`w-[76px] shrink-0 ${size === "md" ? "" : "w-[68px]"}`} />;
  }
  const urgent = isOverdue(dueDate) || formatDueLabel(dueDate) === "Today";

  return (
    <span
      className={`shrink-0 text-right text-xs whitespace-nowrap ${
        size === "md" ? "w-[76px]" : "w-[68px]"
      } ${urgent ? "text-priority-high font-medium" : "text-tertiary"}`}
      title={dueTime ? `Due ${formatDueLabel(dueDate)} at ${formatClockTime12(dueTime)}` : undefined}
    >
      {formatDueLabel(dueDate)}
      {dueTime ? ` · ${formatClockTime12(dueTime)}` : ""}
    </span>
  );
}

function formatCompletedShort(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${timeStr}`;
}

export function TaskRow({ task, onEdit, isMuted, matchedSubtasks, sortBy = "dueDate" }: TaskRowProps) {
  const { updateTask } = useData();
  const [expanded, setExpanded] = useState(false);

  // When only subtasks match the active filters, open the row so the matches show.
  useEffect(() => {
    if (isMuted && matchedSubtasks.length > 0) {
      setExpanded(true);
    }
  }, [isMuted, matchedSubtasks.length]);

  const handleToggle = async () => {
    const newCompleted = !task.completed;
    const ok = await updateTask(task.id, {
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : null,
    });
    if (ok && newCompleted) {
      toast.success("Task completed", {
        action: {
          label: "Undo",
          onClick: () => {
            void updateTask(task.id, { completed: false, completedAt: null });
          },
        },
      });
    }
  };

  const handleSubtaskToggle = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st,
    );
    void updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const sortedSubtasks = [...task.subtasks].sort(
    sortBy === "dueDate" ? compareByDueDate : compareByPriority,
  );
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;

  return (
    <div className={isMuted ? "opacity-60" : ""}>
      <div
        className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors cursor-pointer ${
          task.completed ? "opacity-60 hover:opacity-90" : ""
        }`}
        onClick={onEdit}
      >
        <CircleCheckbox
          checked={task.completed}
          onToggle={handleToggle}
          label={task.completed ? `Reopen task: ${task.title}` : `Complete task: ${task.title}`}
        />
        <PriorityBars priority={task.priority} />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span
            className={`truncate text-sm font-medium ${
              task.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </span>
          {task.description && (
            <span className="hidden truncate text-xs text-tertiary sm:inline">
              {task.description}
            </span>
          )}
        </span>
        {task.subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`Toggle subtasks for ${task.title}`}
            onClick={event => {
              event.stopPropagation();
              setExpanded(current => !current);
            }}
            className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs text-tertiary hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {completedSubtasks}/{task.subtasks.length}
          </button>
        )}
        <QuadrantTag quadrant={task.quadrant} />
        {task.completed && task.completedAt ? (
          <span className="shrink-0 whitespace-nowrap text-right text-xs text-tertiary">
            {formatCompletedShort(task.completedAt)}
          </span>
        ) : (
          <DueLabel dueDate={task.dueDate} dueTime={task.dueTime} />
        )}
        <button
          type="button"
          aria-label={`Edit task: ${task.title}`}
          onClick={event => {
            event.stopPropagation();
            onEdit();
          }}
          className="shrink-0 rounded p-1 text-tertiary opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && sortedSubtasks.length > 0 && (
        <div className="mb-1">
          {sortedSubtasks.map(subtask => {
            const greyedOut =
              matchedSubtasks.length > 0 && !matchedSubtasks.includes(subtask.id);
            return (
              <div
                key={subtask.id}
                className={`flex items-center gap-2.5 rounded-md py-1 pl-[34px] pr-2 hover:bg-accent/50 transition-colors ${
                  greyedOut ? "opacity-40" : ""
                } ${isMuted && matchedSubtasks.includes(subtask.id) ? "opacity-100" : ""}`}
              >
                <CircleCheckbox
                  checked={subtask.completed}
                  onToggle={() => handleSubtaskToggle(subtask.id)}
                  label={
                    subtask.completed
                      ? `Reopen subtask: ${subtask.title}`
                      : `Complete subtask: ${subtask.title}`
                  }
                  size="sm"
                />
                <PriorityBars priority={subtask.priority} />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] ${
                    subtask.completed ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {subtask.title}
                </span>
                <DueLabel dueDate={subtask.dueDate} dueTime={subtask.dueTime} size="sm" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
