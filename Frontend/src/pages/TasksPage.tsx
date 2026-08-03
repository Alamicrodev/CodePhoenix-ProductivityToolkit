import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useData, Task } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Segmented } from "../components/ui/segmented";
import { Plus, ChevronDown, ChevronRight, Calendar, List, Grid2X2, Search, Sparkles } from "lucide-react";
import { TaskModal, TaskModalSeed } from "../components/TaskModal";
import { TaskRow } from "../components/tasks/TaskRow";
import { QuickAdd, QuickAddHandle } from "../components/tasks/QuickAdd";
import { TaskCommandPalette } from "../components/tasks/TaskCommandPalette";
import { useClaimPalette, usePalette } from "../context/PaletteContext";
import { Kbd } from "../components/tasks/Kbd";
import { EisenhowerMatrix } from "../components/EisenhowerMatrix";
import { autoCategorizeTasks } from "../lib/autoCategorize";
import { usePersistentState } from "../hooks/usePersistentState";
import { CMD_LABEL } from "../lib/platform";
import { ParsedQuickAdd } from "../lib/quickAdd";
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

const isSortBy = (v: unknown): v is SortBy => v === "dueDate" || v === "priority";
const isViewMode = (v: unknown): v is ViewMode => v === "list" || v === "matrix";
const isFilterPriority = (v: unknown): v is FilterPriority =>
  v === "all" || v === "low" || v === "medium" || v === "high";
const isFilterDueDate = (v: unknown): v is FilterDueDate =>
  ["all", "overdue", "today", "tomorrow", "thisWeek", "later", "noDate"].includes(v as string);
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

