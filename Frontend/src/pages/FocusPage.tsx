import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { Check, Pause, Play, Search, Timer, X } from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { usePalette, useRegisterPaletteCommands } from "../context/PaletteContext";
import { FocusRail } from "../components/focus/FocusRail";
import { FocusSetupModal } from "../components/focus/FocusSetupModal";
import { PlanStrip } from "../components/focus/PlanStrip";
import { CircleCheckbox } from "../components/tasks/CircleCheckbox";
import { DueLabel } from "../components/tasks/DueLabel";
import { Kbd } from "../components/tasks/Kbd";
import { PriorityBars } from "../components/tasks/PriorityBars";
import { FocusSession, Habit, useData } from "../context/DataContext";
import {
  buildPlan,
  formatClock,
  formatMinutes,
  formatTimerDigits,
  locatePlanPosition,
  sessionTitle,
} from "../lib/focusPlan";
import { CMD_LABEL } from "../lib/platform";
import { startOfWeek } from "../lib/habitSchedule";

/** Whether a habit's current period was already ticked off, in or out of the session. */
function isHabitDoneForSession(habit: Habit, session: FocusSession) {
  const since =
    habit.frequency === "weekly"
      ? startOfWeek(new Date(session.createdAt))
      : habit.frequency === "daily"
        ? new Date(session.createdAt.split("T")[0])
        : new Date(session.createdAt);

  return (
    habit.completedDates.some(date => new Date(date).getTime() >= since.getTime()) ||
    (habit.occurrences || []).some(
      occurrence =>
        occurrence.status === "completed" && new Date(occurrence.timestamp).getTime() >= since.getTime(),
    )
  );
}

function clockOf(timestamp: string) {
  return formatClock(new Date(timestamp));
}

