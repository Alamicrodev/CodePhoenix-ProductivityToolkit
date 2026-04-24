import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "../lib/api";
import { useAuth } from "./AuthContext";

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  dueTime: string | null;
  subtasks: {
    id: string;
    title: string;
    completed: boolean;
    priority: "low" | "medium" | "high";
    dueDate: string | null;
    dueTime: string | null;
  }[];
  tags: string[];
  quadrant?: "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  frequency: "hourly" | "daily" | "weekly";
  hourlyInterval?: number;
  activeHours?: { start: string; end: string };
  activeDays?: number[];
  streak: number;
  lastCompleted: string | null;
  completedDates: string[];
  occurrences?: Array<{
    timestamp: string;
    status: "completed" | "skipped" | "missed";
  }>;
}

export type FocusSessionStatus = "active" | "paused" | "completed" | "quit";
export type FocusSessionPhase = "focus" | "break";
export type FocusSessionItemType = "task" | "habit";
export type FocusSessionCompletionResult = "successful" | "unsuccessful" | null;

export interface FocusSessionItem {
  id: string;
  sourceId: string;
  sourceType: FocusSessionItemType;
  title: string;
  addedAt: string;
  completedInSessionAt: string | null;
}

export interface FocusSession {
  id: string;
  title: string;
  totalDurationMinutes: number;
  focusLengthMinutes: number;
  breakLengthMinutes: number;
  elapsedSeconds: number;
  phaseType: FocusSessionPhase;
  phaseRemainingSeconds: number;
  status: FocusSessionStatus;
  completionResult: FocusSessionCompletionResult;
  completed: boolean;
  completedFocusBlocks: number;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  pausedAt: string | null;
  endedAt: string | null;
  items: FocusSessionItem[];
}

interface CreateFocusSessionInput {
  totalDurationMinutes: number;
  focusLengthMinutes: number;
  breakLengthMinutes: number;
  taskIds: string[];
  habitIds: string[];
}

interface DataContextType {
  tasks: Task[];
  habits: Habit[];
  focusSessions: FocusSession[];
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addHabit: (habit: Omit<Habit, "id">) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  completeHabit: (id: string) => Promise<string | null>;
  undoCompleteHabit: (id: string, completionTimestamp: string) => Promise<void>;
  createFocusSession: (input: CreateFocusSessionInput) => Promise<string | null>;
  pauseFocusSession: (id: string) => Promise<void>;
  resumeFocusSession: (id: string) => Promise<boolean>;
  completeFocusSession: (id: string) => Promise<void>;
  quitFocusSession: (id: string) => Promise<void>;
  markFocusSessionItemComplete: (sessionId: string, itemId: string) => Promise<void>;
}

interface ApiSubtask {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  due_time: string | null;
}

interface ApiTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completed_at: string | null;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  due_time: string | null;
  tags: string[];
  quadrant: Task["quadrant"];
  subtasks: ApiSubtask[];
}

interface ApiHabitOccurrence {
  id: string;
  timestamp: string;
  status: "completed" | "skipped" | "missed";
}

interface ApiHabit {
  id: string;
  title: string;
  description: string;
  frequency: Habit["frequency"];
  hourly_interval: number | null;
  active_hours: { start: string; end: string } | null;
  active_days: number[];
  streak: number;
  last_completed: string | null;
  completed_dates: string[];
  occurrences: ApiHabitOccurrence[];
}

interface ApiFocusSessionItem {
  id: string;
  source_id: string;
  source_type: FocusSessionItemType;
  title: string;
  added_at: string;
  completed_in_session_at: string | null;
}

