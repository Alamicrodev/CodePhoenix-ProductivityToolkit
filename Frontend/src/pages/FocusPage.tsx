import { useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { PomodoroTimer } from "../components/PomodoroTimer";
import { useData, FocusSession, Habit } from "../context/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  CirclePause,
  CirclePlay,
  Clock3,
  Coffee,
  GripVertical,
  History,
  ListTodo,
  Plus,
  Target,
  Timer,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";

type DragPayload = {
  sourceType: "task" | "habit";
  sourceId: string;
};

type DurationUnit = "hours" | "minutes";

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
}

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "In progress";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getHabitCompletionState(habit: Habit, session: FocusSession) {
  if (habit.frequency === "hourly") {
    return (
      habit.completedDates.some(
        completedDate => new Date(completedDate).getTime() >= new Date(session.createdAt).getTime(),
      ) ||
      (habit.occurrences || []).some(
        occurrence =>
          occurrence.status === "completed" &&
          new Date(occurrence.timestamp).getTime() >= new Date(session.createdAt).getTime(),
      )
    );
  }

  if (habit.frequency === "daily") {
    const sessionDate = session.createdAt.split("T")[0];
    return (
      habit.completedDates.includes(sessionDate) ||
      (habit.occurrences || []).some(
        occurrence => occurrence.status === "completed" && occurrence.timestamp.startsWith(sessionDate),
      )
    );
  }

  const sessionStart = new Date(session.createdAt);
  const weekStart = new Date(sessionStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return (
    habit.completedDates.some(date => new Date(date).getTime() >= weekStart.getTime()) ||
    (habit.occurrences || []).some(
      occurrence =>
        occurrence.status === "completed" &&
        new Date(occurrence.timestamp).getTime() >= weekStart.getTime(),
    )
  );
}

function isHabitAvailableNow(habit: Habit) {
  const now = new Date();
  const isDayActive = !habit.activeDays || habit.activeDays.length === 0 || habit.activeDays.includes(now.getDay());

  if (!isDayActive) {
    return false;
  }

  if (habit.frequency === "hourly") {
    if (habit.activeHours) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMinute] = habit.activeHours.start.split(":").map(Number);
      const [endHour, endMinute] = habit.activeHours.end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return false;
      }
    }

    const lastCompletion = habit.completedDates.length > 0
      ? new Date(habit.completedDates[habit.completedDates.length - 1])
      : null;
    const intervalMs = (habit.hourlyInterval || 1) * 60 * 60 * 1000;

    return !lastCompletion || now.getTime() - lastCompletion.getTime() >= intervalMs;
  }

  if (habit.frequency === "daily") {
    const today = now.toISOString().split("T")[0];
    return !habit.completedDates.includes(today);
  }

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return !habit.completedDates.some(date => new Date(date).getTime() >= weekStart.getTime());
}

function getSessionStatusLabel(session: FocusSession) {
  if (session.status === "completed") {
    return session.completionResult === "successful" ? "completed successful" : "completed unsuccessful";
  }

  return session.status;
}