export default function TasksPage() {
  const { tasks, updateTask } = useData();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [modalSeed, setModalSeed] = useState<TaskModalSeed | undefined>();
  const [sortBy, setSortBy] = usePersistentState<SortBy>("tasks.sortBy", "dueDate", isSortBy);
  const [filterPriority, setFilterPriority] = usePersistentState<FilterPriority>(
    "tasks.filterPriority",
    "all",
    isFilterPriority,
  );
  const [filterDueDate, setFilterDueDate] = usePersistentState<FilterDueDate>(
    "tasks.filterDueDate",
    "all",
    isFilterDueDate,
  );
  const [showCompleted, setShowCompleted] = usePersistentState(
    "tasks.showCompleted",
    false,
    isBoolean,
  );
  const [viewMode, setViewMode] = usePersistentState<ViewMode>("tasks.viewMode", "list", isViewMode);
  const [filterTag, setFilterTag] = usePersistentState<string>(
    "tasks.filterTag",
    "all",
    (v): v is string => typeof v === "string",
  );
  // The shell owns ⌘K, but Tasks renders its own palette because that one
  // also searches tasks — so it claims the slot and reuses the shared state.
  const { open: isPaletteOpen, setOpen: setIsPaletteOpen } = usePalette();
  useClaimPalette();
  const quickAddRef = useRef<QuickAddHandle>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(task => task.tags.forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [tasks]);

  // A persisted tag filter can outlive the last task carrying that tag.
  const activeFilterTag = filterTag !== "all" && allTags.includes(filterTag) ? filterTag : "all";

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
      // Tags live on the parent only; a tag mismatch excludes the whole task.
      if (activeFilterTag !== "all" && !task.tags.includes(activeFilterTag)) {
        return;
      }

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
  }, [activeTasks, filterPriority, filterDueDate, activeFilterTag]);

  // Sort the filtered tasks
  const sortedTasks = useMemo(() => {
    const compare = sortBy === "dueDate" ? compareByDueDate : compareByPriority;
    return [...getFilteredTasksWithContext].sort((a, b) => compare(a.task, b.task));
  }, [getFilteredTasksWithContext, sortBy]);

  const hasActiveFilters =
    filterPriority !== "all" || filterDueDate !== "all" || activeFilterTag !== "all";

  const emptyStateMessage = useMemo(() => {
    if (!hasActiveFilters) {
      return "Create your first task to get started";
    }
    const parts: string[] = [];
    if (filterPriority !== "all") parts.push(`${filterPriority} priority`);
    const noun = parts.length > 0 ? `${parts.join(" ")} tasks` : "tasks";
    const qualifiers: string[] = [];
    if (activeFilterTag !== "all") qualifiers.push(`tagged #${activeFilterTag}`);
    if (filterDueDate !== "all") qualifiers.push(DUE_DATE_FILTER_LABELS[filterDueDate]);
    if (qualifiers.length === 0) {
      return `No tasks match the ${filterPriority} priority filter`;
    }
    return `No ${noun} ${qualifiers.join(" ")}`;
  }, [activeFilterTag, filterDueDate, filterPriority, hasActiveFilters]);

  const clearFilters = () => {
    setFilterPriority("all");
    setFilterDueDate("all");
    setFilterTag("all");
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(undefined);
    setModalSeed(undefined);
  };

  /** ⌘↵ in quick-add: open the full editor pre-filled from the parsed draft. */
  const handleOpenFullEditor = (parsed: ParsedQuickAdd) => {
    setModalSeed({
      title: parsed.title,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      tags: parsed.tags,
    });
    setIsModalOpen(true);
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
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 sm:h-[46px] sm:px-4 sm:py-0">
          <h1 className="text-[13px] font-semibold">Tasks</h1>
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
          <Segmented<"list" | "matrix">
            ariaLabel="Tasks view"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "list", label: "List", icon: <List className="h-3.5 w-3.5" /> },
              { value: "matrix", label: "Matrix", icon: <Grid2X2 className="h-3.5 w-3.5" /> },
            ]}
          />
          {/* C focuses the quick-add; the modal is the ⌘↵ escalation from it. */}
          <Button onClick={() => quickAddRef.current?.focus()} kbd="C">
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 sm:px-4">
            <div className="flex items-center gap-1">
              {PRIORITY_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={filterPriority === chip.value}
                  onClick={() => setFilterPriority(chip.value)}
                  /* Filter pill: radius 20, padding 2px 9px, 11.5px, solid
                     accent border when active, count at 55% opacity. */
                  className={`rounded-full border px-[9px] py-0.5 text-[11.5px] ${
                    filterPriority === chip.value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chip.label}
                  <span className="ml-1 opacity-[0.55]">{priorityCounts[chip.value]}</span>
                </button>
              ))}
            </div>
            <span className="flex-1" />
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-tertiary">Tag:</span>
                <Select value={activeFilterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>
                        #{tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
          <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4 sm:px-4">
            <QuickAdd ref={quickAddRef} onOpenFull={handleOpenFullEditor} />

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
              /* "Empty states are one line — a single muted sentence with the
                 relevant shortcut. No illustrations, no onboarding cards." The
                 quick-add is already on screen above, so there is nothing to
                 add a second primary for. */
              <p className="px-2 py-6 text-xs text-tertiary">
                {hasActiveFilters ? (
                  <>
                    {emptyStateMessage}{" "}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Clear filters
                    </button>
                    .
                  </>
                ) : (
                  <>Press C to add your first task.</>
                )}
              </p>
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
          <div className="flex-1 px-4 pb-10 pt-4 sm:px-4">
            <EisenhowerMatrix
              activeTasks={activeTasks.filter(
                task =>
                  matchesPriorityFilter(task, filterPriority) &&
                  matchesDueDateFilter(task.dueDate, filterDueDate) &&
                  (activeFilterTag === "all" || task.tags.includes(activeFilterTag)),
              )}
              onTaskEdit={handleEdit}
            />
          </div>
        )}

        {/* Shortcut footer */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary sm:px-4">
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
          <span className="hidden items-center gap-1.5 md:flex">
            <Kbd>#tag</Kbd> label while typing
          </span>
        </div>

        {/* Command palette */}
        <TaskCommandPalette
          open={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
          tasks={tasks}
          viewMode={viewMode}
          allTags={allTags}
          onQuickAdd={focusQuickAdd}
          onNewDetailedTask={() => setIsModalOpen(true)}
          onSwitchView={setViewMode}
          onAutoCategorize={() => void handleAutoCategorize()}
          onEditTask={handleEdit}
          onFilterTag={setFilterTag}
          onStartFocus={task =>
            navigate("/focus", { state: { preselectedTaskIds: [task.id] } })
          }
        />

        {/* Task Modal */}
        <TaskModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          task={editingTask}
          seed={modalSeed}
        />
      </div>
    </DashboardLayout>
  );
}