interface ApiFocusSession {
  id: string;
  title: string;
  total_duration_minutes: number;
  focus_length_minutes: number;
  break_length_minutes: number;
  elapsed_seconds: number;
  phase_type: FocusSessionPhase;
  phase_remaining_seconds: number;
  status: FocusSessionStatus;
  completion_result: FocusSessionCompletionResult;
  completed: boolean;
  completed_focus_blocks: number;
  created_at: string;
  started_at: string;
  updated_at: string;
  paused_at: string | null;
  ended_at: string | null;
  items: ApiFocusSessionItem[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);
const MINUTE_IN_SECONDS = 60;

function formatSessionTitle(totalDurationMinutes: number) {
  if (totalDurationMinutes >= 60) {
    const hours = totalDurationMinutes / 60;
    return Number.isInteger(hours) ? `${hours} hour focus session` : `${hours.toFixed(1)} hour focus session`;
  }

  return `${totalDurationMinutes} minute focus session`;
}

function getPhaseDurationSeconds(
  session: Pick<FocusSession, "totalDurationMinutes" | "focusLengthMinutes" | "breakLengthMinutes" | "elapsedSeconds">,
  phaseType: FocusSessionPhase,
) {
  const totalSeconds = session.totalDurationMinutes * MINUTE_IN_SECONDS;
  const remainingSessionSeconds = Math.max(totalSeconds - session.elapsedSeconds, 0);
  const requestedPhaseSeconds =
    (phaseType === "focus" ? session.focusLengthMinutes : session.breakLengthMinutes) * MINUTE_IN_SECONDS;

  return Math.max(Math.min(requestedPhaseSeconds, remainingSessionSeconds), 0);
}

function tickFocusSession(session: FocusSession): FocusSession {
  if (session.status !== "active") {
    return session;
  }

  const now = new Date().toISOString();
  const totalSeconds = session.totalDurationMinutes * MINUTE_IN_SECONDS;
  const nextElapsedSeconds = Math.min(session.elapsedSeconds + 1, totalSeconds);

  if (nextElapsedSeconds >= totalSeconds) {
    return {
      ...session,
      elapsedSeconds: totalSeconds,
      phaseRemainingSeconds: 0,
      status: "completed",
      completionResult: session.items.every(item => item.completedInSessionAt) ? "successful" : "unsuccessful",
      completed: true,
      endedAt: now,
      updatedAt: now,
      completedFocusBlocks:
        session.phaseType === "focus" ? session.completedFocusBlocks + 1 : session.completedFocusBlocks,
    };
  }

  const nextPhaseRemainingSeconds = session.phaseRemainingSeconds - 1;

  if (nextPhaseRemainingSeconds > 0) {
    return {
      ...session,
      elapsedSeconds: nextElapsedSeconds,
      phaseRemainingSeconds: nextPhaseRemainingSeconds,
      updatedAt: now,
    };
  }

  const nextPhaseType: FocusSessionPhase = session.phaseType === "focus" ? "break" : "focus";

  return {
    ...session,
    elapsedSeconds: nextElapsedSeconds,
    phaseType: nextPhaseType,
    phaseRemainingSeconds: getPhaseDurationSeconds(
      {
        totalDurationMinutes: session.totalDurationMinutes,
        focusLengthMinutes: session.focusLengthMinutes,
        breakLengthMinutes: session.breakLengthMinutes,
        elapsedSeconds: nextElapsedSeconds,
      },
      nextPhaseType,
    ),
    completedFocusBlocks:
      session.phaseType === "focus" ? session.completedFocusBlocks + 1 : session.completedFocusBlocks,
    updatedAt: now,
  };
}

function mapTaskFromApi(task: ApiTask): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completed_at,
    priority: task.priority,
    dueDate: task.due_date,
    dueTime: task.due_time,
    tags: task.tags || [],
    quadrant: task.quadrant,
    subtasks: (task.subtasks || []).map(subtask => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed,
      priority: subtask.priority,
      dueDate: subtask.due_date,
      dueTime: subtask.due_time,
    })),
  };
}

function mapHabitFromApi(habit: ApiHabit): Habit {
  return {
    id: habit.id,
    title: habit.title,
    description: habit.description,
    frequency: habit.frequency,
    hourlyInterval: habit.hourly_interval ?? undefined,
    activeHours: habit.active_hours ?? undefined,
    activeDays: habit.active_days || [],
    streak: habit.streak,
    lastCompleted: habit.last_completed,
    completedDates: habit.completed_dates || [],
    occurrences: (habit.occurrences || []).map(occurrence => ({
      timestamp: occurrence.timestamp,
      status: occurrence.status,
    })),
  };
}

function mapFocusSessionFromApi(session: ApiFocusSession): FocusSession {
  return {
    id: session.id,
    title: session.title,
    totalDurationMinutes: session.total_duration_minutes,
    focusLengthMinutes: session.focus_length_minutes,
    breakLengthMinutes: session.break_length_minutes,
    elapsedSeconds: session.elapsed_seconds,
    phaseType: session.phase_type,
    phaseRemainingSeconds: session.phase_remaining_seconds,
    status: session.status,
    completionResult: session.completion_result,
    completed: session.completed,
    completedFocusBlocks: session.completed_focus_blocks,
    createdAt: session.created_at,
    startedAt: session.started_at,
    updatedAt: session.updated_at,
    pausedAt: session.paused_at,
    endedAt: session.ended_at,
    items: (session.items || []).map(item => ({
      id: item.id,
      sourceId: item.source_id,
      sourceType: item.source_type,
      title: item.title,
      addedAt: item.added_at,
      completedInSessionAt: item.completed_in_session_at,
    })),
  };
}