function SessionHistoryCard({
  session,
  canResume,
  isSelected,
  onSelect,
  onResume,
}: {
  session: FocusSession;
  canResume: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onResume: () => void;
}) {
  const statusStyle =
    session.status === "completed" && session.completionResult === "unsuccessful"
      ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900"
      : {
          active: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
          paused: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
          completed: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
          quit: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
        }[session.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`w-full rounded-xl border bg-card p-4 space-y-3 text-left ${isSelected ? "border-blue-500 shadow-sm" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{session.title}</h3>
          <p className="text-xs text-muted-foreground">Started {formatSessionTimestamp(session.startedAt)}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyle}`}>
          {getSessionStatusLabel(session)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>Total: {formatMinutes(session.totalDurationMinutes)}</div>
        <div>Focus blocks: {session.completedFocusBlocks}</div>
        <div>Focus: {formatMinutes(session.focusLengthMinutes)}</div>
        <div>Break: {formatMinutes(session.breakLengthMinutes)}</div>
      </div>
      <p className="text-xs text-muted-foreground">Ended {formatSessionTimestamp(session.endedAt)}</p>
      {session.status === "paused" && (
        <Button size="sm" variant="outline" className="w-full gap-2" onClick={event => {
          event.stopPropagation();
          onResume();
        }} disabled={!canResume}>
          <CirclePlay className="h-4 w-4" />
          Resume Session
        </Button>
      )}
    </div>
  );
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
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [durationValue, setDurationValue] = useState("5");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [focusLength, setFocusLength] = useState("30");
  const [breakLength, setBreakLength] = useState("5");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<string | null>(null);

  const activeSession = useMemo(() => focusSessions.find(session => session.status === "active"), [focusSessions]);
  const pausedSessions = useMemo(() => focusSessions.filter(session => session.status === "paused"), [focusSessions]);
  const currentSession = activeSession ?? pausedSessions[0] ?? null;
  const canStartNewSession = !activeSession;
  const activeTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);
  const availableTaskPool = useMemo(() => activeTasks.filter(task => !selectedTaskIds.includes(task.id)), [activeTasks, selectedTaskIds]);
  const availableHabitPool = useMemo(() => habits.filter(habit => !selectedHabitIds.includes(habit.id) && isHabitAvailableNow(habit)), [habits, selectedHabitIds]);
  const totalDurationMinutes = useMemo(() => {
    const numericValue = Number(durationValue) || 0;
    return durationUnit === "hours" ? Math.round(numericValue * 60) : Math.round(numericValue);
  }, [durationUnit, durationValue]);
  const focusLengthMinutes = Math.max(Number(focusLength) || 0, 1);
  const breakLengthMinutes = Math.max(Number(breakLength) || 0, 1);
  const getTaskById = (taskId: string) => tasks.find(task => task.id === taskId);
  const getHabitById = (habitId: string) => habits.find(habit => habit.id === habitId);
  const currentPhaseLabel = currentSession?.phaseType === "break"
    ? `${formatMinutes(currentSession.breakLengthMinutes)} break period`
    : `${formatMinutes(currentSession?.focusLengthMinutes ?? 0)} focus period`;
  const sessionProgress = currentSession ? (currentSession.elapsedSeconds / (currentSession.totalDurationMinutes * 60)) * 100 : 0;
  const completedSessions = useMemo(() => [...focusSessions].sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()), [focusSessions]);
  const selectedHistorySession = useMemo(() => {
    if (selectedHistorySessionId) {
      return completedSessions.find(session => session.id === selectedHistorySessionId) ?? null;
    }
    return completedSessions[0] ?? null;
  }, [completedSessions, selectedHistorySessionId]);

  const isItemDoneOverall = (session: FocusSession, item: FocusSession["items"][number]) => {
    if (item.completedInSessionAt) {
      return true;
    }
    if (item.sourceType === "task") {
      return Boolean(getTaskById(item.sourceId)?.completed);
    }
    const habit = getHabitById(item.sourceId);
    return habit ? getHabitCompletionState(habit, session) : false;
  };

  const canEndCurrentSessionEarly = Boolean(
    currentSession &&
    currentSession.items.length > 0 &&
    currentSession.items.every(item => isItemDoneOverall(currentSession, item)),
  );

  const resetSetupForm = () => {
    setDurationValue("5");
    setDurationUnit("hours");
    setFocusLength("30");
    setBreakLength("5");
    setSelectedTaskIds([]);
    setSelectedHabitIds([]);
  };

  const handleDragStart = (payload: DragPayload) => (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (targetType: "task" | "habit") => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rawPayload = event.dataTransfer.getData("application/json");
    if (!rawPayload) return;
    const payload = JSON.parse(rawPayload) as DragPayload;
    if (payload.sourceType !== targetType) return;
    if (targetType === "task") {
      setSelectedTaskIds(current => current.includes(payload.sourceId) ? current : [...current, payload.sourceId]);
    } else {
      setSelectedHabitIds(current => current.includes(payload.sourceId) ? current : [...current, payload.sourceId]);
    }
  };

  const handleCreateSession = async () => {
    if (!canStartNewSession || totalDurationMinutes <= 0) return;
    const sessionId = await createFocusSession({
      totalDurationMinutes,
      focusLengthMinutes: Math.min(focusLengthMinutes, totalDurationMinutes),
      breakLengthMinutes,
      taskIds: selectedTaskIds,
      habitIds: selectedHabitIds,
    });
    if (!sessionId) return;
    resetSetupForm();
    setIsSetupOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Focus Sessions</h1>
            <p className="text-muted-foreground max-w-3xl">
              Build long-form focus sessions made of repeating focus and break periods, then track the tasks
              and habit occurrences you want to complete inside each session.
            </p>
          </div>
          <Button className="gap-2 self-start" onClick={() => setIsSetupOpen(current => !current)} disabled={!canStartNewSession}>
            <Plus className="h-4 w-4" />
            Start New Focus Session
          </Button>
        </div>

        {!canStartNewSession && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
            A focus session is already active. Pause or quit it before starting another one.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            {currentSession ? (
              <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${currentSession.status === "active" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                        {currentSession.status}
                      </span>
                      <span className="text-sm text-muted-foreground">{currentSession.title}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold">
                        {currentSession.status === "paused"
                          ? "Focus session paused"
                          : currentSession.phaseType === "focus"
                          ? "Focus period in progress"
                          : "Break period in progress"}
                      </h2>
                      <p className="text-muted-foreground">
                        {currentPhaseLabel}. The timer below shows the current phase, while the session keeps
                        track of the full {formatMinutes(currentSession.totalDurationMinutes)} plan.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>Total session: {formatMinutes(currentSession.totalDurationMinutes)}</span>
                      <span>Elapsed: {formatSeconds(currentSession.elapsedSeconds)}</span>
                      <span>Completed focus blocks: {currentSession.completedFocusBlocks}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <PomodoroTimer timeLeft={currentSession.phaseRemainingSeconds} progress={Math.min(Math.max(sessionProgress, 0), 100)} />
                    <div className="flex flex-wrap justify-center gap-2">
                      {currentSession.status === "active" ? (
                        <Button className="gap-2" variant="outline" onClick={() => void pauseFocusSession(currentSession.id)}>
                          <CirclePause className="h-4 w-4" />
                          Pause Session
                        </Button>
                      ) : (
                        <Button className="gap-2" onClick={() => void resumeFocusSession(currentSession.id)} disabled={!canStartNewSession}>
                          <CirclePlay className="h-4 w-4" />
                          Resume Session
                        </Button>
                      )}
                      <Button className="gap-2" variant="destructive" onClick={() => void quitFocusSession(currentSession.id)}>
                        <XCircle className="h-4 w-4" />
                        Quit Session
                      </Button>
                      {canEndCurrentSessionEarly && (
                        <Button className="gap-2" variant="secondary" onClick={() => void completeFocusSession(currentSession.id)}>
                          <CirclePlay className="h-4 w-4" />
                          End As Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold">Tasks In This Session</h3>
                    </div>
                    <div className="space-y-3">
                      {currentSession.items.filter(item => item.sourceType === "task").length > 0 ? (
                        currentSession.items.filter(item => item.sourceType === "task").map(item => {
                          const task = getTaskById(item.sourceId);
                          const isCompletedExternally = Boolean(task?.completed);
                          const completedLabel = item.completedInSessionAt
                            ? "Completed in focus session"
                            : isCompletedExternally
                            ? "Completed in task manager"
                            : "Pending";

                          return (
                            <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{task?.title ?? item.title}</p>
                                  <p className="text-xs text-muted-foreground">{completedLabel}</p>
                                </div>
                                <Button size="sm" variant={item.completedInSessionAt || isCompletedExternally ? "secondary" : "default"} disabled={item.completedInSessionAt !== null || isCompletedExternally} onClick={() => markFocusSessionItemComplete(currentSession.id, item.id)}>
                                  {item.completedInSessionAt || isCompletedExternally ? "Done" : "Mark done"}
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">No tasks were assigned to this session.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="font-semibold">Habit Occurrences In This Session</h3>
                    </div>
                    <div className="space-y-3">
                      {currentSession.items.filter(item => item.sourceType === "habit").length > 0 ? (
                        currentSession.items.filter(item => item.sourceType === "habit").map(item => {
                          const habit = getHabitById(item.sourceId);
                          const isCompletedExternally = habit ? getHabitCompletionState(habit, currentSession) : false;
                          const completedLabel = item.completedInSessionAt
                            ? "Completed in focus session"
                            : isCompletedExternally
                            ? "Completed in habit tracker"
                            : "Pending";

                          return (
                            <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{habit?.title ?? item.title}</p>
                                  <p className="text-xs text-muted-foreground">{completedLabel}</p>
                                </div>
                                <Button size="sm" variant={item.completedInSessionAt || isCompletedExternally ? "secondary" : "default"} disabled={item.completedInSessionAt !== null || isCompletedExternally} onClick={() => markFocusSessionItemComplete(currentSession.id, item.id)}>
                                  {item.completedInSessionAt || isCompletedExternally ? "Done" : "Mark done"}
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">No habit occurrences were assigned to this session.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <Timer className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No active focus session</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Start a new session to plan a long focus window, split it into pomodoro-style focus and break
                  periods, and assign the tasks and habit occurrences you want to work through.
                </p>
                <Button className="gap-2" onClick={() => setIsSetupOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create A Focus Session
                </Button>
              </div>
            )}

            {isSetupOpen && (
              <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold">Create Focus Session</h2>
                    <p className="text-muted-foreground">
                      Choose the overall session length, then define the focus and break periods that repeat inside it.
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSetupOpen(false)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="session-duration">Overall session length</Label>
                    <Input id="session-duration" type="number" min="1" step={durationUnit === "hours" ? "0.5" : "5"} value={durationValue} onChange={event => setDurationValue(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration-unit">Unit</Label>
                    <select id="duration-unit" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={durationUnit} onChange={event => setDurationUnit(event.target.value as DurationUnit)}>
                      <option value="hours">Hours</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                    This session will run for <span className="font-semibold">{formatMinutes(totalDurationMinutes)}</span>.
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 mb-8">
                  <div className="space-y-2">
                    <Label htmlFor="focus-length">Focus period length</Label>
                    <Input id="focus-length" type="number" min="1" value={focusLength} onChange={event => setFocusLength(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Auto-populated to 30 minutes by default, but fully adjustable.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="break-length">Break period length</Label>
                    <Input id="break-length" type="number" min="1" value={breakLength} onChange={event => setBreakLength(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Auto-populated to 5 minutes by default, and used between focus periods.</p>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-background/60 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold">Available Tasks</h3>
                      </div>
                      <div className="space-y-3 max-h-80 overflow-auto pr-1">
                        {availableTaskPool.map(task => (
                          <div key={task.id} draggable onDragStart={handleDragStart({ sourceType: "task", sourceId: task.id })} className="flex cursor-grab items-start gap-3 rounded-lg border border-border bg-card p-4">
                            <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.priority} priority
                                {task.dueDate ? ` • due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                        {availableTaskPool.length === 0 && <p className="text-sm text-muted-foreground">All active tasks are already in the session.</p>}
                      </div>
                    </div>

                    <div onDragOver={event => event.preventDefault()} onDrop={handleDrop("task")} className="rounded-xl border border-dashed border-border bg-background/60 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Clock3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold">Tasks Inside This Session</h3>
                      </div>
                      <div className="space-y-3 min-h-24">
                        {selectedTaskIds.map(taskId => {
                          const task = activeTasks.find(entry => entry.id === taskId);
                          if (!task) return null;
                          return (
                            <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
                              <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">{task.priority} priority</p>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedTaskIds(current => current.filter(id => id !== task.id))}>
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                        {selectedTaskIds.length === 0 && <p className="text-sm text-muted-foreground">Drag tasks here to include them in the focus session.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-background/60 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="font-semibold">Available Habit Occurrences</h3>
                      </div>
                      <div className="space-y-3 max-h-80 overflow-auto pr-1">
                        {availableHabitPool.map(habit => (
                          <div key={habit.id} draggable onDragStart={handleDragStart({ sourceType: "habit", sourceId: habit.id })} className="flex cursor-grab items-start gap-3 rounded-lg border border-border bg-card p-4">
                            <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{habit.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">{habit.frequency} occurrence</p>
                            </div>
                          </div>
                        ))}
                        {availableHabitPool.length === 0 && <p className="text-sm text-muted-foreground">All habits are already assigned.</p>}
                      </div>
                    </div>

                    <div onDragOver={event => event.preventDefault()} onDrop={handleDrop("habit")} className="rounded-xl border border-dashed border-border bg-background/60 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Coffee className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="font-semibold">Habit Occurrences Inside This Session</h3>
                      </div>
                      <div className="space-y-3 min-h-24">
                        {selectedHabitIds.map(habitId => {
                          const habit = habits.find(entry => entry.id === habitId);
                          if (!habit) return null;
                          return (
                            <div key={habit.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
                              <div>
                                <p className="font-medium">{habit.title}</p>
                                <p className="text-xs text-muted-foreground capitalize">{habit.frequency} occurrence</p>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedHabitIds(current => current.filter(id => id !== habit.id))}>
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                        {selectedHabitIds.length === 0 && <p className="text-sm text-muted-foreground">Drag habit occurrences here to track them during the session.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    You can start another session later if this one gets paused, but not while one is active.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetSetupForm}>Reset Form</Button>
                    <Button className="gap-2" onClick={handleCreateSession} disabled={!canStartNewSession || totalDurationMinutes <= 0}>
                      <CirclePlay className="h-4 w-4" />
                      Start Session
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold">Focus Session History</h2>
              </div>
              <div className="space-y-4">
                {completedSessions.length > 0 ? (
                  completedSessions.map(session => (
                    <SessionHistoryCard
                      key={session.id}
                      session={session}
                      canResume={!activeSession}
                      isSelected={selectedHistorySession?.id === session.id}
                      onSelect={() => setSelectedHistorySessionId(session.id)}
                      onResume={() => void resumeFocusSession(session.id)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No focus sessions yet.</p>
                )}
              </div>
            </div>

            {selectedHistorySession && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4">
                  <h2 className="font-semibold">Session Details</h2>
                  <p className="text-sm text-muted-foreground capitalize">
                    {getSessionStatusLabel(selectedHistorySession)}
                  </p>
                </div>
                <div className="space-y-3">
                  {selectedHistorySession.items.length > 0 ? (
                    selectedHistorySession.items.map(item => {
                      const status = item.completedInSessionAt
                        ? "Completed in session"
                        : isItemDoneOverall(selectedHistorySession, item)
                        ? "Completed outside session"
                        : "Not completed";

                      return (
                        <div key={item.id} className="rounded-lg border border-border p-4">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.sourceType === "habit" ? "Habit occurrence" : "Task"}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{status}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">This session had no linked tasks or habit occurrences.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-50 to-blue-50 p-6 dark:from-emerald-950/20 dark:to-blue-950/20">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-semibold">Session Rules</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>One focus session can be active at a time.</li>
                <li>Paused sessions stay visible and can be resumed later.</li>
                <li>Tasks or habit occurrences completed here also sync back to their own modules.</li>
                <li>Items completed elsewhere show up as done here without counting as an in-session completion.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