export default function FocusPage() {
  const {
    tasks,
    habits,
    focusSessions,
    createFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeFocusSession,
    quitFocusSession,
    markFocusSessionItemComplete,
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  // ⌘K and the palette live in the shell; this page only tracks whether it
  // is open so Space / E / N / 1-9 stay suppressed underneath it.
  const { open: isPaletteOpen, setOpen: setIsPaletteOpen } = usePalette();
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [seedTaskIds, setSeedTaskIds] = useState<string[]>([]);
  const [dismissedSummaryId, setDismissedSummaryId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => focusSessions.find(session => session.status === "active" || session.status === "paused") ?? null,
    [focusSessions],
  );

  // The most recently finished session, shown as a summary until dismissed.
  const summary = useMemo(() => {
    if (current) {
      return null;
    }
    const finished = focusSessions
      .filter(session => session.status === "completed" || session.status === "quit")
      .sort((left, right) => new Date(right.endedAt ?? 0).getTime() - new Date(left.endedAt ?? 0).getTime())[0];
    return finished && finished.id !== dismissedSummaryId ? finished : null;
  }, [current, dismissedSummaryId, focusSessions]);

  const plan = useMemo(
    () =>
      current
        ? buildPlan(current.totalDurationMinutes, current.focusLengthMinutes, current.breakLengthMinutes)
        : null,
    [current],
  );
  const position = useMemo(
    () => (current && plan ? locatePlanPosition(plan.segments, current.elapsedSeconds) : null),
    [current, plan],
  );

  const itemsDone = current?.items.filter(item => item.completedInSessionAt).length ?? 0;

  const weekFocused = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return focusSessions
      .filter(session => new Date(session.startedAt) >= weekStart)
      .reduce((sum, session) => sum + session.elapsedSeconds, 0);
  }, [focusSessions]);

  const weekSessions = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return focusSessions.filter(session => new Date(session.startedAt) >= weekStart).length;
  }, [focusSessions]);

  // Arriving from a task row or the task palette: carry the task into setup.
  useEffect(() => {
    const state = location.state as { preselectedTaskIds?: string[] } | null;
    const preselected = state?.preselectedTaskIds ?? [];
    if (preselected.length === 0) {
      return;
    }
    if (current) {
      toast.info("A focus session is already running. Finish it before starting another.");
    } else {
      setSeedTaskIds(preselected);
      setIsSetupOpen(true);
    }
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Close the end menu on an outside click, the way the task editor's popovers do.
  useEffect(() => {
    if (!isEndOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!endRef.current?.contains(event.target as Node)) {
        setIsEndOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isEndOpen]);

  const startSession = async (input: Parameters<typeof createFocusSession>[0]) => {
    const id = await createFocusSession(input);
    if (id) {
      setIsSetupOpen(false);
      setSeedTaskIds([]);
      setDismissedSummaryId(null);
    }
  };

  const togglePause = () => {
    if (!current) {
      return;
    }
    if (current.status === "active") {
      void pauseFocusSession(current.id);
    } else {
      void resumeFocusSession(current.id);
    }
  };

  const toggleItem = (item: FocusSession["items"][number]) => {
    if (!current || item.completedInSessionAt) {
      return;
    }
    void markFocusSessionItemComplete(current.id, item.id);
  };

  // Page shortcuts. Suppressed while typing or while a layer owns the keyboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isSetupOpen || isPaletteOpen) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (isTyping) {
        return;
      }

      if (event.key === "Escape" && isEndOpen) {
        event.preventDefault();
        setIsEndOpen(false);
        return;
      }
      if (event.key.toLowerCase() === "n" && !current) {
        event.preventDefault();
        setSeedTaskIds([]);
        setIsSetupOpen(true);
        return;
      }
      if (!current) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePause();
        return;
      }
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setIsEndOpen(open => !open);
        return;
      }
      // 1–9 tick the nth attached item.
      if (/^[1-9]$/.test(event.key)) {
        const item = current.items[Number(event.key) - 1];
        if (item) {
          event.preventDefault();
          toggleItem(item);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    if (!current) {
      return [
        {
          label: "Start focus session",
          icon: <Timer />,
          shortcut: "N",
          run: () => {
            setSeedTaskIds([]);
            setIsSetupOpen(true);
          },
        },
      ];
    }
    return [
      {
        label: current.status === "active" ? "Pause session" : "Resume session",
        icon: current.status === "active" ? <Pause /> : <Play />,
        shortcut: "Space",
        run: togglePause,
      },
      {
        label: "Complete session now",
        icon: <Check />,
        run: () => void completeFocusSession(current.id),
      },
      {
        label: "Quit session",
        icon: <X />,
        destructive: true,
        run: () => void quitFocusSession(current.id),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useRegisterPaletteCommands("Focus", paletteCommands);

  const headerMeta = current
    ? [
        sessionTitle(current.totalDurationMinutes, current.focusLengthMinutes, current.breakLengthMinutes),
        `started ${clockOf(current.startedAt)}`,
        `ends ${formatClock(new Date(new Date(current.startedAt).getTime() + current.totalDurationMinutes * 60_000))}`,
      ].join(" · ")
    : [
        new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        `${formatMinutes(weekFocused / 60)} focused this week`,
        `${weekSessions} session${weekSessions === 1 ? "" : "s"}`,
      ].join(" · ");

  const phaseLabel = () => {
    if (!current || !plan || !position) {
      return "";
    }
    const total = plan.focusCount;
    if (current.status === "paused") {
      return `Paused · focus ${position.focusBlockNumber || position.focusBlocksDone} of ${total}`;
    }
    if (current.phaseType === "break") {
      return `Break · next: focus ${Math.min(position.focusBlocksDone + 1, total)} of ${total}`;
    }
    return `Focus · block ${position.focusBlockNumber || 1} of ${total}`;
  };

  const phaseTone =
    current?.status === "paused"
      ? "text-priority-medium"
      : current?.phaseType === "break"
        ? "text-done"
        : "text-primary";

  const endsAt = current
    ? new Date(new Date(current.startedAt).getTime() + current.totalDurationMinutes * 60_000)
    : null;

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 sm:h-[46px] sm:px-4 sm:py-0">
          <h1 className="text-[13px] font-semibold">Focus</h1>
          <span className="min-w-0 truncate text-xs text-tertiary">{headerMeta}</span>
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
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            {current && plan && position ? (
              <div className="mx-auto w-full max-w-[660px] px-6 py-11">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${phaseTone}`}
                  aria-live="polite"
                >
                  {phaseLabel()}
                </p>

                <div
                  className={`mt-3 font-mono text-[52px] font-medium leading-none tabular-nums sm:text-[64px] ${
                    current.status === "paused" ? "text-tertiary" : ""
                  }`}
                >
                  {formatTimerDigits(current.phaseRemainingSeconds)}
                </div>

                <p className="mt-3 text-xs text-tertiary">
                  {current.status === "paused"
                    ? "Paused — the plan holds its place"
                    : `${
                        current.phaseType === "focus"
                          ? `Break in ${formatMinutes(current.phaseRemainingSeconds / 60)}`
                          : `Focus again in ${formatMinutes(current.phaseRemainingSeconds / 60)}`
                      } · session ends ${endsAt ? formatClock(endsAt) : ""}`}
                </p>

                {/* Whole-session progress, distinct from the phase clock above */}
                <div className="mt-7 max-w-[560px]">
                  <PlanStrip
                    segments={plan.segments}
                    variant="active"
                    activeIndex={position.index}
                    activeFraction={position.fraction}
                  />
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-tertiary">
                    <span>{clockOf(current.startedAt)}</span>
                    <span>
                      {formatMinutes(current.elapsedSeconds / 60)} of{" "}
                      {formatMinutes(current.totalDurationMinutes)}
                    </span>
                    <span>{endsAt ? formatClock(endsAt) : ""}</span>
                  </div>
                </div>

                {/* Controls — exactly one loud button */}
                <div className="mt-7 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePause}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {current.status === "active" ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {current.status === "active" ? "Pause" : "Resume"}
                    <Kbd tone="onPrimary">space</Kbd>
                  </button>

                  <div className="relative" ref={endRef}>
                    <button
                      type="button"
                      aria-expanded={isEndOpen}
                      onClick={() => setIsEndOpen(open => !open)}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      End session
                      <Kbd>E</Kbd>
                    </button>
                    {isEndOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full z-20 mt-1.5 w-[230px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsEndOpen(false);
                            void completeFocusSession(current.id);
                          }}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-done" />
                          <span>
                            <span className="block text-[13px]">Complete now</span>
                            <span className="block text-[11px] text-tertiary">
                              {itemsDone} of {current.items.length} done
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsEndOpen(false);
                            void quitFocusSession(current.id);
                          }}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-destructive/10"
                        >
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          <span>
                            <span className="block text-[13px] text-destructive">Quit session</span>
                            <span className="block text-[11px] text-tertiary">kept in history</span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attached items */}
                {current.items.length > 0 && (
                  <div className="mt-8 border-t border-border pt-4">
                    <h2 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                      In this session · {itemsDone} of {current.items.length} done
                    </h2>
                    {current.items.map((item, index) => {
                      const task = tasks.find(entry => entry.id === item.sourceId);
                      const habit = habits.find(entry => entry.id === item.sourceId);
                      const doneElsewhere =
                        !item.completedInSessionAt &&
                        (item.sourceType === "task"
                          ? Boolean(task?.completed)
                          : habit
                            ? isHabitDoneForSession(habit, current)
                            : false);
                      const done = Boolean(item.completedInSessionAt) || doneElsewhere;

                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-hover ${
                            done ? "opacity-60" : ""
                          }`}
                        >
                          <CircleCheckbox
                            checked={done}
                            onToggle={() => toggleItem(item)}
                            label={done ? `${item.title} is done` : `Complete ${item.title}`}
                          />
                          {item.sourceType === "task" ? (
                            <PriorityBars priority={task?.priority ?? "medium"} />
                          ) : (
                            <span className="shrink-0 text-[13px] leading-none text-done" aria-hidden="true">
                              ◎
                            </span>
                          )}
                          <span className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span
                              className={`truncate text-[13px] font-medium ${
                                done ? "text-muted-foreground line-through" : ""
                              }`}
                            >
                              {task?.title ?? habit?.title ?? item.title}
                            </span>
                            {item.sourceType === "habit" && (
                              <span className="hidden text-xs capitalize text-tertiary sm:inline">
                                {habit?.frequency}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-tertiary opacity-0 group-hover:opacity-100">
                            {index < 9 ? index + 1 : ""}
                          </span>
                          {item.completedInSessionAt ? (
                            <span className="shrink-0 whitespace-nowrap font-mono text-xs text-done">
                              ✓ {clockOf(item.completedInSessionAt)}
                            </span>
                          ) : doneElsewhere ? (
                            <span className="shrink-0 whitespace-nowrap text-[11.5px] text-tertiary">
                              done in {item.sourceType === "task" ? "Tasks" : "Habits"}
                            </span>
                          ) : item.sourceType === "task" ? (
                            <DueLabel dueDate={task?.dueDate ?? null} dueTime={task?.dueTime ?? null} />
                          ) : (
                            <span className="w-[76px] shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : summary ? (
              <div className="mx-auto w-full max-w-[420px] px-6 pt-[120px] text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card">
                  {summary.status === "completed" ? (
                    <Check className="h-4 w-4 text-done" />
                  ) : (
                    <X className="h-4 w-4 text-tertiary" />
                  )}
                </div>
                <h2 className="mt-3 text-[13.5px] font-semibold">
                  {summary.status === "completed" ? "Session complete" : "Session quit"}
                </h2>
                <p className="mx-auto mt-1.5 max-w-[340px] text-[12.5px] leading-relaxed text-tertiary">
                  {formatMinutes(summary.elapsedSeconds / 60)} focused ·{" "}
                  {summary.items.filter(item => item.completedInSessionAt).length} of {summary.items.length}{" "}
                  items done · saved to history
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDismissedSummaryId(summary.id)}
                    className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSeedTaskIds([]);
                      setIsSetupOpen(true);
                    }}
                    className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Start another
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[420px] px-6 pt-[120px] text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card">
                  <Timer className="h-4 w-4 text-tertiary" />
                </div>
                <h2 className="mt-3 text-[13.5px] font-semibold">No active session</h2>
                <p className="mx-auto mt-1.5 max-w-[340px] text-[12.5px] leading-relaxed text-tertiary">
                  A session is a stretch of time split into focus and break periods, with the tasks and habits
                  you want to finish inside it.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSeedTaskIds([]);
                    setIsSetupOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Start focus session
                  <Kbd tone="onPrimary">N</Kbd>
                </button>
              </div>
            )}
          </div>

          <FocusRail
            sessions={focusSessions}
            current={current}
            blocksDone={position?.focusBlocksDone ?? 0}
            blocksTotal={plan?.focusCount ?? 0}
            itemsDone={itemsDone}
          />
        </div>

        {/* Shortcut footer */}
        <div className="mt-auto hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary sm:flex sm:px-4">
          {current ? (
            <>
              <span className="flex items-center gap-1.5">
                <Kbd>space</Kbd> pause / resume
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>E</Kbd> end session
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>1–9</Kbd> tick an item
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <Kbd>N</Kbd> new session
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Kbd>{CMD_LABEL} K</Kbd> commands
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>T</Kbd> theme
          </span>
        </div>

        <FocusSetupModal
          isOpen={isSetupOpen}
          onClose={() => setIsSetupOpen(false)}
          tasks={tasks}
          habits={habits}
          seedTaskIds={seedTaskIds}
          onStart={input => void startSession(input)}
        />
      </div>
    </DashboardLayout>
  );
}
