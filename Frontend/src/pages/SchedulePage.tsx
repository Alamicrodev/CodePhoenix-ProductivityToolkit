import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Kbd } from "../components/tasks/Kbd";
import { useCompleteTask } from "../components/tasks/useCompleteTask";
import { AgendaView } from "../components/schedule/AgendaView";
import { ScheduleRail } from "../components/schedule/ScheduleRail";
import { TimelineView } from "../components/schedule/TimelineView";
import { WeekDay, WeekStrip } from "../components/schedule/WeekStrip";
import { apiRequest } from "../lib/api";
import { getTaskIdsInFocus } from "../lib/focusStatus";
import { findCompletionMarkerForDay } from "../lib/habitStats";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  AiScheduleItem,
  blocksFromAiItems,
  buildPlanItems,
  computePlanStats,
  DAY_END,
  DAY_START,
  formatBlockDuration,
  formatMinutes,
  isPlanMap,
  minutesOfDay,
  newBlockStart,
  packBlocks,
  PlanMap,
  replanBlocks,
  roundUpTo,
  ScheduleBlock,
} from "../lib/schedulePlan";
import { compareByDueDate, formatDueLabel } from "../lib/taskDates";
import { formatClockTime12, formatDateKeyLocal, startOfLocalDay } from "../lib/timeFormat";
import { useTheme } from "next-themes";

interface AiScheduleResponse {
  generated_at: string;
  model: string | null;
  fallback_used: boolean;
  items: AiScheduleItem[];
  summary: string | null;
}

type ScheduleView = "timeline" | "agenda";
const isScheduleView = (v: unknown): v is ScheduleView => v === "timeline" || v === "agenda";

const REPLAN_DELAY_MS = 550;

