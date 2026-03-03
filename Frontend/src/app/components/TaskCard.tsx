import { Task } from "../contexts/DataContext";
import { useData } from "../contexts/DataContext";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Calendar, MoreVertical, AlertCircle } from "lucide-react";

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  isMuted: boolean;
  matchedSubtasks: string[];
  sortBy?: "dueDate" | "priority";
}

export function TaskCard({ task, onEdit, isMuted, matchedSubtasks, sortBy = "dueDate" }: TaskCardProps) {
  const { updateTask } = useData();

  const handleToggle = () => {
    const newCompleted = !task.completed;
    updateTask(task.id, { 
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : null
    });
  };

  const handleSubtaskToggle = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900";
      case "low":
        return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700";
      default:
        return "";
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  const getDueDateColor = (dueDate: string | null) => {
    if (!dueDate) return "";
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900";
    } else if (diffDays === 0) {
      return "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900";
    } else if (diffDays <= 2) {
      return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900";
    } else {
      return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    // Convert 24h format to 12h format
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatCompletionTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Format the time
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Relative time display
    if (diffMins < 1) return `Completed just now`;
    if (diffMins < 60) return `Completed ${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `Completed ${diffHours} hour${diffHours !== 1 ? "s" : ""} ago at ${timeStr}`;
    if (diffDays === 1) return `Completed yesterday at ${timeStr}`;
    
    // For older completions, show full date
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return `Completed on ${dateStr} at ${timeStr}`;
  };

  // Sort subtasks by due date, then time, then priority
  const sortSubtasks = (subtasks: typeof task.subtasks) => {
    return [...subtasks].sort((a, b) => {
      // Primary sort: Due Date (subtasks without due dates go to the end)
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // Secondary sort: Due Time (if dates are equal)
      if (a.dueDate && b.dueDate && a.dueDate === b.dueDate) {
        // Convert times to comparable numbers (HH:MM to minutes since midnight)
        const getMinutes = (time: string | null) => {
          if (!time) return Infinity; // Subtasks without time go to the end
          const [hours, minutes] = time.split(":").map(Number);
          return hours * 60 + minutes;
        };
        
        const timeA = getMinutes(a.dueTime);
        const timeB = getMinutes(b.dueTime);
        
        if (timeA !== timeB) {
          return timeA - timeB;
        }
      }
      
      // Tertiary sort: Priority (if dates and times are equal or both missing)
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  // Sort subtasks by priority, then date, then time
  const sortSubtasksByPriority = (subtasks: typeof task.subtasks) => {
    return [...subtasks].sort((a, b) => {
      // Primary sort: Priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // Secondary sort: Due Date (if priorities are equal)
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // Tertiary sort: Due Time (if dates are also equal)
      if (a.dueDate && b.dueDate && a.dueDate === b.dueDate) {
        const getMinutes = (time: string | null) => {
          if (!time) return Infinity;
          const [hours, minutes] = time.split(":").map(Number);
          return hours * 60 + minutes;
        };
        
        const timeA = getMinutes(a.dueTime);
        const timeB = getMinutes(b.dueTime);
        
        return timeA - timeB;
      }
      
      return 0;
    });
  };

  // Get all subtasks (sorted), but we'll apply different styling based on whether they match
  const allSortedSubtasks = sortBy === "dueDate"
    ? sortSubtasks(task.subtasks)
    : sortSubtasksByPriority(task.subtasks);

  return (
    <div
      className={`bg-card border border-border rounded-xl transition-all ${
        isMuted ? "opacity-50" : "hover:shadow-md"
      }`}
    >
      {/* Parent Task */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={task.completed}
            onCheckedChange={handleToggle}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3
                className={`font-semibold ${
                  task.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mt-1 flex-shrink-0"
                onClick={onEdit}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(
                  task.priority
                )}`}
              >
                {task.priority}
              </span>
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${getDueDateColor(
                    task.dueDate
                  )}`}
                >
                  <Calendar className="w-3 h-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                  {task.dueTime && (
                    <span className="font-medium">· {formatTime(task.dueTime)}</span>
                  )}
                  {isOverdue(task.dueDate) && (
                    <AlertCircle className="w-3 h-3" />
                  )}
                </span>
              )}
              {task.completedAt && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(
                    task.priority
                  )}`}
                >
                  {formatCompletionTimestamp(task.completedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {allSortedSubtasks.length > 0 && (
        <div className="border-t border-border">
          {allSortedSubtasks.map(subtask => {
            // Check if this subtask matches the filter
            // If matchedSubtasks is empty, parent matched so we show all subtasks normally
            // If matchedSubtasks has IDs, only those should show with normal opacity
            const isSubtaskMatched = matchedSubtasks.length === 0 || matchedSubtasks.includes(subtask.id);
            const shouldGreyOut = matchedSubtasks.length > 0 && !matchedSubtasks.includes(subtask.id);
            
            return (
              <div
                key={subtask.id}
                className={`pl-[4.25rem] pr-5 py-3 border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors ${
                  shouldGreyOut ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={subtask.completed}
                    onCheckedChange={() => handleSubtaskToggle(subtask.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        subtask.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {subtask.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
                          subtask.priority
                        )}`}
                      >
                        {subtask.priority}
                      </span>
                      {subtask.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${getDueDateColor(
                            subtask.dueDate
                          )}`}
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(subtask.dueDate).toLocaleDateString()}
                          {subtask.dueTime && (
                            <span className="font-medium">· {formatTime(subtask.dueTime)}</span>
                          )}
                          {isOverdue(subtask.dueDate) && (
                            <AlertCircle className="w-2.5 h-2.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}