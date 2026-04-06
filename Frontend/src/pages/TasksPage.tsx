import { useState, useMemo } from "react";
import { useData, Task } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Plus, ChevronDown, ChevronUp, Calendar, List, Grid2X2 } from "lucide-react";
import { TaskModal } from "../components/TaskModal";
import { TaskCard } from "../components/TaskCard";
import { EisenhowerMatrix } from "../components/EisenhowerMatrix";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

type SortBy = "dueDate" | "priority";
type FilterPriority = "all" | "low" | "medium" | "high";
type FilterDueDate = "all" | "overdue" | "today" | "tomorrow" | "thisWeek" | "later";
type ViewMode = "list" | "matrix";

export default function TasksPage() {
  const { tasks } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Separate active and completed tasks
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  // Helper to check if task/subtask matches priority filter
  const matchesPriorityFilter = (item: Task | Task["subtasks"][0], priority: FilterPriority) => {
    return priority === "all" || item.priority === priority;
  };

  // Helper to check if task matches due date filter
  const matchesDueDateFilter = (dueDate: string | null, dueDateFilter: FilterDueDate): boolean => {
    if (dueDateFilter === "all") return true;
    if (!dueDate) return dueDateFilter === "later";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDueDate = new Date(dueDate);
    taskDueDate.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

    switch (dueDateFilter) {
      case "overdue":
        return taskDueDate < today;
      case "today":
        return taskDueDate.getTime() === today.getTime();
      case "tomorrow":
        return taskDueDate.getTime() === tomorrow.getTime();
      case "thisWeek":
        return taskDueDate >= today && taskDueDate <= endOfWeek;
      case "later":
        return !dueDate || taskDueDate > endOfWeek;
      default:
        return true;
    }
  };

  // Helper to get filtered results with parent context
  const getFilteredTasksWithContext = useMemo(() => {
    const results: Array<{
      task: Task;
      matchedSubtasks: string[]; // IDs of subtasks that match filters
      parentMatches: boolean; // Does the parent task match?
    }> = [];

    activeTasks.forEach(task => {
      // Check if task matches both priority and due date filters
      const parentMatchesPriority = matchesPriorityFilter(task, filterPriority);
      const parentMatchesDueDate = matchesDueDateFilter(task.dueDate, filterDueDate);
      const parentMatches = parentMatchesPriority && parentMatchesDueDate;

      // Check which subtasks match BOTH priority AND due date filters
      const matchedSubtasks = task.subtasks
        .filter(subtask => 
          matchesPriorityFilter(subtask, filterPriority) && 
          matchesDueDateFilter(subtask.dueDate, filterDueDate)
        )
        .map(st => st.id);

      // Include task if parent matches OR any subtask matches
      if (parentMatches || matchedSubtasks.length > 0) {
        results.push({
          task,
          matchedSubtasks,
          parentMatches,
        });
      }
    });

    return results;
  }, [activeTasks, filterPriority, filterDueDate]);

  // Sort the filtered tasks
  const sortedTasks = useMemo(() => {
    return [...getFilteredTasksWithContext].sort((a, b) => {
      if (sortBy === "dueDate") {
        // Primary sort: Due Date (tasks without due dates go to the end)
        const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity;
        const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity;
        
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        
        // Secondary sort: Due Time (if dates are equal)
        if (a.task.dueDate && b.task.dueDate && a.task.dueDate === b.task.dueDate) {
          // Convert times to comparable numbers (HH:MM to minutes since midnight)
          const getMinutes = (time: string | null) => {
            if (!time) return Infinity; // Tasks without time go to the end
            const [hours, minutes] = time.split(":").map(Number);
            return hours * 60 + minutes;
          };
          
          const timeA = getMinutes(a.task.dueTime);
          const timeB = getMinutes(b.task.dueTime);
          
          if (timeA !== timeB) {
            return timeA - timeB;
          }
        }
        
        // Tertiary sort: Priority (if dates and times are equal or both missing)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
      } else if (sortBy === "priority") {
        // Primary sort: Priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // Secondary sort: Due Date (if priorities are equal)
        const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity;
        const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity;
        
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        
        // Tertiary sort: Due Time (if dates are also equal)
        if (a.task.dueDate && b.task.dueDate && a.task.dueDate === b.task.dueDate) {
          const getMinutes = (time: string | null) => {
            if (!time) return Infinity;
            const [hours, minutes] = time.split(":").map(Number);
            return hours * 60 + minutes;
          };
          
          const timeA = getMinutes(a.task.dueTime);
          const timeB = getMinutes(b.task.dueTime);
          
          return timeA - timeB;
        }
        
        return 0;
      }
      return 0;
    });
  }, [getFilteredTasksWithContext, sortBy]);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Tasks</h1>
            <p className="text-muted-foreground">
              {activeTasks.length} active task{activeTasks.length !== 1 ? "s" : ""}
              {completedTasks.length > 0 && ` · ${completedTasks.length} completed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              List View
            </Button>
            <Button
              variant={viewMode === "matrix" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("matrix")}
              className="gap-2"
            >
              <Grid2X2 className="w-4 h-4" />
              Matrix View
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          </div>
        </div>

        {/* Filters and Sorting - Only show in list view */}
        {viewMode === "list" && (
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
              <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Due Date:</span>
              <Select value={filterDueDate} onValueChange={(v: FilterDueDate) => setFilterDueDate(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="later">Later</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Priority:</span>
              <div className="flex gap-1">
                {(["all", "high", "medium", "low"] as FilterPriority[]).map(priority => (
                  <Button
                    key={priority}
                    variant={filterPriority === priority ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterPriority(priority)}
                    className="capitalize"
                  >
                    {priority}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Tasks */}
        <div className="space-y-3 mb-8">
          {viewMode === "list" ? (
            sortedTasks.length > 0 ? (
              sortedTasks.map(({ task, matchedSubtasks, parentMatches }) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => handleEdit(task)}
                  isMuted={!parentMatches && matchedSubtasks.length > 0}
                  matchedSubtasks={matchedSubtasks}
                  sortBy={sortBy}
                />
              ))
            ) : (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No active tasks found</h3>
                <p className="text-muted-foreground mb-6">
                  {filterPriority !== "all"
                    ? `No tasks match the ${filterPriority} priority filter`
                    : "Create your first task to get started"}
                </p>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Task
                </Button>
              </div>
            )
          ) : (
            <EisenhowerMatrix activeTasks={activeTasks} onTaskEdit={handleEdit} />
          )}
        </div>

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <div className="border-t border-border pt-6">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 w-full text-left mb-4 hover:opacity-70 transition-opacity"
            >
              {showCompleted ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
              <h2 className="text-lg font-semibold text-muted-foreground">
                Completed Tasks ({completedTasks.length})
              </h2>
            </button>

            {showCompleted && (
              <div className="space-y-3">
                {completedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => handleEdit(task)}
                    isMuted={false}
                    matchedSubtasks={[]}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Task Modal */}
        <TaskModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          task={editingTask}
        />
      </div>
    </DashboardLayout>
  );
}