function formatDayTitle(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Just now" right after an optimize, then "9:12 AM" (or "Wed 9:12 AM" across days). */
function formatOptimizedAt(iso: string, now: Date) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  if (now.getTime() - at.getTime() < 90_000) return "Just now";
  const time = formatMinutes(minutesOfDay(at), true);
  if (formatDateKeyLocal(at) === formatDateKeyLocal(now)) return time;
  return `${at.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
}

export default function SchedulePage() {
  const { accessToken } = useAuth();
  const { tasks, habits, focusSessions, completeHabit, undoCompleteHabit } = useData();
  const completeTask = useCompleteTask();
  const { resolvedTheme, setTheme } = useTheme();

  const [view, setView] = usePersistentState<ScheduleView>(
    "schedule.view",
    "timeline",
    isScheduleView,
  );
  const [plans, setPlans] = usePersistentState<PlanMap>("schedule.plans", {}, isPlanMap);
  const [replanning, setReplanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const replanTimer = useRef<number | null>(null);

  // Live clock: the now-line and in-progress detection tick every 60s.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => () => {
    if (replanTimer.current !== null) window.clearTimeout(replanTimer.current);
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

  // Drop plans for days that have passed.
  useEffect(() => {
    setPlans(prev => {
      const kept = Object.entries(prev).filter(([key]) => key >= todayKey);
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept);
    });
  }, [todayKey]);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const habitById = useMemo(() => new Map(habits.map(h => [h.id, h])), [habits]);

  /** Overlays live workspace state (task completion, habit check-ins, titles) onto stored blocks. */
  const decorateBlocks = useCallback(
    (blocks: ScheduleBlock[], dayKey: string): ScheduleBlock[] =>
      blocks.map(block => {
        if (block.sourceId && block.kind === "task") {
          const task = taskById.get(block.sourceId);
          if (task) {
            return {
              ...block,
              title: task.title,
              done: task.completed,
              priority: task.priority,
              dueDate: task.dueDate,
            };
          }
        }
        if (block.sourceId && block.kind === "habit") {
          const habit = habitById.get(block.sourceId);
          if (habit) {
            const marker = findCompletionMarkerForDay(habit, new Date(`${dayKey}T12:00:00`));
            return {
              ...block,
              title: habit.title,
              streak: habit.streak,
              done: block.done || marker !== null,
            };
          }
        }
        return block;
      }),
    [taskById, habitById],
  );

  const plan = plans[viewedKey];
  const viewedBlocks = useMemo(
    () => (plan ? decorateBlocks(plan.blocks, viewedKey) : []),
    [plan, decorateBlocks, viewedKey],
  );

  const todayPlan = plans[todayKey];
  const todayBlocks = useMemo(
    () => (todayPlan ? decorateBlocks(todayPlan.blocks, todayKey) : []),
    [todayPlan, decorateBlocks, todayKey],
  );

  /* ------------------------------ plan mutations ------------------------------ */

  const mutatePlan = useCallback(
    (dayKey: string, fn: (blocks: ScheduleBlock[]) => ScheduleBlock[], optimized = false) => {
      setPlans(prev => {
        const current = prev[dayKey];
        if (!current) return prev;
        return {
          ...prev,
          [dayKey]: {
            optimizedAt: optimized ? new Date().toISOString() : current.optimizedAt,
            blocks: fn(current.blocks),
          },
        };
      });
    },
    [],
  );

  const handleToggleBlock = useCallback(
    (block: ScheduleBlock, dayKey: string) => {
      if (block.kind === "task" && block.sourceId) {
        const task = taskById.get(block.sourceId);
        if (task) {
          void completeTask(task);
          return;
        }
      }
      if (block.kind === "habit" && block.sourceId && isToday) {
        const habit = habitById.get(block.sourceId);
        if (habit) {
          const marker = findCompletionMarkerForDay(habit, now);
          if (marker) {
            void undoCompleteHabit(habit.id, marker);
            return;
          }
          if (!block.done) {
            void completeHabit(habit.id);
            return;
          }
          // Stored-done with no check-in falls through to a local flip.
        }
      }
      // Planning blocks, breaks, unlinked blocks, and future-day habits flip locally.
      mutatePlan(dayKey, blocks =>
        blocks.map(b => (b.id === block.id ? { ...b, done: !b.done } : b)),
      );
    },
    [taskById, habitById, completeTask, completeHabit, undoCompleteHabit, mutatePlan, isToday, now],
  );

  const handleNewBlock = useCallback(() => {
    if (!plans[viewedKey]) return;
    mutatePlan(viewedKey, blocks => [
      ...blocks,
      {
        id: `manual-${Date.now()}`,
        start: newBlockStart(blocks),
        dur: 45,
        kind: "task",
        title: "Deep work",
        done: false,
        priority: "medium",
      },
    ]);
  }, [plans, viewedKey, mutatePlan]);

  const replanAnchor = useCallback(
    (forToday: boolean) =>
      forToday
        ? Math.min(Math.max(minutesOfDay(new Date()), DAY_START), DAY_END)
        : DAY_START + 55, // future days repack from ~9:00
    [],
  );

  const handleReplan = useCallback(() => {
    if (!plans[viewedKey] || replanning) return;
    setReplanning(true);
    const dayKey = viewedKey;
    const forToday = dayKey === todayKey;
    replanTimer.current = window.setTimeout(() => {
      replanTimer.current = null;
      mutatePlan(
        dayKey,
        blocks => replanBlocks(decorateBlocks(blocks, dayKey), replanAnchor(forToday), dayKey),
        true,
      );
      setReplanning(false);
    }, REPLAN_DELAY_MS);
  }, [plans, viewedKey, todayKey, replanning, mutatePlan, decorateBlocks, replanAnchor]);

  const handleGenerate = useCallback(async () => {
    if (generating || plans[viewedKey]) return;
    setGenerating(true);
    const dayKey = viewedKey;
    const forToday = dayKey === todayKey;

    let blocks: ScheduleBlock[] | null = null;
    // The backend scheduler plans from "now", so it only applies to today.
    if (accessToken && forToday) {
      try {
        const response = await apiRequest<AiScheduleResponse>("/ai-scheduler/suggest", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            current_time: new Date().toISOString(),
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        blocks = blocksFromAiItems(
          response.items ?? [],
          tasks,
          habits,
          replanAnchor(true),
          dayKey,
        );
      } catch (error) {
        console.error("AI scheduler unavailable, using local plan", error);
      }
    }
    if (!blocks) {
      const items = buildPlanItems(tasks, habits, dayKey, {
        excludeTaskIds: getTaskIdsInFocus(focusSessions),
      });
      blocks = packBlocks(items, roundUpTo(replanAnchor(forToday), 15));
    }
    setPlans(prev => ({
      ...prev,
      [dayKey]: { optimizedAt: new Date().toISOString(), blocks: blocks! },
    }));
    setGenerating(false);
  }, [generating, plans, viewedKey, todayKey, accessToken, tasks, habits, focusSessions, replanAnchor]);

  /* ------------------------------ keyboard shortcuts ------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (isTyping) return;

      switch (event.key.toLowerCase()) {
        case "n":
          event.preventDefault();
          handleNewBlock();
          break;
        case "r":
          event.preventDefault();
          handleReplan();
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
  }, [handleNewBlock, handleReplan, setTheme, resolvedTheme, todayIndex]);

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
        .map(task => {
          const scheduled = todayBlocks.find(b => b.sourceId === task.id && b.kind === "task");
          const timeLabel = scheduled
            ? formatMinutes(scheduled.start, true)
            : task.dueTime
              ? formatClockTime12(task.dueTime)
              : "";
          return { task, timeLabel };
        }),
    [openTasks, todayKey, todayBlocks],
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

  const stats = computePlanStats(todayBlocks);

  /* ----------------------------------- header ----------------------------------- */

  const viewedDate = new Date(`${viewedKey}T12:00:00`);
  const dayTitle = isToday ? `Today · ${formatDayTitle(now)}` : formatDayTitle(viewedDate);
  const viewedStats = computePlanStats(viewedBlocks);
  const summary = plan
    ? `${dayTitle} · ${viewedStats.totalCount} block${viewedStats.totalCount === 1 ? "" : "s"} · ${formatBlockDuration(viewedStats.plannedMin)} planned`
    : `${dayTitle} · no plan yet`;

  const segmentClass = (active: boolean) =>
    `rounded-[5px] px-3 py-[3px] text-xs transition-colors ${
      active ? "bg-card text-foreground shadow-sm" : "text-tertiary hover:text-foreground"
    }`;

  return (
    <DashboardLayout>
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
          {plan && (
            <>
              <button
                type="button"
                onClick={handleReplan}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="text-primary" aria-hidden="true">✦</span>
                {replanning ? "Replanning…" : "Replan"}
                <Kbd>R</Kbd>
              </button>
              <button
                type="button"
                onClick={handleNewBlock}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-2.5 py-[5px] text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                New block
                <kbd className="rounded bg-white/20 px-1 py-px font-mono text-[10px] leading-4">
                  N
                </kbd>
              </button>
            </>
          )}
        </div>

        {/* Week strip */}
        <div className="flex h-10 shrink-0 items-center gap-[5px] overflow-x-auto border-b border-border px-4">
          <WeekStrip
            days={weekDays}
            activeIndex={viewedIndex}
            onPick={index => setDayIndex(index)}
          />
          <span className="flex-1" />
          {plan && (
            <span className="hidden items-center gap-1.5 whitespace-nowrap text-[11.5px] text-tertiary sm:flex">
              <span className="text-primary" aria-hidden="true">✦</span>
              Plan optimized {formatOptimizedAt(plan.optimizedAt, now)}
            </span>
          )}
        </div>

        {/* Content: day view + right rail */}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            {!plan ? (
              <div className="flex flex-col items-center gap-2 px-6 pt-[120px] text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-base text-tertiary">
                  ▤
                </div>
                <h2 className="mt-1.5 text-[13.5px] font-semibold">
                  No plan for {isToday ? "today" : formatDayTitle(viewedDate)}
                </h2>
                <p className="max-w-[340px] text-[12.5px] leading-normal text-tertiary">
                  Generate an optimized plan from your open tasks, habits and free time.
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <span aria-hidden="true">✦</span>
                  {generating ? "Generating…" : "Generate plan"}
                </button>
              </div>
            ) : view === "timeline" ? (
              <TimelineView
                blocks={viewedBlocks}
                nowMin={nowMin}
                isToday={isToday}
                todayKey={todayKey}
                replanning={replanning}
                onToggle={block => handleToggleBlock(block, viewedKey)}
              />
            ) : (
              <AgendaView
                blocks={viewedBlocks}
                nowMin={nowMin}
                isToday={isToday}
                todayKey={todayKey}
                replanning={replanning}
                onToggle={block => handleToggleBlock(block, viewedKey)}
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
            <Kbd>N</Kbd> new block
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>R</Kbd> replan
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
      </div>
    </DashboardLayout>
  );
}