function buildTaskSubtasksPayload(subtasks: Task["subtasks"]) {
  return subtasks.map(subtask => ({
    title: subtask.title,
    completed: subtask.completed,
    priority: subtask.priority,
    due_date: subtask.dueDate,
    due_time: subtask.dueTime,
  }));
}

function buildTaskCreatePayload(task: Omit<Task, "id">) {
  return {
    title: task.title,
    description: task.description,
    completed: task.completed,
    completed_at: task.completedAt,
    priority: task.priority,
    due_date: task.dueDate,
    due_time: task.dueTime,
    tags: task.tags,
    quadrant: task.quadrant ?? null,
    subtasks: buildTaskSubtasksPayload(task.subtasks),
  };
}

function buildTaskUpdatePayload(updates: Partial<Task>) {
  const payload: Record<string, unknown> = {};

  if ("title" in updates) payload.title = updates.title;
  if ("description" in updates) payload.description = updates.description;
  if ("completed" in updates) payload.completed = updates.completed;
  if ("completedAt" in updates) payload.completed_at = updates.completedAt;
  if ("priority" in updates) payload.priority = updates.priority;
  if ("dueDate" in updates) payload.due_date = updates.dueDate;
  if ("dueTime" in updates) payload.due_time = updates.dueTime;
  if ("tags" in updates) payload.tags = updates.tags;
  if ("quadrant" in updates) payload.quadrant = updates.quadrant ?? null;
  if ("subtasks" in updates && updates.subtasks) payload.subtasks = buildTaskSubtasksPayload(updates.subtasks);

  return payload;
}

function buildHabitOccurrencesPayload(occurrences: NonNullable<Habit["occurrences"]>) {
  return occurrences.map(occurrence => ({
    timestamp: occurrence.timestamp,
    status: occurrence.status,
  }));
}

function buildHabitCreatePayload(habit: Omit<Habit, "id">) {
  return {
    title: habit.title,
    description: habit.description,
    frequency: habit.frequency,
    hourly_interval: habit.hourlyInterval ?? null,
    active_hours: habit.activeHours ?? null,
    active_days: habit.activeDays ?? [],
    streak: habit.streak,
    last_completed: habit.lastCompleted,
    completed_dates: habit.completedDates,
    occurrences: buildHabitOccurrencesPayload(habit.occurrences || []),
  };
}

function buildHabitUpdatePayload(updates: Partial<Habit>) {
  const payload: Record<string, unknown> = {};

  if ("title" in updates) payload.title = updates.title;
  if ("description" in updates) payload.description = updates.description;
  if ("frequency" in updates) payload.frequency = updates.frequency;
  if ("hourlyInterval" in updates) payload.hourly_interval = updates.hourlyInterval ?? null;
  if ("activeHours" in updates) payload.active_hours = updates.activeHours ?? null;
  if ("activeDays" in updates) payload.active_days = updates.activeDays ?? [];
  if ("streak" in updates) payload.streak = updates.streak;
  if ("lastCompleted" in updates) payload.last_completed = updates.lastCompleted;
  if ("completedDates" in updates) payload.completed_dates = updates.completedDates ?? [];
  if ("occurrences" in updates && updates.occurrences) {
    payload.occurrences = buildHabitOccurrencesPayload(updates.occurrences);
  }

  return payload;
}

