import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Pencil, Timer } from "lucide-react";
import { Task, useData } from "../../context/DataContext";
import { compareByDueDate, compareByPriority } from "../../lib/taskDates";
import { CircleCheckbox } from "./CircleCheckbox";
import { DueLabel } from "./DueLabel";
import { PriorityBars } from "./PriorityBars";
import { QuadrantTag } from "./QuadrantTag";
import { TagChips } from "./TagChips";
import { useCompleteTask } from "./useCompleteTask";
import { useTasksInFocus } from "./useTasksInFocus";

interface TaskRowProps {
  task: Task;
  onEdit: () => void;
  isMuted: boolean;
  matchedSubtasks: string[];
  sortBy?: "dueDate" | "priority";
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
  const toggleComplete = useCompleteTask();
  const tasksInFocus = useTasksInFocus();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isInFocus = !task.completed && tasksInFocus.has(task.id);

  // When only subtasks match the active filters, open the row so the matches show.
  useEffect(() => {
    if (isMuted && matchedSubtasks.length > 0) {
      setExpanded(true);
    }
  }, [isMuted, matchedSubtasks.length]);

  const handleToggle = () => void toggleComplete(task);

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
        className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover transition-colors cursor-pointer ${
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
            className={`truncate text-[13px] font-medium ${
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
        {isInFocus && (
          <span title="In a focus session" className="shrink-0">
            <Timer className="h-3.5 w-3.5 animate-pulse text-primary" />
            <span className="sr-only">In a focus session</span>
          </span>
        )}
        {task.subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`Toggle subtasks for ${task.title}`}
            onClick={event => {
              event.stopPropagation();
              setExpanded(current => !current);
            }}
            className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[11px] text-tertiary hover:bg-hover hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {completedSubtasks}/{task.subtasks.length}
          </button>
        )}
        <QuadrantTag quadrant={task.quadrant} />
        <TagChips tags={task.tags} />
        {task.completed && task.completedAt ? (
          <span className="shrink-0 whitespace-nowrap text-right text-xs text-tertiary">
            {formatCompletedShort(task.completedAt)}
          </span>
        ) : (
          <DueLabel dueDate={task.dueDate} dueTime={task.dueTime} />
        )}
        {!task.completed && !isInFocus && (
          <button
            type="button"
            aria-label={`Start focus session with: ${task.title}`}
            title="Start focus session"
            onClick={event => {
              event.stopPropagation();
              navigate("/focus", { state: { preselectedTaskIds: [task.id] } });
            }}
            className="shrink-0 rounded p-1 text-tertiary opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Timer className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Edit task: ${task.title}`}
          onClick={event => {
            event.stopPropagation();
            onEdit();
          }}
          className="shrink-0 rounded p-1 text-tertiary opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
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
                className={`flex items-center gap-2.5 rounded-md py-1 pl-[34px] pr-2 hover:bg-hover transition-colors ${
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
