import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronDown, Loader2, Menu, Sparkles, X } from "lucide-react";
import { useData, Task } from "../context/DataContext";
import {
  Quadrant,
  SortBy,
  autoCategorizeQuadrant,
  parseQuickAdd,
  sortTasks,
} from "../lib/flowTasks";
import { FlowSidebar } from "../components/flow/FlowSidebar";
import { QuickAdd } from "../components/flow/QuickAdd";
import { TaskListRow } from "../components/flow/TaskListRow";
import { FlowMatrix } from "../components/flow/FlowMatrix";
import { CommandPalette, PaletteCommand } from "../components/flow/CommandPalette";
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
  const { tasks, addTask, updateTask, isSyncing, isWorkspaceLoading, syncStatus } = useData();
  const { resolvedTheme, setTheme } = useTheme();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "matrix" ? "matrix" : "list";
  });
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const quickAddRef = useRef<HTMLInputElement>(null);
  const isEditModalOpenRef = useRef(isEditModalOpen);
  isEditModalOpenRef.current = isEditModalOpen;

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

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const toggleView = useCallback(() => {
    setView(current => (current === "list" ? "matrix" : "list"));
  }, []);

  const focusQuickAdd = useCallback(() => {
    setView("list");
    window.setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  // Global shortcuts: C / V / T (suppressed while typing), ⌘K / Ctrl+K, Esc.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(open => !open);
        return;
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (typing || isEditModalOpenRef.current || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        focusQuickAdd();
      } else if (key === "v") {
        toggleView();
      } else if (key === "t") {
        toggleTheme();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusQuickAdd, toggleTheme, toggleView]);

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

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new-task",
        label: "New task",
        kbd: "C",
        icon: "new",
        run: () => {
          setPaletteOpen(false);
          focusQuickAdd();
        },
      },
      {
        id: "view-matrix",
        label: "Switch to matrix view",
        kbd: "V",
        icon: "matrix",
        run: () => {
          setView("matrix");
          setPaletteOpen(false);
        },
      },
      {
        id: "view-list",
        label: "Switch to list view",
        kbd: "V",
        icon: "list",
        run: () => {
          setView("list");
          setPaletteOpen(false);
        },
      },
      {
        id: "auto-categorize",
        label: "Auto-categorize tasks",
        icon: "auto",
        run: () => {
          handleAutoCategorize();
          setPaletteOpen(false);
        },
      },
      {
        id: "toggle-theme",
        label: "Toggle theme",
        kbd: "T",
        icon: "theme",
        run: () => {
          toggleTheme();
          setPaletteOpen(false);
        },
      },
    ],
    [focusQuickAdd, handleAutoCategorize, toggleTheme],
  );

  const segmentClass = (active: boolean) =>
    `cursor-pointer rounded-[5px] border-none px-3 py-[3px] text-[12px] ${
      active
        ? "bg-[var(--f-panel)] text-[var(--f-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
        : "bg-transparent text-[var(--f-text3)]"
    }`;

  return (
    <div className="flow-shell flex h-screen w-full overflow-hidden">
      {/* Sidebar (desktop) */}
      <div className="hidden md:block">
        <FlowSidebar activeCount={activeTasks.length} onToggleTheme={toggleTheme} />
      </div>

      {/* Sidebar (mobile overlay) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative h-full bg-[var(--f-bg)]" onClick={event => event.stopPropagation()}>
            <FlowSidebar activeCount={activeTasks.length} onToggleTheme={toggleTheme} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1 text-[var(--f-text2)] hover:bg-[var(--f-hover)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-[var(--f-border2)] px-4">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-1 text-[var(--f-text2)] hover:bg-[var(--f-hover)] md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-[13px] font-semibold">Tasks</div>
          <div className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">
            {activeTasks.length} active · {completedTasks.length} done
          </div>
          {(isWorkspaceLoading || isSyncing) && (
            <span className="hidden items-center gap-1 text-[11px] text-[var(--f-text3)] lg:flex">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isWorkspaceLoading ? "Loading…" : syncStatus ?? "Syncing…"}
            </span>
          )}
          <div className="flex-1" />
          <div className="flex gap-[2px] rounded-[7px] border border-[var(--f-border)] bg-[var(--f-panel2)] p-[2px]">
            <button type="button" onClick={() => setView("list")} className={segmentClass(view === "list")}>
              List
            </button>
            <button type="button" onClick={() => setView("matrix")} className={segmentClass(view === "matrix")}>
              Matrix
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden cursor-pointer items-center gap-[7px] rounded-md border border-[var(--f-border)] bg-[var(--f-panel)] px-[10px] py-1 text-[12px] text-[var(--f-text2)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)] sm:flex"
          >
            <span>Search or command</span>
            <KbdChip>⌘K</KbdChip>
          </button>
          <button
            type="button"
            onClick={focusQuickAdd}
            className="flex cursor-pointer items-center gap-[7px] rounded-md border-none bg-[var(--f-accent)] px-[11px] py-[5px] text-[12px] font-medium text-white"
          >
            <span>New task</span>
            <KbdChip onAccent>C</KbdChip>
          </button>
        </div>

        {/* Filter bar */}
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

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {view === "list" ? (
            <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
              <QuickAdd ref={quickAddRef} draft={draft} onDraftChange={setDraft} onSubmit={handleQuickAdd} />

              <div className="px-1 pb-[6px] pt-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)]">
                Active · {visibleActiveTasks.length}
              </div>
              <div className="flex flex-col">
                {visibleActiveTasks.map(task => (
                  <TaskListRow key={task.id} task={task} onToggle={handleToggleTask} onEdit={handleEdit} />
                ))}
                {visibleActiveTasks.length === 0 && (
                  <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
                    {filter === "all"
                      ? "No active tasks — add one above."
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
        </div>

        {/* Shortcut footer */}
        <div className="hidden h-[30px] shrink-0 items-center gap-4 border-t border-[var(--f-border2)] px-4 text-[11px] text-[var(--f-text3)] md:flex">
          <span className="flex items-center gap-[5px]">
            <KbdChip className="py-0">C</KbdChip> new task
          </span>
          <span className="flex items-center gap-[5px]">
            <KbdChip className="py-0">⌘K</KbdChip> commands
          </span>
          <span className="flex items-center gap-[5px]">
            <KbdChip className="py-0">V</KbdChip> switch view
          </span>
          <span className="flex items-center gap-[5px]">
            <KbdChip className="py-0">T</KbdChip> theme
          </span>
          <span className="flex items-center gap-[5px]">
            <KbdChip className="py-0">1–3</KbdChip> priority while typing (!high · !med · !low)
          </span>
        </div>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <CommandPalette
          commands={paletteCommands}
          tasks={activeTasks}
          onSelectTask={task => {
            setPaletteOpen(false);
            handleEdit(task);
          }}
          onClose={() => setPaletteOpen(false)}
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
    </div>
  );
}