function buildFocusSessionUpdatePayload(session: FocusSession) {
  return {
    elapsed_seconds: session.elapsedSeconds,
    phase_type: session.phaseType,
    phase_remaining_seconds: session.phaseRemainingSeconds,
    status: session.status,
    completion_result: session.completionResult,
    completed: session.completed,
    completed_focus_blocks: session.completedFocusBlocks,
    paused_at: session.pausedAt,
    ended_at: session.endedAt,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isLoading: isAuthLoading, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  const handleApiError = useCallback(
    (error: unknown, fallbackMessage: string, showToast = true) => {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        if (showToast) {
          toast.error("Your session expired. Please sign in again.");
        }
        return;
      }

      console.error(fallbackMessage, error);

      if (showToast) {
        toast.error(error instanceof Error ? error.message : fallbackMessage);
      }
    },
    [logout],
  );

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user || !accessToken) {
      setTasks([]);
      setHabits([]);
      setFocusSessions([]);
      return;
    }

    let isCancelled = false;

    const loadWorkspace = async () => {
      try {
        const [taskResponse, habitResponse, focusSessionResponse] = await Promise.all([
          apiRequest<ApiTask[]>("/tasks", { token: accessToken }),
          apiRequest<ApiHabit[]>("/habits", { token: accessToken }),
          apiRequest<ApiFocusSession[]>("/focus-sessions", { token: accessToken }),
        ]);

        if (isCancelled) {
          return;
        }

        setTasks(taskResponse.map(mapTaskFromApi));
        setHabits(habitResponse.map(mapHabitFromApi));
        setFocusSessions(focusSessionResponse.map(mapFocusSessionFromApi));
      } catch (error) {
        if (!isCancelled) {
          handleApiError(error, "Failed to load workspace.");
        }
      }
    };

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, handleApiError, isAuthLoading, user]);

  const addTask = useCallback(
    async (task: Omit<Task, "id">) => {
      if (!accessToken) {
        return;
      }

      try {
        const createdTask = await apiRequest<ApiTask>("/tasks", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(buildTaskCreatePayload(task)),
        });

        setTasks(currentTasks => [mapTaskFromApi(createdTask), ...currentTasks]);
      } catch (error) {
        handleApiError(error, "Failed to create task.");
      }
    },
    [accessToken, handleApiError],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      if (!accessToken) {
        return;
      }

      try {
        const updatedTask = await apiRequest<ApiTask>(`/tasks/${id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(buildTaskUpdatePayload(updates)),
        });

        setTasks(currentTasks =>
          currentTasks.map(task => (task.id === id ? mapTaskFromApi(updatedTask) : task)),
        );
      } catch (error) {
        handleApiError(error, "Failed to update task.");
      }
    },
    [accessToken, handleApiError],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!accessToken) {
        return;
      }

      try {
        await apiRequest(`/tasks/${id}`, {
          method: "DELETE",
          token: accessToken,
        });

        setTasks(currentTasks => currentTasks.filter(task => task.id !== id));
      } catch (error) {
        handleApiError(error, "Failed to delete task.");
      }
    },
    [accessToken, handleApiError],
  );

  const addHabit = useCallback(
    async (habit: Omit<Habit, "id">) => {
      if (!accessToken) {
        return;
      }

      try {
        const createdHabit = await apiRequest<ApiHabit>("/habits", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(buildHabitCreatePayload(habit)),
        });

        setHabits(currentHabits => [mapHabitFromApi(createdHabit), ...currentHabits]);
      } catch (error) {
        handleApiError(error, "Failed to create habit.");
      }
    },
    [accessToken, handleApiError],
  );

  const updateHabit = useCallback(
    async (id: string, updates: Partial<Habit>) => {
      if (!accessToken) {
        return;
      }

      try {
        const updatedHabit = await apiRequest<ApiHabit>(`/habits/${id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(buildHabitUpdatePayload(updates)),
        });

        setHabits(currentHabits =>
          currentHabits.map(habit => (habit.id === id ? mapHabitFromApi(updatedHabit) : habit)),
        );
      } catch (error) {
        handleApiError(error, "Failed to update habit.");
      }
    },
    [accessToken, handleApiError],
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      if (!accessToken) {
        return;
      }

      try {
        await apiRequest(`/habits/${id}`, {
          method: "DELETE",
          token: accessToken,
        });

        setHabits(currentHabits => currentHabits.filter(habit => habit.id !== id));
      } catch (error) {
        handleApiError(error, "Failed to delete habit.");
      }
    },
    [accessToken, handleApiError],
  );

  const completeHabit = useCallback(
    async (id: string) => {
      if (!accessToken) {
        return null;
      }

      try {
        const completedHabit = await apiRequest<ApiHabit>(`/habits/${id}/complete`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ timestamp: new Date().toISOString() }),
        });

        const mappedHabit = mapHabitFromApi(completedHabit);
        const completionTimestamp = mappedHabit.completedDates[mappedHabit.completedDates.length - 1] || null;

        setHabits(currentHabits =>
          currentHabits.map(habit => (habit.id === id ? mappedHabit : habit)),
        );

        return completionTimestamp;
      } catch (error) {
        handleApiError(error, "Failed to complete habit.");
        return null;
      }
    },
    [accessToken, handleApiError],
  );

  const undoCompleteHabit = useCallback(
    async (id: string, completionTimestamp: string) => {
      if (!accessToken) {
        return;
      }

      try {
        const updatedHabit = await apiRequest<ApiHabit>(`/habits/${id}/undo`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ completion_timestamp: completionTimestamp }),
        });

        setHabits(currentHabits =>
          currentHabits.map(habit => (habit.id === id ? mapHabitFromApi(updatedHabit) : habit)),
        );
      } catch (error) {
        handleApiError(error, "Failed to undo habit completion.");
      }
    },
    [accessToken, handleApiError],
  );

  const persistFocusSession = useCallback(
    async (session: FocusSession, showToast = false) => {
      if (!accessToken) {
        return;
      }

      try {
        const updatedSession = await apiRequest<ApiFocusSession>(`/focus-sessions/${session.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(buildFocusSessionUpdatePayload(session)),
        });

        setFocusSessions(currentSessions =>
          currentSessions.map(entry =>
            entry.id === session.id ? mapFocusSessionFromApi(updatedSession) : entry,
          ),
        );
      } catch (error) {
        handleApiError(error, "Failed to sync focus session.", showToast);
      }
    },
    [accessToken, handleApiError],
  );

  const createFocusSession = useCallback(
    async (input: CreateFocusSessionInput) => {
      if (!accessToken || focusSessions.some(session => session.status === "active")) {
        return null;
      }

      const now = new Date().toISOString();
      const taskItems = input.taskIds
        .map(taskId => tasks.find(task => task.id === taskId))
        .filter((task): task is Task => Boolean(task))
        .map(task => ({
          source_id: task.id,
          source_type: "task" as const,
          title: task.title,
          added_at: now,
          completed_in_session_at: null,
        }));
      const habitItems = input.habitIds
        .map(habitId => habits.find(habit => habit.id === habitId))
        .filter((habit): habit is Habit => Boolean(habit))
        .map(habit => ({
          source_id: habit.id,
          source_type: "habit" as const,
          title: habit.title,
          added_at: now,
          completed_in_session_at: null,
        }));

      try {
        const createdSession = await apiRequest<ApiFocusSession>("/focus-sessions", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            title: formatSessionTitle(input.totalDurationMinutes),
            total_duration_minutes: input.totalDurationMinutes,
            focus_length_minutes: input.focusLengthMinutes,
            break_length_minutes: input.breakLengthMinutes,
            elapsed_seconds: 0,
            phase_type: "focus",
            phase_remaining_seconds: Math.min(
              input.focusLengthMinutes * MINUTE_IN_SECONDS,
              input.totalDurationMinutes * MINUTE_IN_SECONDS,
            ),
            status: "active",
            completion_result: null,
            completed: false,
            completed_focus_blocks: 0,
            started_at: now,
            paused_at: null,
            ended_at: null,
            items: [...taskItems, ...habitItems],
          }),
        });

        const mappedSession = mapFocusSessionFromApi(createdSession);
        setFocusSessions(currentSessions => [mappedSession, ...currentSessions]);
        return mappedSession.id;
      } catch (error) {
        handleApiError(error, "Failed to create focus session.");
        return null;
      }
    },
    [accessToken, focusSessions, habits, handleApiError, tasks],
  );

  const pauseFocusSession = useCallback(
    async (id: string) => {
      const session = focusSessions.find(entry => entry.id === id);
      if (!session) {
        return;
      }

      const now = new Date().toISOString();
      const updatedSession: FocusSession = {
        ...session,
        status: "paused",
        pausedAt: now,
        updatedAt: now,
      };

      setFocusSessions(currentSessions =>
        currentSessions.map(entry => (entry.id === id ? updatedSession : entry)),
      );
      await persistFocusSession(updatedSession, true);
    },
    [focusSessions, persistFocusSession],
  );

  const resumeFocusSession = useCallback(
    async (id: string) => {
      if (focusSessions.some(session => session.id !== id && session.status === "active")) {
        return false;
      }

      const session = focusSessions.find(entry => entry.id === id);
      if (!session) {
        return false;
      }

      const updatedSession: FocusSession = {
        ...session,
        status: "active",
        pausedAt: null,
        updatedAt: new Date().toISOString(),
      };

      setFocusSessions(currentSessions =>
        currentSessions.map(entry => (entry.id === id ? updatedSession : entry)),
      );
      await persistFocusSession(updatedSession, true);
      return true;
    },
    [focusSessions, persistFocusSession],
  );

  const completeFocusSession = useCallback(
    async (id: string) => {
      const session = focusSessions.find(entry => entry.id === id);
      if (!session) {
        return;
      }

      const now = new Date().toISOString();
      const updatedSession: FocusSession = {
        ...session,
        status: "completed",
        completionResult: session.items.every(item => item.completedInSessionAt)
          ? "successful"
          : "unsuccessful",
        completed: true,
        phaseRemainingSeconds: 0,
        pausedAt: null,
        endedAt: now,
        updatedAt: now,
      };

      setFocusSessions(currentSessions =>
        currentSessions.map(entry => (entry.id === id ? updatedSession : entry)),
      );
      await persistFocusSession(updatedSession, true);
    },
    [focusSessions, persistFocusSession],
  );

  const quitFocusSession = useCallback(
    async (id: string) => {
      const session = focusSessions.find(entry => entry.id === id);
      if (!session) {
        return;
      }

      const now = new Date().toISOString();
      const updatedSession: FocusSession = {
        ...session,
        status: "quit",
        completionResult: null,
        completed: false,
        pausedAt: null,
        endedAt: now,
        updatedAt: now,
      };

      setFocusSessions(currentSessions =>
        currentSessions.map(entry => (entry.id === id ? updatedSession : entry)),
      );
      await persistFocusSession(updatedSession, true);
    },
    [focusSessions, persistFocusSession],
  );

  const markFocusSessionItemComplete = useCallback(
    async (sessionId: string, itemId: string) => {
      if (!accessToken) {
        return;
      }

      const session = focusSessions.find(entry => entry.id === sessionId);
      const item = session?.items.find(entry => entry.id === itemId);

      if (!session || !item) {
        return;
      }

      const completedAt = new Date().toISOString();

      if (item.sourceType === "task") {
        await updateTask(item.sourceId, {
          completed: true,
          completedAt,
        });
      } else {
        await completeHabit(item.sourceId);
      }

      try {
        const updatedSession = await apiRequest<ApiFocusSession>(
          `/focus-sessions/${sessionId}/items/${itemId}/complete`,
          {
            method: "POST",
            token: accessToken,
            body: JSON.stringify({ timestamp: completedAt }),
          },
        );

        setFocusSessions(currentSessions =>
          currentSessions.map(entry =>
            entry.id === sessionId ? mapFocusSessionFromApi(updatedSession) : entry,
          ),
        );
      } catch (error) {
        handleApiError(error, "Failed to complete focus session item.");
      }
    },
    [accessToken, completeHabit, focusSessions, handleApiError, updateTask],
  );

  const hasActiveFocusSession = useMemo(
    () => focusSessions.some(session => session.status === "active"),
    [focusSessions],
  );

  useEffect(() => {
    if (!hasActiveFocusSession) {
      return;
    }

    const interval = window.setInterval(() => {
      let sessionToSync: FocusSession | null = null;

      setFocusSessions(currentSessions =>
        currentSessions.map(session => {
          if (session.status !== "active") {
            return session;
          }

          sessionToSync = tickFocusSession(session);
          return sessionToSync;
        }),
      );

      if (sessionToSync) {
        void persistFocusSession(sessionToSync);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasActiveFocusSession, persistFocusSession]);

  const value = useMemo(
    () => ({
      tasks,
      habits,
      focusSessions,
      addTask,
      updateTask,
      deleteTask,
      addHabit,
      updateHabit,
      deleteHabit,
      completeHabit,
      undoCompleteHabit,
      createFocusSession,
      pauseFocusSession,
      resumeFocusSession,
      completeFocusSession,
      quitFocusSession,
      markFocusSessionItemComplete,
    }),
    [
      addHabit,
      addTask,
      completeFocusSession,
      completeHabit,
      createFocusSession,
      deleteHabit,
      deleteTask,
      focusSessions,
      habits,
      markFocusSessionItemComplete,
      pauseFocusSession,
      quitFocusSession,
      resumeFocusSession,
      tasks,
      undoCompleteHabit,
      updateHabit,
      updateTask,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
