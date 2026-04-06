import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

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
  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addHabit: (habit: Omit<Habit, "id">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  completeHabit: (id: string) => string | null;
  undoCompleteHabit: (id: string, completionTimestamp: string) => void;
  createFocusSession: (input: CreateFocusSessionInput) => string | null;
  pauseFocusSession: (id: string) => void;
  resumeFocusSession: (id: string) => boolean;
  completeFocusSession: (id: string) => void;
  quitFocusSession: (id: string) => void;
  markFocusSessionItemComplete: (sessionId: string, itemId: string) => void;
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

function getPhaseDurationSeconds(session: Pick<FocusSession, "totalDurationMinutes" | "focusLengthMinutes" | "breakLengthMinutes" | "elapsedSeconds">, phaseType: FocusSessionPhase) {
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

function normalizeStoredFocusSession(session: any): FocusSession {
  if (session.totalDurationMinutes) {
    return {
      id: session.id ?? Date.now().toString(),
      title: session.title ?? formatSessionTitle(session.totalDurationMinutes),
      totalDurationMinutes: session.totalDurationMinutes,
      focusLengthMinutes: session.focusLengthMinutes ?? 30,
      breakLengthMinutes: session.breakLengthMinutes ?? 5,
      elapsedSeconds: session.elapsedSeconds ?? 0,
      phaseType: session.phaseType ?? "focus",
      phaseRemainingSeconds:
        session.phaseRemainingSeconds ??
        getPhaseDurationSeconds(
          {
            totalDurationMinutes: session.totalDurationMinutes,
            focusLengthMinutes: session.focusLengthMinutes ?? 30,
            breakLengthMinutes: session.breakLengthMinutes ?? 5,
            elapsedSeconds: session.elapsedSeconds ?? 0,
          },
          session.phaseType ?? "focus",
        ),
      status: session.status ?? (session.completed ? "completed" : "paused"),
      completionResult: session.completionResult ?? (session.completed ? "successful" : null),
      completed: Boolean(session.completed),
      completedFocusBlocks: session.completedFocusBlocks ?? 0,
      createdAt: session.createdAt ?? session.startedAt ?? new Date().toISOString(),
      startedAt: session.startedAt ?? session.startTime ?? new Date().toISOString(),
      updatedAt: session.updatedAt ?? new Date().toISOString(),
      pausedAt: session.pausedAt ?? null,
      endedAt: session.endedAt ?? session.endTime ?? null,
      items: Array.isArray(session.items) ? session.items : [],
    };
  }

  const totalDurationMinutes = session.duration ?? 25;
  const startedAt = session.startTime ?? new Date().toISOString();
  const completed = Boolean(session.completed);

  return {
    id: session.id ?? Date.now().toString(),
    title: formatSessionTitle(totalDurationMinutes),
    totalDurationMinutes,
    focusLengthMinutes: Math.min(totalDurationMinutes, 25),
    breakLengthMinutes: 5,
    elapsedSeconds: completed ? totalDurationMinutes * MINUTE_IN_SECONDS : 0,
    phaseType: "focus",
    phaseRemainingSeconds: completed ? 0 : totalDurationMinutes * MINUTE_IN_SECONDS,
    status: completed ? "completed" : "paused",
    completionResult: completed ? "successful" : null,
    completed,
    completedFocusBlocks: completed ? 1 : 0,
    createdAt: startedAt,
    startedAt,
    updatedAt: session.endTime ?? startedAt,
    pausedAt: completed ? null : startedAt,
    endedAt: session.endTime ?? null,
    items: [
      ...(session.taskId
        ? [
            {
              id: `${session.id}-task`,
              sourceId: session.taskId,
              sourceType: "task" as const,
              title: "Linked task",
              addedAt: startedAt,
              completedInSessionAt: null,
            },
          ]
        : []),
      ...(session.habitId
        ? [
            {
              id: `${session.id}-habit`,
              sourceId: session.habitId,
              sourceType: "habit" as const,
              title: "Linked habit occurrence",
              addedAt: startedAt,
              completedInSessionAt: null,
            },
          ]
        : []),
    ],
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    const storedTasks = localStorage.getItem("tasks");
    const storedHabits = localStorage.getItem("habits");
    const storedSessions = localStorage.getItem("focusSessions");

    if (storedTasks) {
      setTasks(JSON.parse(storedTasks));
    } else {
      const sampleTasks: Task[] = [
        {
          id: "1",
          title: "Review quarterly goals and update roadmap",
          description: "Analyze Q1 performance and plan for Q2",
          completed: false,
          completedAt: null,
          priority: "high",
          dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
          dueTime: "10:00",
          subtasks: [
            {
              id: "1-1",
              title: "Gather Q1 metrics",
              completed: true,
              priority: "high",
              dueDate: new Date(Date.now() + 1 * 86400000).toISOString().split("T")[0],
              dueTime: "09:00",
            },
            {
              id: "1-2",
              title: "Schedule team review",
              completed: false,
              priority: "medium",
              dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
              dueTime: "11:00",
            },
          ],
          tags: [],
        },
        {
          id: "2",
          title: "Prepare presentation for team meeting",
          description: "Create slides for the weekly sync",
          completed: true,
          completedAt: new Date(Date.now() - 86400000 + 3600000).toISOString(),
          priority: "medium",
          dueDate: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          dueTime: "14:00",
          subtasks: [],
          tags: [],
        },
        {
          id: "3",
          title: "Update project documentation",
          description: "Add new features to the docs",
          completed: false,
          completedAt: null,
          priority: "low",
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          dueTime: "09:30",
          subtasks: [
            {
              id: "3-1",
              title: "Update API docs",
              completed: false,
              priority: "low",
              dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
              dueTime: "10:00",
            },
          ],
          tags: [],
        },
        {
          id: "4",
          title: "Complete code review",
          description: "Review pull requests from team members",
          completed: false,
          completedAt: null,
          priority: "high",
          dueDate: new Date().toISOString().split("T")[0],
          dueTime: "15:00",
          subtasks: [],
          tags: [],
        },
      ];
      setTasks(sampleTasks);
    }

    if (storedHabits) {
      setHabits(JSON.parse(storedHabits));
    } else {
      const sampleHabits: Habit[] = [
        {
          id: "1",
          title: "Morning Meditation",
          description: "10 minutes of mindfulness practice",
          frequency: "daily",
          streak: 5,
          lastCompleted: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          completedDates: [
            new Date(Date.now() - 86400000).toISOString().split("T")[0],
            new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
          ],
        },
        {
          id: "2",
          title: "Exercise",
          description: "30 minutes of physical activity",
          frequency: "daily",
          streak: 3,
          lastCompleted: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          completedDates: [new Date(Date.now() - 86400000).toISOString().split("T")[0]],
        },
      ];
      setHabits(sampleHabits);
    }

    if (storedSessions) {
      setFocusSessions(JSON.parse(storedSessions).map(normalizeStoredFocusSession));
    } else {
      const sampleSessions: FocusSession[] = [
        {
          id: "1",
          title: "30 minute focus session",
          totalDurationMinutes: 30,
          focusLengthMinutes: 25,
          breakLengthMinutes: 5,
          elapsedSeconds: 1800,
          phaseType: "focus",
          phaseRemainingSeconds: 0,
          status: "completed",
          completionResult: "successful",
          completed: true,
          completedFocusBlocks: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          startedAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
          pausedAt: null,
          endedAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
          items: [],
        },
      ];
      setFocusSessions(sampleSessions);
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0 || localStorage.getItem("tasks")) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }
  }, [tasks]);

  useEffect(() => {
    if (habits.length > 0 || localStorage.getItem("habits")) {
      localStorage.setItem("habits", JSON.stringify(habits));
    }
  }, [habits]);

  useEffect(() => {
    if (focusSessions.length > 0 || localStorage.getItem("focusSessions")) {
      localStorage.setItem("focusSessions", JSON.stringify(focusSessions));
    }
  }, [focusSessions]);

  const hasActiveFocusSession = useMemo(
    () => focusSessions.some(session => session.status === "active"),
    [focusSessions],
  );

  useEffect(() => {
    if (!hasActiveFocusSession) {
      return;
    }

    const interval = window.setInterval(() => {
      setFocusSessions(currentSessions => currentSessions.map(tickFocusSession));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasActiveFocusSession]);

  const addTask = (task: Omit<Task, "id">) => {
    const newTask = { ...task, id: Date.now().toString() };
    setTasks(currentTasks => [...currentTasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(currentTasks => currentTasks.map(task => (task.id === id ? { ...task, ...updates } : task)));
  };

  const deleteTask = (id: string) => {
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id));
  };

  const addHabit = (habit: Omit<Habit, "id">) => {
    const newHabit = { ...habit, id: Date.now().toString() };
    setHabits(currentHabits => [...currentHabits, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setHabits(currentHabits => currentHabits.map(habit => (habit.id === id ? { ...habit, ...updates } : habit)));
  };

  const deleteHabit = (id: string) => {
    setHabits(currentHabits => currentHabits.filter(habit => habit.id !== id));
  };

  const completeHabit = (id: string): string | null => {
    const today = new Date().toISOString().split("T")[0];
    const currentHour = new Date().toISOString().slice(0, 13);
    let completionTimestamp: string | null = null;

    setHabits(currentHabits =>
      currentHabits.map(habit => {
        if (habit.id !== id) {
          return habit;
        }

        const alreadyCompleted =
          habit.frequency === "hourly"
            ? habit.completedDates.some(date => date.startsWith(currentHour))
            : habit.completedDates.includes(today);

        if (alreadyCompleted) {
          return habit;
        }

        completionTimestamp = habit.frequency === "hourly" ? new Date().toISOString() : today;

        return {
          ...habit,
          streak: habit.streak + 1,
          lastCompleted: today,
          completedDates: [...habit.completedDates, completionTimestamp],
          occurrences: [
            ...(habit.occurrences || []),
            { timestamp: new Date().toISOString(), status: "completed" as const },
          ],
        };
      }),
    );

    return completionTimestamp;
  };

  const undoCompleteHabit = (id: string, completionTimestamp: string) => {
    setHabits(currentHabits =>
      currentHabits.map(habit => {
        if (habit.id !== id) {
          return habit;
        }

        const newCompletedDates = habit.completedDates.filter(date => date !== completionTimestamp);
        const newStreak = newCompletedDates.length;
        const newLastCompleted =
          newCompletedDates.length > 0 ? newCompletedDates[newCompletedDates.length - 1] : null;

        return {
          ...habit,
          streak: newStreak,
          lastCompleted: newLastCompleted,
          completedDates: newCompletedDates,
          occurrences: (habit.occurrences || []).filter(
            occurrence => occurrence.timestamp !== completionTimestamp,
          ),
        };
      }),
    );
  };

  const createFocusSession = (input: CreateFocusSessionInput) => {
    if (focusSessions.some(session => session.status === "active")) {
      return null;
    }

    const now = new Date().toISOString();
    const taskItems = input.taskIds
      .map(taskId => tasks.find(task => task.id === taskId))
      .filter((task): task is Task => Boolean(task))
      .map(task => ({
        id: `${task.id}-${Date.now()}-task`,
        sourceId: task.id,
        sourceType: "task" as const,
        title: task.title,
        addedAt: now,
        completedInSessionAt: null,
      }));

    const habitItems = input.habitIds
      .map(habitId => habits.find(habit => habit.id === habitId))
      .filter((habit): habit is Habit => Boolean(habit))
      .map(habit => ({
        id: `${habit.id}-${Date.now()}-habit`,
        sourceId: habit.id,
        sourceType: "habit" as const,
        title: habit.title,
        addedAt: now,
        completedInSessionAt: null,
      }));

    const newSession: FocusSession = {
      id: Date.now().toString(),
      title: formatSessionTitle(input.totalDurationMinutes),
      totalDurationMinutes: input.totalDurationMinutes,
      focusLengthMinutes: input.focusLengthMinutes,
      breakLengthMinutes: input.breakLengthMinutes,
      elapsedSeconds: 0,
      phaseType: "focus",
      phaseRemainingSeconds: Math.min(
        input.focusLengthMinutes * MINUTE_IN_SECONDS,
        input.totalDurationMinutes * MINUTE_IN_SECONDS,
      ),
      status: "active",
      completionResult: null,
      completed: false,
      completedFocusBlocks: 0,
      createdAt: now,
      startedAt: now,
      updatedAt: now,
      pausedAt: null,
      endedAt: null,
      items: [...taskItems, ...habitItems],
    };

    setFocusSessions(currentSessions => [newSession, ...currentSessions]);
    return newSession.id;
  };

  const pauseFocusSession = (id: string) => {
    const now = new Date().toISOString();
    setFocusSessions(currentSessions =>
      currentSessions.map(session =>
        session.id === id && session.status === "active"
          ? { ...session, status: "paused", pausedAt: now, updatedAt: now }
          : session,
      ),
    );
  };

  const resumeFocusSession = (id: string) => {
    if (focusSessions.some(session => session.status === "active")) {
      return false;
    }

    const now = new Date().toISOString();
    setFocusSessions(currentSessions =>
      currentSessions.map(session =>
        session.id === id && session.status === "paused"
          ? { ...session, status: "active", pausedAt: null, updatedAt: now }
          : session,
      ),
    );

    return true;
  };

  const completeFocusSession = (id: string) => {
    const now = new Date().toISOString();
    setFocusSessions(currentSessions =>
      currentSessions.map(session =>
        session.id === id
          ? {
              ...session,
              status: "completed",
              completionResult: session.items.every(item => item.completedInSessionAt)
                ? "successful"
                : "unsuccessful",
              completed: true,
              pausedAt: null,
              endedAt: now,
              updatedAt: now,
              phaseRemainingSeconds: 0,
            }
          : session,
      ),
    );
  };

  const quitFocusSession = (id: string) => {
    const now = new Date().toISOString();
    setFocusSessions(currentSessions =>
      currentSessions.map(session =>
        session.id === id
          ? {
              ...session,
              status: "quit",
              completionResult: null,
              completed: false,
              pausedAt: null,
              endedAt: now,
              updatedAt: now,
            }
          : session,
      ),
    );
  };

  const markFocusSessionItemComplete = (sessionId: string, itemId: string) => {
    const session = focusSessions.find(entry => entry.id === sessionId);
    const item = session?.items.find(entry => entry.id === itemId);

    if (!session || !item) {
      return;
    }

    const completedAt = new Date().toISOString();

    if (item.sourceType === "task") {
      setTasks(currentTasks =>
        currentTasks.map(task =>
          task.id === item.sourceId && !task.completed
            ? {
                ...task,
                completed: true,
                completedAt,
              }
            : task,
        ),
      );
    } else {
      completeHabit(item.sourceId);
    }

    setFocusSessions(currentSessions =>
      currentSessions.map(currentSession =>
        currentSession.id === sessionId
          ? {
              ...currentSession,
              items: currentSession.items.map(currentItem =>
                currentItem.id === itemId && !currentItem.completedInSessionAt
                  ? { ...currentItem, completedInSessionAt: completedAt }
                  : currentItem,
              ),
            }
          : currentSession,
      ),
    );
  };

  return (
    <DataContext.Provider
      value={{
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

