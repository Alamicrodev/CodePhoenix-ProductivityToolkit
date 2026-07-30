import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useData, Task } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Plus, ChevronDown, ChevronRight, Calendar, List, Grid2X2, Search, Sparkles } from "lucide-react";
import { TaskModal } from "../components/TaskModal";
import { TaskRow } from "../components/tasks/TaskRow";
import { QuickAdd, QuickAddHandle } from "../components/tasks/QuickAdd";
import { TaskCommandPalette } from "../components/tasks/TaskCommandPalette";
import { Kbd } from "../components/tasks/Kbd";
import { EisenhowerMatrix } from "../components/EisenhowerMatrix";
import { autoCategorizeTasks } from "../lib/autoCategorize";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  compareByDueDate,
  compareByPriority,
  FilterDueDate,
  matchesDueDateFilter,
} from "../lib/taskDates";

type SortBy = "dueDate" | "priority";
type FilterPriority = "all" | "low" | "medium" | "high";
type ViewMode = "list" | "matrix";

const DUE_DATE_FILTER_LABELS: Record<Exclude<FilterDueDate, "all">, string> = {
  overdue: "overdue",
  today: "due today",
  tomorrow: "due tomorrow",
  thisWeek: "due this week",
  later: "due later",
  noDate: "without a due date",
};

const PRIORITY_CHIPS: Array<{ value: FilterPriority; label: string }> = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const IS_MAC =
  typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const CMD_LABEL = IS_MAC ? "⌘" : "Ctrl";

export default function TasksPage() {
  const { tasks, updateTask } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const quickAddRef = useRef<QuickAddHandle>(null);

  // Separate active and completed tasks; completed sorted newest-first
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const priorityCounts = useMemo(
    () => ({
      all: activeTasks.length,
      high: activeTasks.filter(t => t.priority === "high").length,
      medium: activeTasks.filter(t => t.priority === "medium").length,
      low: activeTasks.filter(t => t.priority === "low").length,
    }),
    [activeTasks],
  );

  // Helper to check if task/subtask matches priority filter
  const matchesPriorityFilter = (item: Task | Task["subtasks"][0], priority: FilterPriority) => {
    return priority === "all" || item.priority === priority;
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
    const compare = sortBy === "dueDate" ? compareByDueDate : compareByPriority;
    return [...getFilteredTasksWithContext].sort((a, b) => compare(a.task, b.task));
  }, [getFilteredTasksWithContext, sortBy]);

  const hasActiveFilters = filterPriority !== "all" || filterDueDate !== "all";

  const emptyStateMessage = useMemo(() => {
    if (!hasActiveFilters) {
      return "Create your first task to get started";
    }
    const dueLabel = filterDueDate !== "all" ? DUE_DATE_FILTER_LABELS[filterDueDate] : "";
    if (filterPriority !== "all" && filterDueDate !== "all") {
      return `No ${filterPriority} priority tasks ${dueLabel}`;
    }
    if (filterPriority !== "all") {
      return `No tasks match the ${filterPriority} priority filter`;
    }
    return `No tasks ${dueLabel}`;
  }, [filterDueDate, filterPriority, hasActiveFilters]);

  const clearFilters = () => {
    setFilterPriority("all");
    setFilterDueDate("all");
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const focusQuickAdd = () => {
    setViewMode("list");
    // Wait a tick in case the list view (and quick-add) has to mount first.
    window.setTimeout(() => quickAddRef.current?.focus(), 0);
  };

  const handleAutoCategorize = async () => {
    const count = await autoCategorizeTasks(tasks, updateTask);
    toast.success(
      count > 0 ? `Categorized ${count} task${count === 1 ? "" : "s"}` : "All tasks already categorized",
    );
  };

  // Global shortcuts: ⌘K palette (works while typing), C quick-add, V view toggle.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsPaletteOpen(open => !open);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (isTyping || isModalOpen || isPaletteOpen) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "c":
          event.preventDefault();
          focusQuickAdd();
          break;
        case "v":
          event.preventDefault();
          setViewMode(mode => (mode === "list" ? "matrix" : "list"));
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, isPaletteOpen]);

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 sm:h-12 sm:px-6 sm:py-0">
          <h1 className="text-sm font-semibold">Tasks</h1>
          <span className="text-xs text-tertiary">
            {activeTasks.length} active · {completedTasks.length} done
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            Search or command
            <Kbd>{CMD_LABEL} K</Kbd>
          </button>
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-tertiary hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
                viewMode === "matrix"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-tertiary hover:text-foreground"
              }`}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              Matrix
            </button>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 sm:px-6">
            <div className="flex items-center gap-1">
              {PRIORITY_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setFilterPriority(chip.value)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    filterPriority === chip.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chip.label}
                  <span className="ml-1 opacity-60">{priorityCounts[chip.value]}</span>
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-tertiary">Due:</span>
              <Select value={filterDueDate} onValueChange={(v: FilterDueDate) => setFilterDueDate(v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="later">Later</SelectItem>
                  <SelectItem value="noDate">No due date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {viewMode === "list" ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-tertiary">Sort:</span>
                <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">Due date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => void handleAutoCategorize()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-categorize
              </Button>
            )}
          </div>

        {/* Content */}
        {viewMode === "list" ? (
          <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4 sm:px-6">
            <QuickAdd ref={quickAddRef} />

            <h2 className="mb-1 mt-5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
              Active · {sortedTasks.length}
            </h2>

            {sortedTasks.length > 0 ? (
              <div>
                {sortedTasks.map(({ task, matchedSubtasks, parentMatches }) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => handleEdit(task)}
                    isMuted={!parentMatches && matchedSubtasks.length > 0}
                    matchedSubtasks={parentMatches ? [] : matchedSubtasks}
                    sortBy={sortBy}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card py-12 text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">No active tasks found</h3>
                <p className="mb-4 text-xs text-muted-foreground">{emptyStateMessage}</p>
                <div className="flex items-center justify-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Create Task
                  </Button>
                </div>
              </div>
            )}

            {/* Completed section */}
            {completedTasks.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  aria-expanded={showCompleted}
                  className="mb-1 flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary transition-colors hover:text-foreground"
                >
                  {showCompleted ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Completed · {completedTasks.length}
                </button>

                {showCompleted && (
                  <div>
                    {completedTasks.map(task => (
                      <TaskRow
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
          </div>
        ) : (
          <div className="flex-1 px-4 pb-10 pt-4 sm:px-6">
            <EisenhowerMatrix
              activeTasks={activeTasks.filter(
                task =>
                  matchesPriorityFilter(task, filterPriority) &&
                  matchesDueDateFilter(task.dueDate, filterDueDate),
              )}
              onTaskEdit={handleEdit}
            />
          </div>
        )}

        {/* Shortcut footer */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary sm:px-6">
          <span className="flex items-center gap-1.5">
            <Kbd>C</Kbd> new task
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>{CMD_LABEL} K</Kbd> commands
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>V</Kbd> switch view
          </span>
          <span className="hidden items-center gap-1.5 md:flex">
            <Kbd>!high · !med · !low</Kbd> priority while typing
          </span>
        </div>

        {/* Command palette */}
        <TaskCommandPalette
          open={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
          tasks={tasks}
          viewMode={viewMode}
          onQuickAdd={focusQuickAdd}
          onNewDetailedTask={() => setIsModalOpen(true)}
          onSwitchView={setViewMode}
          onAutoCategorize={() => void handleAutoCategorize()}
          onEditTask={handleEdit}
        />

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
