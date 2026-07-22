import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronDown, Grid2X2, List, Sparkles } from "lucide-react";
import { useData, Task } from "../context/DataContext";
import {
  Quadrant,
  SortBy,
  autoCategorizeQuadrant,
  parseQuickAdd,
  sortTasks,
} from "../lib/flowTasks";
import { FlowShell } from "../components/flow/FlowShell";
import { FlowPrimaryButton, FlowSegmented, FlowSectionHeader } from "../components/flow/FlowPrimitives";
import { QuickAdd } from "../components/flow/QuickAdd";
import { TaskListRow } from "../components/flow/TaskListRow";
import { FlowMatrix } from "../components/flow/FlowMatrix";
import { PaletteCommand } from "../components/flow/CommandPalette";
import { KbdChip } from "../components/flow/KbdChip";
import { TaskModal } from "../components/TaskModal";

type ViewMode = "list" | "matrix";
type FilterPriority = "all" | "high" | "medium" | "low";

const VIEW_STORAGE_KEY = "flowmanager.tasks.view";

const FILTER_CHIPS: { key: FilterPriority; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function TasksPage() {
  const { tasks, addTask, updateTask } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "matrix" ? "matrix" : "list";
  });
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const quickAddRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const activeTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);
  const completedTasks = useMemo(
    () =>
      tasks
        .filter(task => task.completed)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [tasks],
  );

  const priorityCounts = useMemo(
    () => ({
      all: activeTasks.length,
      high: activeTasks.filter(task => task.priority === "high").length,
      medium: activeTasks.filter(task => task.priority === "medium").length,
      low: activeTasks.filter(task => task.priority === "low").length,
    }),
    [activeTasks],
  );

  const visibleActiveTasks = useMemo(() => {
    const filtered =
      filter === "all" ? activeTasks : activeTasks.filter(task => task.priority === filter);
    return sortTasks(filtered, sortBy);
  }, [activeTasks, filter, sortBy]);

  const toggleView = useCallback(() => {
    setView(current => (current === "list" ? "matrix" : "list"));
  }, []);

  const focusQuickAdd = useCallback(() => {
    setView("list");
    window.setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

  // Cross-page intents: C elsewhere navigates here with quickAdd; the palette
  // navigates here with editTaskId.
  useEffect(() => {
    const state = location.state as { quickAdd?: boolean; editTaskId?: string } | null;
    if (!state) return;
    if (state.quickAdd) focusQuickAdd();
    if (state.editTaskId) {
      const task = tasks.find(entry => entry.id === state.editTaskId);
      if (task) handleEdit(task);
    }
    if (state.quickAdd || state.editTaskId) {
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, tasks.length]);

  const handleQuickAdd = useCallback(() => {
    const parsed = parseQuickAdd(draft);
    if (!parsed) return;
    setDraft("");
    void addTask({
      title: parsed.title,
      description: "",
      completed: false,
      completedAt: null,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      dueTime: null,
      tags: [],
      subtasks: [],
      quadrant: parsed.quadrant,
    });
  }, [addTask, draft]);

  const handleQuadrantQuickAdd = useCallback(
    (title: string, quadrant: Quadrant) => {
      void addTask({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        description: "",
        completed: false,
        completedAt: null,
        priority: "medium",
        dueDate: null,
        dueTime: null,
        tags: [],
        subtasks: [],
        quadrant,
      });
    },
    [addTask],
  );

  const handleToggleTask = useCallback(
    (task: Task) => {
      void updateTask(task.id, {
        completed: !task.completed,
        completedAt: task.completed ? null : new Date().toISOString(),
      });
    },
    [updateTask],
  );

  const handleDropTask = useCallback(
    (taskId: string, quadrant: Quadrant) => {
      void updateTask(taskId, { quadrant });
    },
    [updateTask],
  );

  const handleAutoCategorize = useCallback(() => {
    activeTasks
      .filter(task => !task.quadrant)
      .forEach(task => {
        void updateTask(task.id, { quadrant: autoCategorizeQuadrant(task) });
      });
  }, [activeTasks, updateTask]);

  const paletteExtras = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "tasks-view-matrix",
        label: "Switch to matrix view",
        kbd: "V",
        icon: Grid2X2,
        run: () => setView("matrix"),
      },
      {
        id: "tasks-view-list",
        label: "Switch to list view",
        kbd: "V",
        icon: List,
        run: () => setView("list"),
      },
      {
        id: "tasks-auto-categorize",
        label: "Auto-categorize tasks",
        icon: Sparkles,
        run: handleAutoCategorize,
      },
    ],
    [handleAutoCategorize],
  );

  const shortcuts = useMemo(
    () => ({ c: focusQuickAdd, v: toggleView }),
    [focusQuickAdd, toggleView],
  );

  return (
    <FlowShell
      title="Tasks"
      meta={`${activeTasks.length} active · ${completedTasks.length} done`}
      shortcuts={shortcuts}
      paletteExtras={paletteExtras}
      onSelectPaletteTask={handleEdit}
      footerHints={[
        { keys: "C", label: "new task" },
        { keys: "⌘K", label: "commands" },
        { keys: "V", label: "switch view" },
        { keys: "T", label: "theme" },
        { keys: "1–3", label: "priority while typing (!high · !med · !low)" },
      ]}
      actions={
        <>
          <FlowSegmented<ViewMode>
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List" },
              { value: "matrix", label: "Matrix" },
            ]}
          />
          <FlowPrimaryButton onClick={focusQuickAdd}>
            <span>New task</span>
            <KbdChip onAccent>C</KbdChip>
          </FlowPrimaryButton>
        </>
      }
      filterBar={
        <div className="flex h-[38px] shrink-0 items-center gap-[6px] border-b border-[var(--f-border2)] px-4">
          {FILTER_CHIPS.map(chip => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className="flex cursor-pointer items-center gap-[5px] rounded-[20px] border px-[9px] py-[2px] text-[11.5px]"
                style={
                  active
                    ? {
                        background: "var(--f-accent-soft)",
                        borderColor: "var(--f-accent)",
                        color: "var(--f-accent)",
                      }
                    : {
                        background: "var(--f-panel)",
                        borderColor: "var(--f-border)",
                        color: "var(--f-text2)",
                      }
                }
              >
                <span>{chip.label}</span>
                <span className="opacity-55">{priorityCounts[chip.key]}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          {view === "matrix" && (
            <button
              type="button"
              onClick={handleAutoCategorize}
              className="hidden cursor-pointer items-center gap-[6px] rounded-md border border-[var(--f-border)] bg-[var(--f-panel)] px-[10px] py-[3px] text-[11.5px] text-[var(--f-text2)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)] sm:flex"
            >
              <Sparkles className="h-3 w-3" />
              Auto-categorize
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen(open => !open)}
              className="flex cursor-pointer items-center gap-[5px] text-[12px] text-[var(--f-text3)] hover:text-[var(--f-text)]"
            >
              Sort: <span className="text-[var(--f-text2)]">{sortBy === "dueDate" ? "Due date" : "Priority"}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-[130px] rounded-lg border border-[var(--f-border)] bg-[var(--f-panel)] p-1 shadow-[var(--f-shadow)]">
                  {(["dueDate", "priority"] as SortBy[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSortBy(option);
                        setSortMenuOpen(false);
                      }}
                      className={`block w-full cursor-pointer rounded-md px-2 py-[5px] text-left text-[12px] hover:bg-[var(--f-hover)] ${
                        sortBy === option ? "text-[var(--f-accent)]" : "text-[var(--f-text2)]"
                      }`}
                    >
                      {option === "dueDate" ? "Due date" : "Priority"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      }
    >
      {view === "list" ? (
        <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
          <QuickAdd ref={quickAddRef} draft={draft} onDraftChange={setDraft} onSubmit={handleQuickAdd} />

          <FlowSectionHeader>Active · {visibleActiveTasks.length}</FlowSectionHeader>
          <div className="flex flex-col">
            {visibleActiveTasks.map(task => (
              <TaskListRow key={task.id} task={task} onToggle={handleToggleTask} onEdit={handleEdit} />
            ))}
            {visibleActiveTasks.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
                {filter === "all"
                  ? "No active tasks — press C to add one."
                  : `No active ${filter}-priority tasks.`}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCompletedOpen(open => !open)}
            className="mt-[18px] flex cursor-pointer items-center gap-[7px] px-1 pb-[6px] pt-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)] hover:text-[var(--f-text2)]"
          >
            <span className="text-[9px]">{completedOpen ? "▼" : "▶"}</span>
            Completed · {completedTasks.length}
          </button>
          {completedOpen && (
            <div className="flex flex-col">
              {completedTasks.map(task => (
                <TaskListRow key={task.id} task={task} onToggle={handleToggleTask} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <FlowMatrix
          activeTasks={activeTasks}
          onDropTask={handleDropTask}
          onToggle={handleToggleTask}
          onEdit={handleEdit}
          onQuickAdd={handleQuadrantQuickAdd}
        />
      )}

      {/* Edit modal (existing feature, reused) */}
      <TaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(undefined);
        }}
        task={editingTask}
      />
    </FlowShell>
  );
}
