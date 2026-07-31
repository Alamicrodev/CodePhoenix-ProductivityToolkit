import { useCallback, useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import { Task, useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { TaskModal, TaskModalSeed } from "../components/TaskModal";
import { Kbd } from "../components/tasks/Kbd";
import { useCompleteTask } from "../components/tasks/useCompleteTask";
import { AgendaView } from "../components/schedule/AgendaView";
import { ScheduleRail } from "../components/schedule/ScheduleRail";
import { TimelineView } from "../components/schedule/TimelineView";
import { WeekDay, WeekStrip } from "../components/schedule/WeekStrip";
import { usePersistentState } from "../hooks/usePersistentState";
import { findCompletionMarkerForDay } from "../lib/habitStats";
import { ScheduleDragItem } from "../components/schedule/dnd";
import {
  computePlanStats,
  deriveDayBlocks,
  formatBlockDuration,
  formatMinutes,
  minutesOfDay,
  minutesToClock,
  ScheduleBlock,
  shiftWindow,
} from "../lib/schedulePlan";
import { compareByDueDate, formatDueLabel } from "../lib/taskDates";
import { formatClockTime12, formatDateKeyLocal, startOfLocalDay } from "../lib/timeFormat";
import { useTheme } from "next-themes";

type ScheduleView = "timeline" | "agenda";
const isScheduleView = (v: unknown): v is ScheduleView => v === "timeline" || v === "agenda";

function formatDayTitle(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function dayShortLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

export default function SchedulePage() {
  const { tasks, habits, completeHabit, undoCompleteHabit, updateTask, updateHabit } = useData();
  const completeTask = useCompleteTask();
  const { resolvedTheme, setTheme } = useTheme();

  const [view, setView] = usePersistentState<ScheduleView>(
    "schedule.view",
    "timeline",
    isScheduleView,
  );
  const [now, setNow] = useState(() => new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [modalSeed, setModalSeed] = useState<TaskModalSeed | undefined>();

  // Live clock: the now-line and in-progress detection tick every 60s.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  // The AI-generated-plan store is gone; clear any leftover cache.
  useEffect(() => {
    try {
      window.localStorage.removeItem("schedule.plans");
    } catch {
      // Best-effort cleanup.
    }
  }, []);

  const todayKey = formatDateKeyLocal(now);
  const nowMin = minutesOfDay(now);

  // Current week, Monday-first; day switching is clamped to today…Sunday.
  const todayIndex = (now.getDay() + 6) % 7;
  const weekDays = useMemo<WeekDay[]>(() => {
    const monday = startOfLocalDay(now);
    monday.setDate(monday.getDate() - todayIndex);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        key: formatDateKeyLocal(date),
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        num: String(date.getDate()),
        title: formatDayTitle(date),
        past: i < todayIndex,
      };
    });
  }, [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dayIndex, setDayIndex] = useState(todayIndex);
  const viewedIndex = Math.max(dayIndex, todayIndex);
  const viewedKey = weekDays[viewedIndex].key;
  const isToday = viewedIndex === todayIndex;

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const habitById = useMemo(() => new Map(habits.map(h => [h.id, h])), [habits]);

  /** The viewed day exactly as the user scheduled it: due tasks + active habits. */
  const viewedBlocks = useMemo(
    () => deriveDayBlocks(tasks, habits, viewedKey),
    [tasks, habits, viewedKey],
  );
  const todayBlocks = useMemo(
    () => (isToday ? viewedBlocks : deriveDayBlocks(tasks, habits, todayKey)),
    [isToday, viewedBlocks, tasks, habits, todayKey],
  );

  /* -------------------------------- interactions -------------------------------- */

  const handleToggleBlock = useCallback(
    (block: ScheduleBlock) => {
      if (block.kind === "task") {
        const task = taskById.get(block.sourceId);
        if (task) void completeTask(task);
        return;
      }
      const habit = habitById.get(block.sourceId);
      if (!habit) return;
      if (!isToday) {
        toast.info("Habit check-ins happen on the day itself");
        return;
      }
      const marker = findCompletionMarkerForDay(habit, now);
      if (marker) {
        void undoCompleteHabit(habit.id, marker);
      } else {
        void completeHabit(habit.id);
      }
    },
    [taskById, habitById, completeTask, completeHabit, undoCompleteHabit, isToday, now],
  );

  const handleEditTask = useCallback(
    (block: ScheduleBlock) => {
      const task = taskById.get(block.sourceId);
      if (task) {
        setEditingTask(task);
        setIsModalOpen(true);
      }
    },
    [taskById],
  );

  /** Drop on the grid: move the task/habit to start at `minutes` on the viewed day. */
  const handleDropSchedule = useCallback(
    (item: ScheduleDragItem, minutes: number) => {
      if (item.kind === "task") {
        const task = taskById.get(item.sourceId);
        if (!task) return;
        const movedDay = task.dueDate !== viewedKey;
        void updateTask(task.id, { dueDate: viewedKey, dueTime: minutesToClock(minutes) });
        toast.success(
          movedDay
            ? `Scheduled "${task.title}" for ${dayShortLabel(viewedKey)} ${formatMinutes(minutes, true)}`
            : `Moved "${task.title}" to ${formatMinutes(minutes, true)}`,
        );
        return;
      }
      const habit = habitById.get(item.sourceId);
      if (!habit) return;
      void updateHabit(habit.id, { activeHours: shiftWindow(habit.activeHours, minutes) });
      toast.success(`Moved "${habit.title}" to ${formatMinutes(minutes, true)}`);
    },
    [taskById, habitById, updateTask, updateHabit, viewedKey],
  );

  /** Resize commit: the grid handle sets the task's duration estimate. */
  const handleResizeTask = useCallback(
    (block: ScheduleBlock, minutes: number) => {
      const task = taskById.get(block.sourceId);
      if (!task) return;
      void updateTask(task.id, { durationMinutes: minutes });
      toast.success(`"${task.title}" estimated at ${formatBlockDuration(minutes)}`);
    },
    [taskById, updateTask],
  );

  const handleNewTask = useCallback(() => {
    setEditingTask(undefined);
    setModalSeed({ dueDate: viewedKey });
    setIsModalOpen(true);
  }, [viewedKey]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(undefined);
    setModalSeed(undefined);
  }, []);

  /* ------------------------------ keyboard shortcuts ------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (isTyping || isModalOpen) return;

      switch (event.key.toLowerCase()) {
        case "n":
          event.preventDefault();
          handleNewTask();
          break;
        case "v":
          event.preventDefault();
          setView(v => (v === "timeline" ? "agenda" : "timeline"));
          break;
        case "t":
          event.preventDefault();
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          break;
        case "arrowright":
          event.preventDefault();
          setDayIndex(i => Math.min(6, Math.max(i, todayIndex) + 1));
          break;
        case "arrowleft":
          event.preventDefault();
          setDayIndex(i => Math.max(todayIndex, Math.max(i, todayIndex) - 1));
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewTask, setView, setTheme, resolvedTheme, todayIndex, isModalOpen]);

  /* --------------------------------- rail data --------------------------------- */

  const openTasks = useMemo(() => tasks.filter(t => !t.completed && t.dueDate), [tasks]);

  const overdueRows = useMemo(
    () =>
      openTasks
        .filter(t => t.dueDate! < todayKey)
        .sort(compareByDueDate)
        .map(task => ({ task, dateLabel: formatDueLabel(task.dueDate!, now) })),
    [openTasks, todayKey, now],
  );

  const dueTodayRows = useMemo(
    () =>
      openTasks
        .filter(t => t.dueDate === todayKey)
        .sort(compareByDueDate)
        .map(task => ({
          task,
          timeLabel: task.dueTime ? formatClockTime12(task.dueTime) : "",
        })),
    [openTasks, todayKey],
  );

  const weekRows = useMemo(() => {
    const horizon = startOfLocalDay(now);
    horizon.setDate(horizon.getDate() + 7);
    const horizonKey = formatDateKeyLocal(horizon);
    return openTasks
      .filter(t => t.dueDate! > todayKey && t.dueDate! <= horizonKey)
      .sort(compareByDueDate)
      .slice(0, 6)
      .map(task => ({
        task,
        dateLabel: formatDayTitle(new Date(`${task.dueDate}T12:00:00`)),
      }));
  }, [openTasks, todayKey, now]);

  const stats = computePlanStats([...todayBlocks.timed, ...todayBlocks.untimed]);

  /* ----------------------------------- header ----------------------------------- */

  const viewedDate = new Date(`${viewedKey}T12:00:00`);
  const dayTitle = isToday ? `Today · ${formatDayTitle(now)}` : formatDayTitle(viewedDate);
  const viewedCount = viewedBlocks.timed.length + viewedBlocks.untimed.length;
  const viewedStats = computePlanStats([...viewedBlocks.timed, ...viewedBlocks.untimed]);
  const summary =
    viewedCount > 0
      ? `${dayTitle} · ${viewedCount} scheduled · ${formatBlockDuration(viewedStats.plannedMin)}`
      : `${dayTitle} · nothing scheduled`;

  const segmentClass = (active: boolean) =>
    `rounded-[5px] px-3 py-[3px] text-xs transition-colors ${
      active ? "bg-card text-foreground shadow-sm" : "text-tertiary hover:text-foreground"
    }`;

  return (
    <DashboardLayout>
      <DndProvider backend={HTML5Backend}>
        <div className="flex flex-col md:h-dvh">
        {/* Page header */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-2 sm:h-[46px] sm:flex-nowrap sm:py-0">
          <h1 className="shrink-0 text-sm font-semibold">Schedule</h1>
          <span className="min-w-0 flex-1 truncate text-xs text-tertiary">{summary}</span>
          <div className="flex shrink-0 rounded-[7px] border border-border bg-muted p-0.5">
            <button
              type="button"
              aria-pressed={view === "timeline"}
              onClick={() => setView("timeline")}
              className={segmentClass(view === "timeline")}
            >
              Timeline
            </button>
            <button
              type="button"
              aria-pressed={view === "agenda"}
              onClick={() => setView("agenda")}
              className={segmentClass(view === "agenda")}
            >
              Agenda
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewTask}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-2.5 py-[5px] text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            New task
            <kbd className="rounded bg-white/20 px-1 py-px font-mono text-[10px] leading-4">N</kbd>
          </button>
        </div>

        {/* Week strip */}
        <div className="flex h-10 shrink-0 items-center gap-[5px] overflow-x-auto border-b border-border px-4">
          <WeekStrip
            days={weekDays}
            activeIndex={viewedIndex}
            onPick={index => setDayIndex(index)}
          />
        </div>

        {/* Content: day view + right rail */}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            {viewedCount === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 pt-[120px] text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-base text-tertiary">
                  ▤
                </div>
                <h2 className="mt-1.5 text-[13.5px] font-semibold">
                  Nothing scheduled for {isToday ? "today" : formatDayTitle(viewedDate)}
                </h2>
                <p className="max-w-[340px] text-[12.5px] leading-normal text-tertiary">
                  Tasks due this day and habits active on it appear here. Add a due time to place
                  a task on the timeline.
                </p>
                <button
                  type="button"
                  onClick={handleNewTask}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  New task
                </button>
              </div>
            ) : view === "timeline" ? (
              <TimelineView
                timed={viewedBlocks.timed}
                untimed={viewedBlocks.untimed}
                nowMin={nowMin}
                isToday={isToday}
                todayKey={todayKey}
                onToggle={handleToggleBlock}
                onEditTask={handleEditTask}
                onDropSchedule={handleDropSchedule}
                onResizeTask={handleResizeTask}
              />
            ) : (
              <AgendaView
                timed={viewedBlocks.timed}
                untimed={viewedBlocks.untimed}
                nowMin={nowMin}
                isToday={isToday}
                todayKey={todayKey}
                onToggle={handleToggleBlock}
                onEditTask={handleEditTask}
              />
            )}
          </div>

          <ScheduleRail
            stats={stats}
            overdueRows={overdueRows}
            dueTodayRows={dueTodayRows}
            weekRows={weekRows}
            onCompleteTask={task => void completeTask(task)}
          />
        </div>

        {/* Shortcut footer */}
        <div className="flex h-[30px] shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-border px-4 text-[11px] text-tertiary">
          <span className="flex items-center gap-1.5">
            <Kbd>N</Kbd> new task
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>V</Kbd> switch view
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>←→</Kbd> change day
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>T</Kbd> theme
          </span>
        </div>

          {/* Task editor */}
          <TaskModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            task={editingTask}
            seed={modalSeed}
          />
        </div>
      </DndProvider>
    </DashboardLayout>
  );
}
